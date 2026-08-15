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
  UseGuards,
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
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../core/decorators/roles.decorator';
import { OfficeLevelGuard } from '../core/guards/office-level.guard';
import { OFFICE_USER_LEVEL } from '../core/constants/office-user-level.constants';
import {
  BulkUpdateLotStatusDto,
  GenerateProjectLotsDto,
  UpdateProjectLotDto,
} from './dto/project-lot.dto';
import { ProjectLotsService } from './project-lots.service';
import { ProjectLotMapService } from './services/project-lot-map.service';
import { ProjectLotKind } from './types/project-lot.enums';

const ADMIN_LEVELS = [
  OFFICE_USER_LEVEL.admin,
  OFFICE_USER_LEVEL.subadmin,
] as const;

const CONTENT_AND_ADMIN_LEVELS = [
  OFFICE_USER_LEVEL.admin,
  OFFICE_USER_LEVEL.subadmin,
  OFFICE_USER_LEVEL.content,
] as const;

@ApiTags('Project Lots')
@ApiSecurity('TOKEN')
@Controller('projects')
@UseGuards(OfficeLevelGuard)
export class ProjectLotsController {
  public constructor(
    private readonly projectLotsService: ProjectLotsService,
    private readonly projectLotMapService: ProjectLotMapService,
  ) {}

  @Get(':projectId/lots/public')
  @ApiOperation({
    summary:
      'Public catalog of lots (number, area, price, status, kind, ventorName, holdUntil, stage*). No soldBy. Expired holds released on read.',
  })
  @ApiParam({ name: 'projectId' })
  @ApiQuery({
    name: 'kind',
    required: false,
    enum: ['lot', 'commercial', 'all'],
  })
  @ApiQuery({
    name: 'stage',
    required: false,
    description: 'Filter by stageKey (e.g. default, 1)',
  })
  @ApiResponse({ status: 200, description: 'Public lots + summary.' })
  public listPublic(
    @Param('projectId') projectId: string,
    @Query('kind') kind?: string,
    @Query('stage') stage?: string,
  ) {
    return this.projectLotsService.listPublic(
      projectId,
      this.parseKindFilter(kind),
      stage,
    );
  }

  @Get(':projectId/lots/map/public')
  @ApiOperation({
    summary:
      'Public painted lot map GeoJSON (live status join). No soldBy.',
  })
  @ApiParam({ name: 'projectId' })
  public getMapPublic(@Param('projectId') projectId: string) {
    return this.projectLotMapService.getPaintedMap(projectId, {
      includeSoldBy: false,
    });
  }

  @Get(':projectId/lots/map')
  @Roles(...CONTENT_AND_ADMIN_LEVELS)
  @ApiOperation({
    summary: 'Painted lot map GeoJSON joined with live inventory status',
  })
  @ApiParam({ name: 'projectId' })
  public getMap(@Param('projectId') projectId: string) {
    return this.projectLotMapService.getPaintedMap(projectId, {
      includeSoldBy: true,
    });
  }

  @Post(':projectId/lots/map/kml')
  @Roles(...ADMIN_LEVELS)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 40 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        const name = (file.originalname ?? '').toLowerCase();
        const ok =
          name.endsWith('.kml') ||
          file.mimetype.includes('xml') ||
          file.mimetype.includes('kml') ||
          file.mimetype === 'application/vnd.google-earth.kml+xml';
        if (ok) callback(null, true);
        else
          callback(
            new BadRequestException('Only .kml files are allowed'),
            false,
          );
      },
    }),
  )
  @ApiOperation({
    summary:
      'Upload lot polygons KML, convert to GeoJSON with west/east stages, upsert missing lots',
  })
  @ApiParam({ name: 'projectId' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        swapStages: {
          type: 'string',
          description: 'Optional "true" to flip west/east stage labels',
        },
      },
      required: ['file'],
    },
  })
  public uploadMapKml(
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('swapStages') swapStages?: string,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('No file uploaded');
    }
    const swap =
      typeof swapStages === 'string' &&
      ['1', 'true', 'yes'].includes(swapStages.trim().toLowerCase());
    return this.projectLotMapService.uploadKml({
      projectId,
      buffer: file.buffer,
      originalName: file.originalname ?? 'lots.kml',
      swapStages: swap,
    });
  }

  @Delete(':projectId/lots/map')
  @Roles(...ADMIN_LEVELS)
  @ApiOperation({ summary: 'Clear lot map KML/GeoJSON assets from project' })
  @ApiParam({ name: 'projectId' })
  public clearMap(@Param('projectId') projectId: string) {
    return this.projectLotMapService.clearMap(projectId);
  }

  @Post(':projectId/lots/generate')
  @Roles(...ADMIN_LEVELS)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({
    summary:
      'Generate missing lot/commercial units from project counts and base areas (admin)',
  })
  @ApiParam({ name: 'projectId' })
  @ApiBody({ type: GenerateProjectLotsDto })
  @ApiResponse({ status: 201, description: 'Units created.' })
  public generate(
    @Param('projectId') projectId: string,
    @Body() dto: GenerateProjectLotsDto,
  ) {
    return this.projectLotsService.generate(projectId, dto);
  }

  @Get(':projectId/lots')
  @Roles(...CONTENT_AND_ADMIN_LEVELS)
  @ApiOperation({ summary: 'List project lots with status summary' })
  @ApiParam({ name: 'projectId' })
  @ApiQuery({
    name: 'kind',
    required: false,
    enum: ['lot', 'commercial', 'all'],
  })
  @ApiQuery({
    name: 'stage',
    required: false,
    description: 'Filter by stageKey',
  })
  public listByProject(
    @Param('projectId') projectId: string,
    @Query('kind') kind?: string,
    @Query('stage') stage?: string,
  ) {
    return this.projectLotsService.listByProject(
      projectId,
      this.parseKindFilter(kind),
      stage,
    );
  }

  @Patch(':projectId/lots/bulk-status')
  @Roles(...CONTENT_AND_ADMIN_LEVELS)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({ summary: 'Bulk-update status for selected lots' })
  @ApiParam({ name: 'projectId' })
  @ApiBody({ type: BulkUpdateLotStatusDto })
  public bulkUpdateStatus(
    @Param('projectId') projectId: string,
    @Body() dto: BulkUpdateLotStatusDto,
  ) {
    return this.projectLotsService.bulkUpdateStatus(projectId, dto);
  }

  @Post(':projectId/lots/import')
  @Roles(...CONTENT_AND_ADMIN_LEVELS)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        const name = (file.originalname ?? '').toLowerCase();
        const ok =
          name.endsWith('.xlsx') ||
          file.mimetype.includes('spreadsheet') ||
          file.mimetype.includes('excel');
        if (ok) callback(null, true);
        else
          callback(
            new BadRequestException('Only .xlsx Excel files are allowed'),
            false,
          );
      },
    }),
  )
  @ApiOperation({
    summary:
      'Import/upsert lots from Excel (headers: nLots, area, price, ventor, status)',
  })
  @ApiParam({ name: 'projectId' })
  @ApiQuery({
    name: 'kind',
    required: false,
    enum: ['lot', 'commercial'],
    description: 'Default: lot',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  public importExcel(
    @Param('projectId') projectId: string,
    @Query('kind') kind: string | undefined,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('No file uploaded');
    }
    const parsedKind =
      kind === 'commercial' ? ProjectLotKind.commercial : ProjectLotKind.lot;
    return this.projectLotsService.importFromExcel(
      projectId,
      file.buffer,
      parsedKind,
    );
  }

  @Patch(':projectId/lots/:lotId')
  @Roles(...CONTENT_AND_ADMIN_LEVELS)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({ summary: 'Update a single lot (area, price, status, …)' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'lotId' })
  @ApiBody({ type: UpdateProjectLotDto })
  public updateLot(
    @Param('projectId') projectId: string,
    @Param('lotId') lotId: string,
    @Body() dto: UpdateProjectLotDto,
  ) {
    return this.projectLotsService.updateLot(projectId, lotId, dto);
  }

  private parseKindFilter(
    kind?: string,
  ): ProjectLotKind | 'all' {
    if (!kind || kind.trim() === '' || kind === 'all') {
      return 'all';
    }
    const normalized = kind.trim().toLowerCase();
    if (normalized === ProjectLotKind.lot) {
      return ProjectLotKind.lot;
    }
    if (normalized === ProjectLotKind.commercial) {
      return ProjectLotKind.commercial;
    }
    throw new BadRequestException(
      'Query "kind" must be one of: lot, commercial, all',
    );
  }
}
