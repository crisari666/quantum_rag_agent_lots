import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ProjectRelease,
  ProjectReleaseDocument,
} from './schemas/project-release.schema';
import { CreateProjectReleaseDto } from './dto/create-project-release.dto';
import { UpdateProjectReleaseDto } from './dto/update-project-release.dto';
import { ProjectReleaseImageStorageService } from './services/project-release-image-storage.service';
import { ProjectReleaseListStatus } from './types/project-release-list-status.type';

export type ProjectReleaseResponse = Record<string, unknown> & {
  status: ProjectReleaseListStatus;
};

@Injectable()
export class ProjectReleaseService {
  public constructor(
    @InjectModel(ProjectRelease.name)
    private readonly projectReleaseModel: Model<ProjectReleaseDocument>,
    private readonly projectReleaseImageStorageService: ProjectReleaseImageStorageService,
  ) {}

  public toResponse(release: ProjectReleaseDocument): ProjectReleaseResponse {
    const obj = release.toObject();
    return {
      ...obj,
      status: obj.enabled ? 'enabled' : 'disabled',
    };
  }

  public async create(
    dto: CreateProjectReleaseDto,
  ): Promise<ProjectReleaseResponse> {
    const enabled = dto.enabled ?? true;
    const doc = new this.projectReleaseModel({
      title: dto.title,
      googleMapLocation: dto.googleMapLocation,
      location: dto.location,
      description: dto.description ?? '',
      images: dto.images ?? [],
      enabled,
    });
    const saved = await doc.save();
    return this.toResponse(saved);
  }

  public async update(
    id: string,
    dto: UpdateProjectReleaseDto,
  ): Promise<ProjectReleaseResponse> {
    const mongoUpdate: Record<string, unknown> = {};
    if (dto.title !== undefined) mongoUpdate.title = dto.title;
    if (dto.googleMapLocation !== undefined) {
      mongoUpdate.googleMapLocation = dto.googleMapLocation;
    }
    if (dto.location !== undefined) mongoUpdate.location = dto.location;
    if (dto.description !== undefined) mongoUpdate.description = dto.description;
    if (dto.images !== undefined) mongoUpdate.images = dto.images;
    if (dto.enabled !== undefined) mongoUpdate.enabled = dto.enabled;
    if (Object.keys(mongoUpdate).length === 0) {
      return this.getById(id);
    }
    const updated = await this.projectReleaseModel
      .findByIdAndUpdate(id, mongoUpdate, { new: true })
      .exec();
    if (!updated) {
      throw new NotFoundException(`Project release with id ${id} not found`);
    }
    return this.toResponse(updated);
  }

  public async setEnabled(
    id: string,
    enabled: boolean,
  ): Promise<ProjectReleaseResponse> {
    const updated = await this.projectReleaseModel
      .findByIdAndUpdate(id, { enabled }, { new: true })
      .exec();
    if (!updated) {
      throw new NotFoundException(`Project release with id ${id} not found`);
    }
    return this.toResponse(updated);
  }

  public async list(status: ProjectReleaseListStatus): Promise<ProjectReleaseResponse[]> {
    const filter = { enabled: status === 'enabled' };
    const rows = await this.projectReleaseModel
      .find(filter)
      .sort({ createdAt: -1 })
      .exec();
    return rows.map((r) => this.toResponse(r));
  }

  public async getById(id: string): Promise<ProjectReleaseResponse> {
    const release = await this.projectReleaseModel.findById(id).exec();
    if (!release) {
      throw new NotFoundException(`Project release with id ${id} not found`);
    }
    return this.toResponse(release);
  }

  /**
   * Internal: returns Mongoose document for image flows (filename uses title).
   */
  public async getDocumentById(id: string): Promise<ProjectReleaseDocument> {
    const release = await this.projectReleaseModel.findById(id).exec();
    if (!release) {
      throw new NotFoundException(`Project release with id ${id} not found`);
    }
    return release;
  }

  public async addImage(
    releaseId: string,
    imageFileName: string,
  ): Promise<ProjectReleaseResponse> {
    const release = await this.projectReleaseModel.findById(releaseId).exec();
    if (!release) {
      throw new NotFoundException(`Project release with id ${releaseId} not found`);
    }
    const images = [...(release.images ?? []), imageFileName];
    const updated = await this.projectReleaseModel
      .findByIdAndUpdate(releaseId, { images }, { new: true })
      .exec();
    if (!updated) {
      throw new NotFoundException(`Project release with id ${releaseId} not found`);
    }
    return this.toResponse(updated);
  }

  public async removeImage(
    releaseId: string,
    imageName: string,
  ): Promise<ProjectReleaseResponse> {
    const release = await this.projectReleaseModel.findById(releaseId).exec();
    if (!release) {
      throw new NotFoundException(`Project release with id ${releaseId} not found`);
    }
    const images = release.images ?? [];
    if (!images.includes(imageName)) {
      throw new NotFoundException(
        `Image ${imageName} not found in project release ${releaseId}`,
      );
    }
    const newImages = images.filter((name) => name !== imageName);
    await this.projectReleaseImageStorageService.deleteFile(imageName);
    const updated = await this.projectReleaseModel
      .findByIdAndUpdate(releaseId, { images: newImages }, { new: true })
      .exec();
    if (!updated) {
      throw new NotFoundException(`Project release with id ${releaseId} not found`);
    }
    return this.toResponse(updated);
  }

  public parseListStatus(raw: string | undefined): ProjectReleaseListStatus {
    if (raw === undefined || raw.trim() === '') {
      throw new BadRequestException(
        'Query "status" is required and must be "enabled" or "disabled".',
      );
    }
    const normalized = raw.trim().toLowerCase();
    if (normalized !== 'enabled' && normalized !== 'disabled') {
      throw new BadRequestException(
        'Query "status" must be "enabled" or "disabled".',
      );
    }
    return normalized as ProjectReleaseListStatus;
  }
}
