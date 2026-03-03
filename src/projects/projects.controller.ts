import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
  @ApiOperation({ summary: 'List all non-deleted projects' })
  @ApiResponse({ status: 200, description: 'List of projects.' })
  public list() {
    return this.projectsService.list();
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
