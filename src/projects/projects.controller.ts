import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ImageCompressionService } from './services/image-compression.service';
import { ProjectImageStorageService } from './services/project-image-storage.service';
import { ProjectDocumentUploadService } from './services/project-document-upload.service';
import {
  ALLOWED_BROCHURE_MIME_TYPES,
  ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_PLANE_MIME_TYPES,
  ALLOWED_REEL_VIDEO_MIME_TYPES,
  MAX_DOCUMENT_FILE_SIZE_BYTES,
  MAX_IMAGE_FILE_SIZE_BYTES,
  MAX_REEL_VIDEO_FILE_SIZE_BYTES,
} from './constants/image-upload.constants';
import { ListProjectsEnableFilter } from './types/list-projects-enable-filter.type';

@ApiTags('Projects')
@Controller('projects')
export class ProjectsController {
  public constructor(
    private readonly projectsService: ProjectsService,
    private readonly imageCompressionService: ImageCompressionService,
    private readonly projectImageStorageService: ProjectImageStorageService,
    private readonly projectDocumentUploadService: ProjectDocumentUploadService,
  ) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({ summary: 'Create a project' })
  @ApiBody({ type: CreateProjectDto })
  @ApiResponse({ status: 201, description: 'Project created.' })
  @ApiResponse({ status: 400, description: 'Validation failed.' })
  public create(@Body() createProjectDto: CreateProjectDto) {
    return this.projectsService.create(createProjectDto);
  }

  @Patch(':projectId/enabled/:enable')
  @ApiOperation({ summary: 'Enable or disable a project' })
  @ApiParam({ name: 'projectId', description: 'MongoDB ObjectId of the project' })
  @ApiParam({
    name: 'enable',
    description: 'true to enable, false to disable',
    enum: ['true', 'false'],
  })
  @ApiResponse({ status: 200, description: 'Project updated with new enabled flag.' })
  @ApiResponse({ status: 400, description: 'Invalid enable value.' })
  @ApiResponse({ status: 404, description: 'Project not found.' })
  public setProjectEnabled(
    @Param('projectId') projectId: string,
    @Param('enable') enable: string,
  ) {
    const normalized = enable?.trim().toLowerCase();
    if (normalized !== 'true' && normalized !== 'false') {
      throw new BadRequestException(
        'Path parameter "enable" must be "true" or "false".',
      );
    }
    return this.projectsService.setEnabled(projectId, normalized === 'true');
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({ summary: 'Update a project by ID' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the project' })
  @ApiBody({ type: UpdateProjectDto })
  @ApiResponse({ status: 200, description: 'Project updated.' })
  @ApiResponse({ status: 404, description: 'Project not found.' })
  @ApiResponse({ status: 400, description: 'Validation failed.' })
  public update(
    @Param('id') id: string,
    @Body() updateProjectDto: UpdateProjectDto,
  ) {
    return this.projectsService.update(id, updateProjectDto);
  }

  @Get()
  @ApiOperation({
    summary:
      'List non-deleted projects (default: enabled only); optional enable filter',
  })
  @ApiQuery({
    name: 'enable',
    required: false,
    enum: ['true', 'false', 'all'],
    description:
      'Omitted: same as true (enabled only). true: enabled only; false: disabled only; all: every non-deleted project',
  })
  @ApiResponse({ status: 200, description: 'List of projects.' })
  @ApiResponse({ status: 400, description: 'Invalid enable query value.' })
  public list(@Query('enable') enable?: string) {
    if (enable === undefined || enable.trim() === '') {
      return this.projectsService.list('true');
    }
    const normalized = enable.trim().toLowerCase();
    if (
      normalized !== 'true' &&
      normalized !== 'false' &&
      normalized !== 'all'
    ) {
      throw new BadRequestException(
        'Query "enable" must be one of: true, false, all (or omit for enabled only).',
      );
    }
    return this.projectsService.list(normalized as ListProjectsEnableFilter);
  }

  @Get('admin/test')
  @ApiOperation({ summary: 'Smoke test' })
  @ApiResponse({ status: 200, description: 'Service is up.' })
  public adminTest(): { status: string } {
    return { status: 'ok' };
  }

  @Post(':id/images')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_IMAGE_FILE_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        const isAllowed = (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(file.mimetype);
        if (isAllowed) callback(null, true);
        else callback(new BadRequestException('Invalid file type. Allowed: jpeg, jpg, png, webp'), false);
      },
    }),
  )
  @ApiOperation({ summary: 'Upload an image for a project' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the project' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'Image file' },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 201, description: 'Image uploaded and added to project.' })
  @ApiResponse({ status: 400, description: 'Invalid file or validation failed.' })
  @ApiResponse({ status: 404, description: 'Project not found.' })
  public async uploadProjectImage(
    @Param('id') projectId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('No file uploaded');
    }
    const project = await this.projectsService.getById(projectId);
    const { buffer, format } = await this.imageCompressionService.compress(file.buffer);
    const fileName = this.projectImageStorageService.buildImageFileName(project.title, format);
    await this.projectImageStorageService.saveFile(buffer, fileName);
    const updatedProject = await this.projectsService.addImage(projectId, fileName);
    return {
      message: 'Image uploaded successfully',
      imageName: fileName,
      project: updatedProject,
    };
  }

  @Post(':id/images/multiple')
  @UseInterceptors(
    FilesInterceptor('files', 20, {
      limits: { fileSize: MAX_IMAGE_FILE_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        const isAllowed = (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(file.mimetype);
        if (isAllowed) callback(null, true);
        else callback(new BadRequestException('Invalid file type. Allowed: jpeg, jpg, png, webp'), false);
      },
    }),
  )
  @ApiOperation({ summary: 'Upload multiple images for a project' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the project' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Image files',
        },
      },
      required: ['files'],
    },
  })
  @ApiResponse({ status: 201, description: 'Images uploaded and added to project.' })
  @ApiResponse({ status: 400, description: 'Invalid file or validation failed.' })
  @ApiResponse({ status: 404, description: 'Project not found.' })
  public async uploadProjectImages(
    @Param('id') projectId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files?.length) {
      throw new BadRequestException('No files uploaded');
    }
    const project = await this.projectsService.getById(projectId);
    const imageNames: string[] = [];
    for (const [index, file] of files.entries()) {
      const { buffer, format } = await this.imageCompressionService.compress(file.buffer);
      const imageName = this.projectImageStorageService.buildImageFileName(project.title, format, index);
      await this.projectImageStorageService.saveFile(buffer, imageName);
      imageNames.push(imageName);
    }
    const updatedProject = await this.projectsService.addImages(projectId, imageNames);
    return {
      message: 'Images uploaded successfully',
      imageNames,
      project: updatedProject,
    };
  }

  @Post(':id/reel-video')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_REEL_VIDEO_FILE_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        const isAllowed = (ALLOWED_REEL_VIDEO_MIME_TYPES as readonly string[]).includes(file.mimetype);
        if (isAllowed) callback(null, true);
        else callback(new BadRequestException('Invalid reel video type. Allowed: mp4, webm, mov, avi'), false);
      },
    }),
  )
  @ApiOperation({ summary: 'Upload reel video for a project' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the project' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'Reel video file' },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 201, description: 'Reel video uploaded and assigned.' })
  @ApiResponse({ status: 400, description: 'Invalid file or validation failed.' })
  @ApiResponse({ status: 404, description: 'Project not found.' })
  public uploadProjectReelVideo(
    @Param('id') projectId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.projectDocumentUploadService.uploadDocument({
      projectId,
      file,
      field: 'reelVideo',
      fileType: 'reel_video',
    });
  }

  @Post(':id/plane')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_DOCUMENT_FILE_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        const isAllowed = (ALLOWED_PLANE_MIME_TYPES as readonly string[]).includes(file.mimetype);
        if (isAllowed) callback(null, true);
        else callback(new BadRequestException('Invalid plane type. Allowed: pdf, jpeg, jpg, png'), false);
      },
    }),
  )
  @ApiOperation({ summary: 'Upload project plane file' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the project' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'Project plane file' },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 201, description: 'Project plane uploaded and assigned.' })
  @ApiResponse({ status: 400, description: 'Invalid file or validation failed.' })
  @ApiResponse({ status: 404, description: 'Project not found.' })
  public uploadProjectPlane(
    @Param('id') projectId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.projectDocumentUploadService.uploadDocument({
      projectId,
      file,
      field: 'plane',
      fileType: 'plane',
    });
  }

  @Post(':id/brochure')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_DOCUMENT_FILE_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        const isAllowed = (ALLOWED_BROCHURE_MIME_TYPES as readonly string[]).includes(file.mimetype);
        if (isAllowed) callback(null, true);
        else callback(new BadRequestException('Invalid brochure type. Allowed: pdf'), false);
      },
    }),
  )
  @ApiOperation({ summary: 'Upload project brochure file' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the project' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'Project brochure file' },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 201, description: 'Project brochure uploaded and assigned.' })
  @ApiResponse({ status: 400, description: 'Invalid file or validation failed.' })
  @ApiResponse({ status: 404, description: 'Project not found.' })
  public uploadProjectBrochure(
    @Param('id') projectId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.projectDocumentUploadService.uploadDocument({
      projectId,
      file,
      field: 'brochure',
      fileType: 'brochure',
    });
  }

  @Delete(':id/images/:imageName')
  @ApiOperation({ summary: 'Remove an image from a project' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the project' })
  @ApiParam({
    name: 'imageName',
    description: 'Image filename (e.g. projectId_timestamp.webp)',
  })
  @ApiResponse({ status: 200, description: 'Image removed; returns updated project.' })
  @ApiResponse({ status: 404, description: 'Project or image not found.' })
  public async removeProjectImage(
    @Param('id') projectId: string,
    @Param('imageName') imageName: string,
  ) {
    const project = await this.projectsService.removeImage(projectId, imageName);
    return {
      message: 'Image removed successfully',
      imageName,
      project,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project by ID' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the project' })
  @ApiResponse({ status: 200, description: 'Project found.' })
  @ApiResponse({ status: 404, description: 'Project not found.' })
  public getById(@Param('id') id: string) {
    return this.projectsService.getById(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a project by ID' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the project' })
  @ApiResponse({ status: 200, description: 'Project soft-deleted.' })
  @ApiResponse({ status: 404, description: 'Project not found.' })
  public remove(@Param('id') id: string) {
    return this.projectsService.remove(id);
  }

}
