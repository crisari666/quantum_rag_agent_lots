import {
  BadRequestException,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { promises as fs } from 'fs';
import { basename } from 'path';
import { ProjectsService } from './projects.service';
import { ProjectImageStorageService } from './services/project-image-storage.service';
import { ProjectDownloadAttribute } from './types/project-download-attribute.type';

const DOWNLOADABLE_PROJECT_ATTRIBUTES: readonly ProjectDownloadAttribute[] = [
  'brochure',
  'plane',
  'reelVideo',
  'cardProject',
  'verticalVideos',
] as const;

@ApiTags('Projects')
@Controller('projects')
export class ProjectsResourceDownloadController {
  public constructor(
    private readonly projectsService: ProjectsService,
    private readonly projectImageStorageService: ProjectImageStorageService,
  ) {}

  /**
   * Downloads a stored project resource by attribute.
   */
  @Get(':id/resources/:attribute/download')
  @Header('Content-Type', 'application/octet-stream')
  @ApiOperation({
    summary:
      'Download a project resource by attribute (brochure, plane, reelVideo, cardProject)',
  })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the project' })
  @ApiParam({
    name: 'attribute',
    enum: DOWNLOADABLE_PROJECT_ATTRIBUTES,
    description: 'Project attribute that stores the file name to download',
  })
  @ApiQuery({
    name: 'fileName',
    required: false,
    description:
      'Required only when attribute=verticalVideos. Must match one value in project.verticalVideos',
  })
  @ApiResponse({ status: 200, description: 'Binary file stream.' })
  @ApiResponse({
    status: 400,
    description: 'Invalid attribute value.',
  })
  @ApiResponse({
    status: 404,
    description: 'Project, resource attribute, or file not found.',
  })
  public async downloadProjectResource(
    @Param('id') projectId: string,
    @Param('attribute') attribute: string,
    @Query('fileName') fileNameQuery = '',
    @Res() response: Response,
  ): Promise<void> {
    if (!this.isDownloadableAttribute(attribute)) {
      throw new BadRequestException(
        `Path parameter "attribute" must be one of: ${DOWNLOADABLE_PROJECT_ATTRIBUTES.join(', ')}`,
      );
    }
    const project = await this.projectsService.getById(projectId);
    const fileName = this.resolveProjectFileName(project, attribute, fileNameQuery);
    if (!fileName) {
      throw new NotFoundException(
        `Project ${projectId} does not have a file in attribute "${attribute}"`,
      );
    }
    const filePath = this.projectImageStorageService.resolveFilePath(fileName);
    await this.ensureFileExists(filePath, fileName);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${basename(fileName)}"`,
    );
    response.download(filePath, fileName);
  }

  /**
   * Downloads one stored file from the project's verticalVideos array.
   */
  @Get(':id/resources/vertical-videos/:fileName/download')
  @Header('Content-Type', 'application/octet-stream')
  @ApiOperation({
    summary:
      'Download a project vertical video by file name (from verticalVideos array)',
  })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the project' })
  @ApiParam({
    name: 'fileName',
    description: 'Stored file name present in project.verticalVideos',
  })
  @ApiResponse({ status: 200, description: 'Binary file stream.' })
  @ApiResponse({
    status: 404,
    description: 'Project, vertical video entry, or file not found.',
  })
  public async downloadProjectVerticalVideo(
    @Param('id') projectId: string,
    @Param('fileName') fileName: string,
    @Res() response: Response,
  ): Promise<void> {
    const project = await this.projectsService.getById(projectId);
    const verticalVideos = project.verticalVideos ?? [];
    const hasFileInProject = verticalVideos.includes(fileName);
    if (!hasFileInProject) {
      throw new NotFoundException(
        `Vertical video "${fileName}" not found in project ${projectId}`,
      );
    }
    const filePath = this.projectImageStorageService.resolveFilePath(fileName);
    await this.ensureFileExists(filePath, fileName);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${basename(fileName)}"`,
    );
    response.download(filePath, fileName);
  }

  private async ensureFileExists(filePath: string, fileName: string): Promise<void> {
    try {
      await fs.access(filePath);
    } catch {
      throw new NotFoundException(`Stored file "${fileName}" was not found`);
    }
  }

  private isDownloadableAttribute(
    attribute: string,
  ): attribute is ProjectDownloadAttribute {
    return (DOWNLOADABLE_PROJECT_ATTRIBUTES as readonly string[]).includes(
      attribute,
    );
  }

  private resolveProjectFileName(
    project: {
      brochure?: string;
      plane?: string;
      reelVideo?: string;
      cardProject?: string;
      verticalVideos?: string[];
    },
    attribute: ProjectDownloadAttribute,
    fileNameQuery?: string,
  ): string {
    if (attribute === 'verticalVideos') {
      const normalizedFileName = String(fileNameQuery ?? '').trim();
      if (!normalizedFileName) {
        throw new BadRequestException(
          'Query parameter "fileName" is required when attribute is "verticalVideos".',
        );
      }
      const verticalVideos = project.verticalVideos ?? [];
      const hasFile = verticalVideos.includes(normalizedFileName);
      if (!hasFile) {
        throw new NotFoundException(
          `Vertical video "${normalizedFileName}" was not found in this project`,
        );
      }
      return normalizedFileName;
    }
    return String(project[attribute] ?? '').trim();
  }
}
