import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UploadedFile,
  UploadedFiles,
  UseGuards,
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
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../core/decorators/roles.decorator';
import { JwtUser } from '../core/decorators/jwt-user.decorator';
import { OfficeLevelGuard } from '../core/guards/office-level.guard';
import { OFFICE_USER_LEVEL } from '../core/constants/office-user-level.constants';
import type { OfficeJwtPayload } from '../core/types/office-jwt-payload.type';
import { resolveOfficeUserId } from '../core/utils/resolve-office-user-id';
import { CreateProjectLocationDto } from './dto/create-project-location.dto';
import { DiscoverLocationsDto } from './dto/discover-locations.dto';
import { ReorderLocationsDto } from './dto/reorder-locations.dto';
import { PlaceExperienceAssetDto } from './dto/place-experience-asset.dto';
import { UpdateExperienceAssetDto } from './dto/update-experience-asset.dto';
import { UpdateProjectExperienceDto } from './dto/update-project-experience.dto';
import { UpdateProjectLocationDto } from './dto/update-project-location.dto';
import { UpsertExperienceScenesDto } from './dto/upsert-experience-scenes.dto';
import { ProjectExperienceAssetType } from './types/project-experience.enums';
import { ProjectExperienceAssetsService } from './services/project-experience-assets.service';
import { ProjectExperienceResourcesService } from './services/project-experience-resources.service';
import { ProjectExperienceService } from './services/project-experience.service';
import { ProjectLocationsService } from './services/project-locations.service';

const ADMIN_LEVELS = [
  OFFICE_USER_LEVEL.admin,
  OFFICE_USER_LEVEL.subadmin,
  OFFICE_USER_LEVEL.content,
] as const;

const VIEW_LEVELS = [
  OFFICE_USER_LEVEL.admin,
  OFFICE_USER_LEVEL.subadmin,
  OFFICE_USER_LEVEL.commercialDirector,
  OFFICE_USER_LEVEL.content,
] as const;

@ApiTags('Project Experience')
@ApiSecurity('TOKEN')
@Controller('projects')
@UseGuards(OfficeLevelGuard)
export class ProjectExperienceController {
  public constructor(
    private readonly projectExperienceService: ProjectExperienceService,
    private readonly projectLocationsService: ProjectLocationsService,
    private readonly projectExperienceAssetsService: ProjectExperienceAssetsService,
    private readonly projectExperienceResourcesService: ProjectExperienceResourcesService,
  ) {}

  @Get(':projectId/experience/admin/test')
  @Roles(...VIEW_LEVELS)
  @ApiOperation({ summary: 'Smoke test for project experience module' })
  public adminTest(): { status: string } {
    return { status: 'ok' };
  }

  @Get(':projectId/experience')
  @Roles(...VIEW_LEVELS)
  @ApiOperation({ summary: 'Get or create draft immersive experience' })
  @ApiParam({ name: 'projectId' })
  public getExperience(@Param('projectId') projectId: string) {
    return this.projectExperienceService.getOrCreateDraft(projectId);
  }

  @Patch(':projectId/experience')
  @Roles(...ADMIN_LEVELS)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({ summary: 'Update experience map settings and layers' })
  @ApiParam({ name: 'projectId' })
  @ApiBody({ type: UpdateProjectExperienceDto })
  public updateExperience(
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectExperienceDto,
  ) {
    return this.projectExperienceService.update(projectId, dto);
  }

  @Put(':projectId/experience/scenes')
  @Roles(...ADMIN_LEVELS)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({ summary: 'Replace experience scenes (storytelling)' })
  @ApiParam({ name: 'projectId' })
  @ApiBody({ type: UpsertExperienceScenesDto })
  public upsertScenes(
    @Param('projectId') projectId: string,
    @Body() dto: UpsertExperienceScenesDto,
  ) {
    return this.projectExperienceService.upsertScenes(projectId, dto);
  }

  @Post(':projectId/experience/publish')
  @Roles(...ADMIN_LEVELS)
  @ApiOperation({ summary: 'Publish experience snapshot for public clients' })
  @ApiParam({ name: 'projectId' })
  public publish(@Param('projectId') projectId: string) {
    return this.projectExperienceService.publish(projectId);
  }

  @Post(':projectId/experience/disable')
  @Roles(...ADMIN_LEVELS)
  @ApiOperation({ summary: 'Disable published experience' })
  @ApiParam({ name: 'projectId' })
  public disable(@Param('projectId') projectId: string) {
    return this.projectExperienceService.disable(projectId);
  }

  @Get(':projectId/experience/locations')
  @Roles(...VIEW_LEVELS)
  @ApiOperation({ summary: 'List curated project locations' })
  @ApiParam({ name: 'projectId' })
  public listLocations(@Param('projectId') projectId: string) {
    return this.projectLocationsService.listByProject(projectId);
  }

  @Post(':projectId/experience/locations')
  @Roles(...ADMIN_LEVELS)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({ summary: 'Create a curated geographical location' })
  @ApiParam({ name: 'projectId' })
  @ApiBody({ type: CreateProjectLocationDto })
  public createLocation(
    @Param('projectId') projectId: string,
    @Body() dto: CreateProjectLocationDto,
  ) {
    return this.projectLocationsService.create(projectId, dto);
  }

  @Patch(':projectId/experience/locations/reorder')
  @Roles(...ADMIN_LEVELS)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({ summary: 'Reorder locations' })
  @ApiParam({ name: 'projectId' })
  @ApiBody({ type: ReorderLocationsDto })
  public reorderLocations(
    @Param('projectId') projectId: string,
    @Body() dto: ReorderLocationsDto,
  ) {
    return this.projectLocationsService.reorder(projectId, dto);
  }

  @Post(':projectId/experience/locations/discover')
  @Roles(...ADMIN_LEVELS)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({
    summary:
      'Discover nearby POIs via Mapbox Search Box. Returns { provider, candidates, warnings }; not persisted until admin creates locations',
  })
  @ApiParam({ name: 'projectId' })
  @ApiBody({ type: DiscoverLocationsDto })
  public discoverLocations(
    @Param('projectId') projectId: string,
    @Body() dto: DiscoverLocationsDto,
  ) {
    return this.projectLocationsService.discover(projectId, dto);
  }

  @Post(':projectId/experience/locations/import-geojson')
  @Roles(...ADMIN_LEVELS)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Import locations from a GeoJSON FeatureCollection' })
  @ApiParam({ name: 'projectId' })
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
  public importLocationsGeoJson(
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('No file uploaded');
    }
    return this.projectLocationsService.importGeoJson({
      projectId,
      buffer: file.buffer,
    });
  }

  @Patch(':projectId/experience/locations/:locationId')
  @Roles(...ADMIN_LEVELS)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({ summary: 'Update a location' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'locationId' })
  @ApiBody({ type: UpdateProjectLocationDto })
  public updateLocation(
    @Param('projectId') projectId: string,
    @Param('locationId') locationId: string,
    @Body() dto: UpdateProjectLocationDto,
  ) {
    return this.projectLocationsService.update(projectId, locationId, dto);
  }

  @Post(':projectId/experience/locations/:locationId/gallery')
  @Roles(...ADMIN_LEVELS)
  @UseInterceptors(
    FilesInterceptor('files', 12, {
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Append images to an amenity gallery' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'locationId' })
  @ApiConsumes('multipart/form-data')
  public uploadLocationGallery(
    @Param('projectId') projectId: string,
    @Param('locationId') locationId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.projectLocationsService.appendGallery(
      projectId,
      locationId,
      files ?? [],
    );
  }

  @Post(':projectId/experience/locations/:locationId/verify')
  @Roles(...ADMIN_LEVELS)
  @ApiOperation({ summary: 'Mark a location as verified' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'locationId' })
  public verifyLocation(
    @Param('projectId') projectId: string,
    @Param('locationId') locationId: string,
    @JwtUser() jwtUser: OfficeJwtPayload | undefined,
  ) {
    return this.projectLocationsService.verify(
      projectId,
      locationId,
      resolveOfficeUserId(jwtUser),
    );
  }

  @Delete(':projectId/experience/locations/:locationId')
  @Roles(...ADMIN_LEVELS)
  @ApiOperation({ summary: 'Delete a location' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'locationId' })
  public deleteLocation(
    @Param('projectId') projectId: string,
    @Param('locationId') locationId: string,
  ) {
    return this.projectLocationsService.remove(projectId, locationId);
  }

  @Get(':projectId/experience/resources')
  @Roles(...VIEW_LEVELS)
  @ApiOperation({ summary: 'List experience resource library' })
  @ApiParam({ name: 'projectId' })
  public listResources(@Param('projectId') projectId: string) {
    return this.projectExperienceResourcesService.listByProject(projectId);
  }

  @Post(':projectId/experience/resources')
  @Roles(...ADMIN_LEVELS)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 100 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Upload file to experience resource library' })
  @ApiParam({ name: 'projectId' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        type: {
          type: 'string',
          enum: Object.values(ProjectExperienceAssetType),
        },
        name: { type: 'string' },
      },
      required: ['file', 'type'],
    },
  })
  public uploadResource(
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('type') typeRaw: string,
    @Body('name') name?: string,
  ) {
    const type = this.parseAssetType(typeRaw);
    return this.projectExperienceResourcesService.upload({
      projectId,
      file,
      type,
      name,
    });
  }

  @Delete(':projectId/experience/resources/:resourceId')
  @Roles(...ADMIN_LEVELS)
  @ApiOperation({ summary: 'Delete library resource (no placements allowed)' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'resourceId' })
  public deleteResource(
    @Param('projectId') projectId: string,
    @Param('resourceId') resourceId: string,
  ) {
    return this.projectExperienceResourcesService.remove(projectId, resourceId);
  }

  @Get(':projectId/experience/assets')
  @Roles(...VIEW_LEVELS)
  @ApiOperation({ summary: 'List experience asset placements' })
  @ApiParam({ name: 'projectId' })
  public listAssets(@Param('projectId') projectId: string) {
    return this.projectExperienceAssetsService.listByProject(projectId);
  }

  @Post(':projectId/experience/assets/place')
  @Roles(...ADMIN_LEVELS)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({
    summary: 'Place a library resource on the map (requires lon/lat)',
  })
  @ApiParam({ name: 'projectId' })
  @ApiBody({ type: PlaceExperienceAssetDto })
  public placeAsset(
    @Param('projectId') projectId: string,
    @Body() dto: PlaceExperienceAssetDto,
  ) {
    return this.projectExperienceAssetsService.placeFromResource(
      projectId,
      dto,
    );
  }

  @Post(':projectId/experience/assets')
  @Roles(...ADMIN_LEVELS)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 100 * 1024 * 1024 },
    }),
  )
  @ApiOperation({
    summary:
      'Legacy: upload georeferenced asset (prefer resources + assets/place)',
  })
  @ApiParam({ name: 'projectId' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        type: {
          type: 'string',
          enum: Object.values(ProjectExperienceAssetType),
        },
        name: { type: 'string' },
        longitude: { type: 'number' },
        latitude: { type: 'number' },
        altitude: { type: 'number' },
      },
      required: ['file', 'type'],
    },
  })
  public uploadAsset(
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('type') typeRaw: string,
    @Body('name') name?: string,
    @Body('longitude') longitudeRaw?: string,
    @Body('latitude') latitudeRaw?: string,
    @Body('altitude') altitudeRaw?: string,
  ) {
    const type = this.parseAssetType(typeRaw);
    return this.projectExperienceAssetsService.upload({
      projectId,
      file,
      type,
      name,
      longitude:
        longitudeRaw !== undefined ? Number(longitudeRaw) : undefined,
      latitude: latitudeRaw !== undefined ? Number(latitudeRaw) : undefined,
      altitude:
        altitudeRaw !== undefined && altitudeRaw !== ''
          ? Number(altitudeRaw)
          : null,
    });
  }

  @Patch(':projectId/experience/assets/:assetId')
  @Roles(...ADMIN_LEVELS)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({ summary: 'Update an experience asset' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'assetId' })
  @ApiBody({ type: UpdateExperienceAssetDto })
  public updateAsset(
    @Param('projectId') projectId: string,
    @Param('assetId') assetId: string,
    @Body() dto: UpdateExperienceAssetDto,
  ) {
    return this.projectExperienceAssetsService.update(
      projectId,
      assetId,
      dto,
    );
  }

  @Delete(':projectId/experience/assets/:assetId')
  @Roles(...ADMIN_LEVELS)
  @ApiOperation({ summary: 'Delete an experience asset' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'assetId' })
  public deleteAsset(
    @Param('projectId') projectId: string,
    @Param('assetId') assetId: string,
  ) {
    return this.projectExperienceAssetsService.remove(projectId, assetId);
  }

  private parseAssetType(typeRaw: string): ProjectExperienceAssetType {
    const normalized = (typeRaw ?? '').trim();
    if (
      !Object.values(ProjectExperienceAssetType).includes(
        normalized as ProjectExperienceAssetType,
      )
    ) {
      throw new BadRequestException(
        `type must be one of: ${Object.values(ProjectExperienceAssetType).join(', ')}`,
      );
    }
    return normalized as ProjectExperienceAssetType;
  }
}
