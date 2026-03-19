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
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_FILE_SIZE_BYTES,
} from './constants/image-upload.constants';
import { ListProjectsEnableFilter } from './types/list-projects-enable-filter.type';

@ApiTags('Projects')
@Controller('projects')
export class ProjectsController {
  public constructor(
    private readonly projectsService: ProjectsService,
    private readonly imageCompressionService: ImageCompressionService,
    private readonly projectImageStorageService: ProjectImageStorageService,
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
        const isAllowed = (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(
          file.mimetype,
        );
        if (isAllowed) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException(
              'Invalid file type. Allowed: jpeg, jpg, png, webp',
            ),
            false,
          );
        }
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
    const { buffer, format } =
      await this.imageCompressionService.compress(file.buffer);
    const fileName =
      this.projectImageStorageService.buildImageFileName(projectId, format);
    await this.projectImageStorageService.saveImage(buffer, fileName);
    const project = await this.projectsService.addImage(projectId, fileName);
    return {
      message: 'Image uploaded successfully',
      imageName: fileName,
      project,
    };
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
