import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Project, ProjectDocument } from './schemas/project.schema';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectImageStorageService } from './services/project-image-storage.service';
import { ListProjectsEnableFilter } from './types/list-projects-enable-filter.type';
import { ProjectDocumentField } from './types/project-document-field.type';
import { ProjectLotOption } from './types/project-lot-option.type';

/**
 * Service responsible for project persistence and business logic.
 */
@Injectable()
export class ProjectsService {
  public constructor(
    @InjectModel(Project.name) private readonly projectModel: Model<ProjectDocument>,
    private readonly projectImageStorageService: ProjectImageStorageService,
  ) {}

  public async create(createProjectDto: CreateProjectDto): Promise<ProjectDocument> {
    const payload = this.mapCreateDtoToDocument(createProjectDto);
    if (payload.slug) {
      await this.ensureProjectSlugAvailable(payload.slug);
    }
    const project = new this.projectModel({ ...payload, enabled: false });
    return project.save();
  }

  public async update(
    id: string,
    updateProjectDto: UpdateProjectDto,
  ): Promise<ProjectDocument> {
    const payload = this.mapUpdateDtoToDocument(updateProjectDto);
    const shouldUnsetSlug =
      updateProjectDto.slug !== undefined &&
      updateProjectDto.slug.trim() === '';
    if (shouldUnsetSlug) {
      delete payload.slug;
    }
    if (payload.slug) {
      await this.ensureProjectSlugAvailable(payload.slug, id);
    }
    const mongoUpdate: Record<string, unknown> = {};
    if (Object.keys(payload).length > 0) {
      mongoUpdate.$set = payload;
    }
    if (shouldUnsetSlug) {
      mongoUpdate.$unset = { slug: '' };
    }
    if (Object.keys(mongoUpdate).length === 0) {
      return this.getById(id);
    }
    const project = await this.projectModel
      .findByIdAndUpdate(id, mongoUpdate, { new: true })
      .populate('amenities', 'title')
      .exec();
    if (!project) {
      throw new NotFoundException(`Project with id ${id} not found`);
    }
    return project;
  }

  public async list(
    enableFilter: ListProjectsEnableFilter,
  ): Promise<ProjectDocument[]> {
    const filter: Record<string, unknown> = { deleted: false };
    if (enableFilter === 'true') {
      filter.enabled = true;
    } else if (enableFilter === 'false') {
      filter.enabled = false;
    }
    return this.projectModel
      .find(filter)
      .populate('amenities', 'title')
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Sets whether a non-deleted project is enabled (visible for consumers when enabled).
   */
  public async setEnabled(
    projectId: string,
    enabled: boolean,
  ): Promise<ProjectDocument> {
    const project = await this.projectModel
      .findOneAndUpdate(
        { _id: projectId, deleted: false },
        { enabled },
        { returnDocument: 'after' },
      )
      .populate('amenities', 'title')
      .exec();
    if (!project) {
      throw new NotFoundException(`Project with id ${projectId} not found`);
    }
    return project;
  }

  public async getById(id: string): Promise<ProjectDocument> {
    const project = await this.projectModel
      .findOne({ _id: id, deleted: false })
      .populate('amenities', 'title')
      .exec();
    if (!project) {
      throw new NotFoundException(`Project with id ${id} not found`);
    }
    return project;
  }

  /**
   * Soft delete: sets deleted flag to true.
   */
  public async remove(id: string): Promise<ProjectDocument> {
    const project = await this.projectModel
      .findByIdAndUpdate(id, { deleted: true }, { new: true })
      .exec();
    if (!project) {
      throw new NotFoundException(`Project with id ${id} not found`);
    }
    return project;
  }

  /**
   * Appends an image filename to the project's images array.
   */
  public async addImage(
    projectId: string,
    imageFileName: string,
  ): Promise<ProjectDocument> {
    const project = await this.projectModel
      .findOne({ _id: projectId, deleted: false })
      .exec();
    if (!project) {
      throw new NotFoundException(`Project with id ${projectId} not found`);
    }
    const images = [...(project.images ?? []), imageFileName];
    const updated = await this.projectModel
      .findByIdAndUpdate(
        projectId,
        { images },
        { new: true },
      )
      .populate('amenities', 'title')
      .exec();
    if (!updated) {
      throw new NotFoundException(`Project with id ${projectId} not found`);
    }
    return updated;
  }

  public async addImages(
    projectId: string,
    imageFileNames: string[],
  ): Promise<ProjectDocument> {
    const project = await this.projectModel
      .findOne({ _id: projectId, deleted: false })
      .exec();
    if (!project) {
      throw new NotFoundException(`Project with id ${projectId} not found`);
    }
    const images = [...(project.images ?? []), ...imageFileNames];
    const updated = await this.projectModel
      .findByIdAndUpdate(projectId, { images }, { new: true })
      .populate('amenities', 'title')
      .exec();
    if (!updated) {
      throw new NotFoundException(`Project with id ${projectId} not found`);
    }
    return updated;
  }

  /**
   * Removes an image from the project's images array and deletes the file from storage.
   */
  public async removeImage(
    projectId: string,
    imageName: string,
  ): Promise<ProjectDocument> {
    const project = await this.projectModel
      .findOne({ _id: projectId, deleted: false })
      .exec();
    if (!project) {
      throw new NotFoundException(`Project with id ${projectId} not found`);
    }
    const images = project.images ?? [];
    const index = images.indexOf(imageName);
    if (index === -1) {
      throw new NotFoundException(
        `Image ${imageName} not found in project ${projectId}`,
      );
    }
    const newImages = images.filter((name) => name !== imageName);
    await this.projectImageStorageService.deleteFile(imageName);
    const updated = await this.projectModel
      .findByIdAndUpdate(
        projectId,
        { images: newImages },
        { new: true },
      )
      .populate('amenities', 'title')
      .exec();
    if (!updated) {
      throw new NotFoundException(`Project with id ${projectId} not found`);
    }
    return updated;
  }

  public async setDocumentFile(
    projectId: string,
    field: ProjectDocumentField,
    fileName: string,
  ): Promise<{ project: ProjectDocument; previousFileName: string }> {
    const project = await this.projectModel
      .findOne({ _id: projectId, deleted: false })
      .exec();
    if (!project) {
      throw new NotFoundException(`Project with id ${projectId} not found`);
    }
    const previousFileName = (project[field] ?? '') as string;
    const updated = await this.projectModel
      .findByIdAndUpdate(projectId, { [field]: fileName }, { new: true })
      .populate('amenities', 'title')
      .exec();
    if (!updated) {
      throw new NotFoundException(`Project with id ${projectId} not found`);
    }
    return { project: updated, previousFileName };
  }

  /**
   * Clears a single-file document field and deletes the stored file when present.
   */
  public async clearDocumentField(
    projectId: string,
    field: ProjectDocumentField,
  ): Promise<ProjectDocument> {
    const project = await this.projectModel
      .findOne({ _id: projectId, deleted: false })
      .exec();
    if (!project) {
      throw new NotFoundException(`Project with id ${projectId} not found`);
    }
    const previousFileName = String(project[field] ?? '').trim();
    if (previousFileName) {
      await this.projectImageStorageService.deleteFile(previousFileName);
    }
    const updated = await this.projectModel
      .findByIdAndUpdate(projectId, { [field]: '' }, { new: true })
      .populate('amenities', 'title')
      .exec();
    if (!updated) {
      throw new NotFoundException(`Project with id ${projectId} not found`);
    }
    return updated;
  }

  /**
   * Clears the card image field and deletes the file from storage when present.
   */
  public async clearCardProject(projectId: string): Promise<ProjectDocument> {
    return this.clearDocumentField(projectId, 'cardProject');
  }

  /**
   * Clears the reel video field and deletes the file from storage when present.
   */
  public async clearReelVideo(projectId: string): Promise<ProjectDocument> {
    return this.clearDocumentField(projectId, 'reelVideo');
  }

  /**
   * Clears the plane document field and deletes the file from storage when present.
   */
  public async clearPlane(projectId: string): Promise<ProjectDocument> {
    return this.clearDocumentField(projectId, 'plane');
  }

  /**
   * Clears the brochure field and deletes the file from storage when present.
   */
  public async clearBrochure(projectId: string): Promise<ProjectDocument> {
    return this.clearDocumentField(projectId, 'brochure');
  }

  /**
   * Ensures slug is not used by another non-deleted project.
   */
  private async ensureProjectSlugAvailable(
    slug: string,
    excludeProjectId?: string,
  ): Promise<void> {
    const filter: Record<string, unknown> = { deleted: false, slug };
    if (excludeProjectId) {
      filter._id = { $ne: excludeProjectId };
    }
    const taken = await this.projectModel.exists(filter).exec();
    if (taken) {
      throw new ConflictException(`Project slug "${slug}" is already in use`);
    }
  }

  private normalizeProjectSlug(
    raw: string | undefined,
  ): string | undefined {
    if (raw === undefined || raw === null) {
      return undefined;
    }
    const trimmed = raw.trim().toLowerCase();
    if (trimmed === '') {
      return undefined;
    }
    return trimmed;
  }

  private mapCreateDtoToDocument(
    dto: CreateProjectDto,
  ): Partial<ProjectDocument> {
    const amenities = (dto.amenities ?? []).map(
      (id) => new Types.ObjectId(id),
    );
    const normalizedSlug = this.normalizeProjectSlug(dto.slug);
    return {
      title: dto.title,
      ...(normalizedSlug !== undefined ? { slug: normalizedSlug } : {}),
      description: dto.description ?? '',
      location: dto.location,
      city: dto.city ?? '',
      state: dto.state ?? '',
      country: dto.country ?? '',
      lat: dto.lat,
      lng: dto.lng,
      priceSell: dto.priceSell,
      separation: dto.separation ?? 0,
      lotOptions: dto.lotOptions,
      commissionPercentage: dto.commissionPercentage,
      commissionValue: dto.commissionValue,
      amenities,
      images: dto.images ?? [],
      cardProject: dto.cardProject ?? '',
      horizontalImages: dto.horizontalImages ?? [],
      verticalVideos: dto.verticalVideos ?? [],
      reelVideo: '',
      plane: '',
      brochure: '',
      deleted: false,
    };
  }

  private mapUpdateDtoToDocument(
    dto: UpdateProjectDto,
  ): Partial<ProjectDocument> {
    const payload: Partial<ProjectDocument> = {};
    if (dto.title !== undefined) payload.title = dto.title;
    if (dto.slug !== undefined) {
      const normalizedSlug = this.normalizeProjectSlug(dto.slug);
      if (normalizedSlug !== undefined) {
        payload.slug = normalizedSlug;
      }
    }
    if (dto.description !== undefined) payload.description = dto.description;
    if (dto.location !== undefined) payload.location = dto.location;
    if (dto.city !== undefined) payload.city = dto.city;
    if (dto.state !== undefined) payload.state = dto.state;
    if (dto.country !== undefined) payload.country = dto.country;
    if (dto.lat !== undefined) payload.lat = dto.lat;
    if (dto.lng !== undefined) payload.lng = dto.lng;
    if (dto.priceSell !== undefined) payload.priceSell = dto.priceSell;
    if (dto.separation !== undefined) payload.separation = dto.separation;
    if (dto.lotOptions !== undefined) {
      payload.lotOptions = dto.lotOptions;
    }
    if (dto.commissionPercentage !== undefined) {
      payload.commissionPercentage = dto.commissionPercentage;
    }
    if (dto.commissionValue !== undefined) {
      payload.commissionValue = dto.commissionValue;
    }
    if (dto.amenities !== undefined) {
      payload.amenities = dto.amenities.map((id) => new Types.ObjectId(id));
    }
    if (dto.images !== undefined) payload.images = dto.images;
    if (dto.cardProject !== undefined) payload.cardProject = dto.cardProject;
    if (dto.horizontalImages !== undefined) {
      payload.horizontalImages = dto.horizontalImages;
    }
    if (dto.verticalVideos !== undefined) payload.verticalVideos = dto.verticalVideos;
    return payload;
  }

  /**
   * Appends a horizontal image filename to the project's horizontalImages array.
   */
  public async addHorizontalImage(
    projectId: string,
    imageFileName: string,
  ): Promise<ProjectDocument> {
    const project = await this.projectModel
      .findOne({ _id: projectId, deleted: false })
      .exec();
    if (!project) {
      throw new NotFoundException(`Project with id ${projectId} not found`);
    }
    const horizontalImages = [...(project.horizontalImages ?? []), imageFileName];
    const updated = await this.projectModel
      .findByIdAndUpdate(projectId, { horizontalImages }, { new: true })
      .populate('amenities', 'title')
      .exec();
    if (!updated) {
      throw new NotFoundException(`Project with id ${projectId} not found`);
    }
    return updated;
  }

  public async addHorizontalImages(
    projectId: string,
    imageFileNames: string[],
  ): Promise<ProjectDocument> {
    const project = await this.projectModel
      .findOne({ _id: projectId, deleted: false })
      .exec();
    if (!project) {
      throw new NotFoundException(`Project with id ${projectId} not found`);
    }
    const horizontalImages = [
      ...(project.horizontalImages ?? []),
      ...imageFileNames,
    ];
    const updated = await this.projectModel
      .findByIdAndUpdate(projectId, { horizontalImages }, { new: true })
      .populate('amenities', 'title')
      .exec();
    if (!updated) {
      throw new NotFoundException(`Project with id ${projectId} not found`);
    }
    return updated;
  }

  /**
   * Removes a horizontal image from the project and deletes the file from storage.
   */
  public async removeHorizontalImage(
    projectId: string,
    imageName: string,
  ): Promise<ProjectDocument> {
    const project = await this.projectModel
      .findOne({ _id: projectId, deleted: false })
      .exec();
    if (!project) {
      throw new NotFoundException(`Project with id ${projectId} not found`);
    }
    const horizontalImages = project.horizontalImages ?? [];
    const index = horizontalImages.indexOf(imageName);
    if (index === -1) {
      throw new NotFoundException(
        `Horizontal image ${imageName} not found in project ${projectId}`,
      );
    }
    const newHorizontalImages = horizontalImages.filter(
      (name) => name !== imageName,
    );
    await this.projectImageStorageService.deleteFile(imageName);
    const updated = await this.projectModel
      .findByIdAndUpdate(
        projectId,
        { horizontalImages: newHorizontalImages },
        { new: true },
      )
      .populate('amenities', 'title')
      .exec();
    if (!updated) {
      throw new NotFoundException(`Project with id ${projectId} not found`);
    }
    return updated;
  }

  public async addVerticalVideo(
    projectId: string,
    videoFileName: string,
  ): Promise<ProjectDocument> {
    const project = await this.projectModel
      .findOne({ _id: projectId, deleted: false })
      .exec();
    if (!project) {
      throw new NotFoundException(`Project with id ${projectId} not found`);
    }
    const verticalVideos = [...(project.verticalVideos ?? []), videoFileName];
    const updated = await this.projectModel
      .findByIdAndUpdate(projectId, { verticalVideos }, { new: true })
      .populate('amenities', 'title')
      .exec();
    if (!updated) {
      throw new NotFoundException(`Project with id ${projectId} not found`);
    }
    return updated;
  }

  public async addVerticalVideos(
    projectId: string,
    videoFileNames: string[],
  ): Promise<ProjectDocument> {
    const project = await this.projectModel
      .findOne({ _id: projectId, deleted: false })
      .exec();
    if (!project) {
      throw new NotFoundException(`Project with id ${projectId} not found`);
    }
    const verticalVideos = [...(project.verticalVideos ?? []), ...videoFileNames];
    const updated = await this.projectModel
      .findByIdAndUpdate(projectId, { verticalVideos }, { new: true })
      .populate('amenities', 'title')
      .exec();
    if (!updated) {
      throw new NotFoundException(`Project with id ${projectId} not found`);
    }
    return updated;
  }

  /**
   * Removes a vertical video from the project and deletes the file from storage.
   */
  public async removeVerticalVideo(
    projectId: string,
    videoFileName: string,
  ): Promise<ProjectDocument> {
    const project = await this.projectModel
      .findOne({ _id: projectId, deleted: false })
      .exec();
    if (!project) {
      throw new NotFoundException(`Project with id ${projectId} not found`);
    }
    const verticalVideos = project.verticalVideos ?? [];
    const index = verticalVideos.indexOf(videoFileName);
    if (index === -1) {
      throw new NotFoundException(
        `Vertical video ${videoFileName} not found in project ${projectId}`,
      );
    }
    const newVerticalVideos = verticalVideos.filter(
      (name) => name !== videoFileName,
    );
    await this.projectImageStorageService.deleteFile(videoFileName);
    const updated = await this.projectModel
      .findByIdAndUpdate(
        projectId,
        { verticalVideos: newVerticalVideos },
        { new: true },
      )
      .populate('amenities', 'title')
      .exec();
    if (!updated) {
      throw new NotFoundException(`Project with id ${projectId} not found`);
    }
    return updated;
  }
}
