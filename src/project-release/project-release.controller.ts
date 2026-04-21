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
import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_FILE_SIZE_BYTES,
} from '../projects/constants/image-upload.constants';
import { CreateProjectReleaseDto } from './dto/create-project-release.dto';
import { UpdateProjectReleaseDto } from './dto/update-project-release.dto';
import { ProjectReleaseService } from './project-release.service';
import { ProjectReleaseImageUploadService } from './services/project-release-image-upload.service';
import { ProjectReleaseImageRemoveService } from './services/project-release-image-remove.service';

@ApiTags('Project releases')
@Controller('project-releases')
export class ProjectReleaseController {
  public constructor(
    private readonly projectReleaseService: ProjectReleaseService,
    private readonly projectReleaseImageUploadService: ProjectReleaseImageUploadService,
    private readonly projectReleaseImageRemoveService: ProjectReleaseImageRemoveService,
  ) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({ summary: 'Create a project release' })
  @ApiBody({ type: CreateProjectReleaseDto })
  @ApiResponse({ status: 201, description: 'Project release created.' })
  @ApiResponse({ status: 400, description: 'Validation failed.' })
  public create(@Body() dto: CreateProjectReleaseDto) {
    return this.projectReleaseService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List project releases filtered by status (required query)',
  })
  @ApiQuery({
    name: 'status',
    required: true,
    enum: ['enabled', 'disabled'],
    description: 'Return only enabled or only disabled releases',
  })
  @ApiResponse({ status: 200, description: 'List of releases (each includes status).' })
  @ApiResponse({ status: 400, description: 'Missing or invalid status query.' })
  public list(@Query('status') status: string | undefined) {
    const parsed = this.projectReleaseService.parseListStatus(status);
    return this.projectReleaseService.list(parsed);
  }

  @Patch(':id/enabled/:enable')
  @ApiOperation({ summary: 'Enable or disable a project release' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the project release' })
  @ApiParam({
    name: 'enable',
    description: 'true to enable, false to disable',
    enum: ['true', 'false'],
  })
  @ApiResponse({ status: 200, description: 'Release updated with new enabled flag.' })
  @ApiResponse({ status: 400, description: 'Invalid enable value.' })
  @ApiResponse({ status: 404, description: 'Project release not found.' })
  public setEnabled(
    @Param('id') id: string,
    @Param('enable') enable: string,
  ) {
    const normalized = enable?.trim().toLowerCase();
    if (normalized !== 'true' && normalized !== 'false') {
      throw new BadRequestException(
        'Path parameter "enable" must be "true" or "false".',
      );
    }
    return this.projectReleaseService.setEnabled(id, normalized === 'true');
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({ summary: 'Update a project release by ID' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the project release' })
  @ApiBody({ type: UpdateProjectReleaseDto })
  @ApiResponse({ status: 200, description: 'Project release updated.' })
  @ApiResponse({ status: 404, description: 'Project release not found.' })
  @ApiResponse({ status: 400, description: 'Validation failed.' })
  public update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectReleaseDto,
  ) {
    return this.projectReleaseService.update(id, dto);
  }

  @Post(':id/images')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_IMAGE_FILE_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        const isAllowed = (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(
          file.mimetype,
        );
        if (isAllowed) callback(null, true);
        else {
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
  @ApiOperation({ summary: 'Upload an image for a project release' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the project release' })
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
  @ApiResponse({ status: 201, description: 'Image uploaded and added to release.' })
  @ApiResponse({ status: 400, description: 'Invalid file or validation failed.' })
  @ApiResponse({ status: 404, description: 'Project release not found.' })
  public async uploadImage(
    @Param('id') releaseId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.projectReleaseImageUploadService.uploadImage(releaseId, file);
  }

  @Delete(':id/images/:imageName')
  @ApiOperation({ summary: 'Remove an image from a project release' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the project release' })
  @ApiParam({
    name: 'imageName',
    description: 'Stored image filename (URL-encoded if needed)',
  })
  @ApiResponse({ status: 200, description: 'Image removed; returns updated release.' })
  @ApiResponse({ status: 404, description: 'Project release or image not found.' })
  public async removeImage(
    @Param('id') releaseId: string,
    @Param('imageName') imageName: string,
  ) {
    const decoded = decodeURIComponent(imageName);
    return this.projectReleaseImageRemoveService.removeImage(releaseId, decoded);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project release by ID' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the project release' })
  @ApiResponse({ status: 200, description: 'Project release found.' })
  @ApiResponse({ status: 404, description: 'Project release not found.' })
  public getById(@Param('id') id: string) {
    return this.projectReleaseService.getById(id);
  }
}
