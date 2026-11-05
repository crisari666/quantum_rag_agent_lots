import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { extname } from 'path';
import * as sharpNamespace from 'sharp';
import { ProjectImageStorageService } from '../../projects/services/project-image-storage.service';
import { ProjectsService } from '../../projects/projects.service';
import {
  ALLOWED_EXPERIENCE_GEOJSON_MIME_TYPES,
  ALLOWED_EXPERIENCE_IMAGE_MIME_TYPES,
  ALLOWED_EXPERIENCE_MODEL_MIME_TYPES,
  ALLOWED_EXPERIENCE_VIDEO_MIME_TYPES,
  EXPERIENCE_ASSET_MAX_BYTES,
} from '../constants/experience-asset-upload.constants';
import {
  ProjectExperienceAsset,
  ProjectExperienceAssetDocument,
} from '../schemas/project-experience-asset.schema';
import {
  ProjectExperienceResource,
  ProjectExperienceResourceDocument,
} from '../schemas/project-experience-resource.schema';
import { ProjectExperienceAssetType } from '../types/project-experience.enums';
import { compressPanoramaUpload } from '../utils/compress-panorama-upload.util';

@Injectable()
export class ProjectExperienceResourcesService {
  public constructor(
    @InjectModel(ProjectExperienceResource.name)
    private readonly resourceModel: Model<ProjectExperienceResourceDocument>,
    @InjectModel(ProjectExperienceAsset.name)
    private readonly assetModel: Model<ProjectExperienceAssetDocument>,
    private readonly projectsService: ProjectsService,
    private readonly projectImageStorageService: ProjectImageStorageService,
  ) {}

  public async listByProject(
    projectId: string,
  ): Promise<ProjectExperienceResourceDocument[]> {
    await this.projectsService.getById(projectId);
    return this.resourceModel
      .find({ projectId: new Types.ObjectId(projectId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  public async findOwned(
    projectId: string,
    resourceId: string,
  ): Promise<ProjectExperienceResourceDocument> {
    if (!Types.ObjectId.isValid(resourceId)) {
      throw new NotFoundException(`Resource ${resourceId} not found`);
    }
    const resource = await this.resourceModel
      .findOne({
        _id: new Types.ObjectId(resourceId),
        projectId: new Types.ObjectId(projectId),
      })
      .exec();
    if (!resource) {
      throw new NotFoundException(`Resource ${resourceId} not found`);
    }
    return resource;
  }

  public async upload(params: {
    readonly projectId: string;
    readonly file: Express.Multer.File;
    readonly type: ProjectExperienceAssetType;
    readonly name?: string;
  }): Promise<ProjectExperienceResourceDocument> {
    const project = await this.projectsService.getById(params.projectId);
    const file = await this.prepareUploadFile(params.type, params.file);
    this.assertUploadAllowed(params.type, file);
    const extension = this.resolveExtension(file);
    const timestamp = Date.now();
    const safeTitle =
      project.title
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40) || 'project';
    const fileName = `exp_res_${params.type}_${safeTitle}_${timestamp}${extension}`;
    await this.projectImageStorageService.saveFile(file.buffer, fileName);
    let thumbnailFileName = '';
    if (
      params.type === ProjectExperienceAssetType.image ||
      params.type === ProjectExperienceAssetType.panorama
    ) {
      thumbnailFileName = await this.createThumbnail(
        file.buffer,
        safeTitle,
        timestamp,
      );
    }
    return this.resourceModel.create({
      projectId: new Types.ObjectId(params.projectId),
      name: (params.name?.trim() || file.originalname || fileName).slice(0, 200),
      type: params.type,
      fileName,
      thumbnailFileName,
      sizeBytes: file.size,
      mimeType: file.mimetype,
    });
  }

  public async remove(
    projectId: string,
    resourceId: string,
  ): Promise<{ deleted: true; deletedPlacementIds: string[] }> {
    const resource = await this.findOwned(projectId, resourceId);
    const placements = await this.assetModel
      .find({
        projectId: new Types.ObjectId(projectId),
        resourceId: resource._id,
      })
      .select({ _id: 1 })
      .exec();
    const deletedPlacementIds = placements.map((row) => String(row._id));
    if (deletedPlacementIds.length > 0) {
      // Cascade: placements share the library file — only remove docs, not disk.
      await this.assetModel.deleteMany({
        _id: { $in: placements.map((row) => row._id) },
        projectId: new Types.ObjectId(projectId),
      });
    }
    await this.projectImageStorageService.deleteFile(resource.fileName);
    if (resource.thumbnailFileName) {
      await this.projectImageStorageService.deleteFile(
        resource.thumbnailFileName,
      );
    }
    await resource.deleteOne();
    return { deleted: true, deletedPlacementIds };
  }

  private async prepareUploadFile(
    type: ProjectExperienceAssetType,
    file: Express.Multer.File,
  ): Promise<Express.Multer.File> {
    if (type !== ProjectExperienceAssetType.panorama) return file;
    try {
      return await compressPanoramaUpload(file);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'unknown error';
      throw new BadRequestException(
        `Panorama image could not be compressed: ${detail}`,
      );
    }
  }

  private assertUploadAllowed(
    type: ProjectExperienceAssetType,
    file: Express.Multer.File,
  ): void {
    if (!file?.buffer) {
      throw new BadRequestException('No file uploaded');
    }
    const maxBytes = EXPERIENCE_ASSET_MAX_BYTES[type];
    if (file.size > maxBytes) {
      throw new BadRequestException(
        `File exceeds max size of ${maxBytes} bytes for type ${type}`,
      );
    }
    const mime = (file.mimetype ?? '').toLowerCase();
    const name = (file.originalname ?? '').toLowerCase();
    if (!this.isMimeAllowed(type, mime, name)) {
      throw new BadRequestException(
        `MIME/extension not allowed for asset type ${type}`,
      );
    }
  }

  private isMimeAllowed(
    type: ProjectExperienceAssetType,
    mime: string,
    name: string,
  ): boolean {
    switch (type) {
      case ProjectExperienceAssetType.image:
      case ProjectExperienceAssetType.panorama:
        return (
          (ALLOWED_EXPERIENCE_IMAGE_MIME_TYPES as readonly string[]).includes(
            mime,
          ) ||
          name.endsWith('.jpg') ||
          name.endsWith('.jpeg') ||
          name.endsWith('.png') ||
          name.endsWith('.webp')
        );
      case ProjectExperienceAssetType.video:
        return (
          (ALLOWED_EXPERIENCE_VIDEO_MIME_TYPES as readonly string[]).includes(
            mime,
          ) ||
          name.endsWith('.mp4') ||
          name.endsWith('.webm') ||
          name.endsWith('.mov')
        );
      case ProjectExperienceAssetType.model_3d:
        return (
          (ALLOWED_EXPERIENCE_MODEL_MIME_TYPES as readonly string[]).includes(
            mime,
          ) ||
          name.endsWith('.glb') ||
          name.endsWith('.gltf')
        );
      case ProjectExperienceAssetType.geojson:
        return (
          (ALLOWED_EXPERIENCE_GEOJSON_MIME_TYPES as readonly string[]).includes(
            mime,
          ) ||
          name.endsWith('.geojson') ||
          name.endsWith('.json')
        );
      default:
        return false;
    }
  }

  private resolveExtension(file: Express.Multer.File): string {
    const fromName = extname(file.originalname ?? '').toLowerCase();
    if (fromName) return fromName;
    if (file.mimetype.includes('png')) return '.png';
    if (file.mimetype.includes('webp')) return '.webp';
    if (file.mimetype.includes('jpeg') || file.mimetype.includes('jpg')) {
      return '.jpg';
    }
    if (file.mimetype.includes('webm')) return '.webm';
    if (file.mimetype.includes('mp4')) return '.mp4';
    if (file.mimetype.includes('gltf')) return '.gltf';
    return '.bin';
  }

  private async createThumbnail(
    buffer: Buffer,
    safeTitle: string,
    timestamp: number,
  ): Promise<string> {
    const thumbName = `exp_res_thumb_${safeTitle}_${timestamp}.webp`;
    const sharp =
      (sharpNamespace as unknown as { default?: typeof sharpNamespace })
        .default ?? sharpNamespace;
    const thumbBuffer = await sharp(buffer)
      .resize(480, 480, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();
    await this.projectImageStorageService.saveFile(thumbBuffer, thumbName);
    return thumbName;
  }
}
