import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Project, ProjectDocument } from './schemas/project.schema';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

/**
 * Service responsible for project persistence and business logic.
 */
@Injectable()
export class ProjectsService {
  public constructor(
    @InjectModel(Project.name) private readonly projectModel: Model<ProjectDocument>,
  ) {}

  public async create(createProjectDto: CreateProjectDto): Promise<ProjectDocument> {
    const payload = this.mapCreateDtoToDocument(createProjectDto);
    const project = new this.projectModel(payload);
    return project.save();
  }

  public async update(
    id: string,
    updateProjectDto: UpdateProjectDto,
  ): Promise<ProjectDocument> {
    const payload = this.mapUpdateDtoToDocument(updateProjectDto);
    const project = await this.projectModel
      .findByIdAndUpdate(id, payload, { new: true })
      .populate('amenities', 'title')
      .exec();
    if (!project) {
      throw new NotFoundException(`Project with id ${id} not found`);
    }
    return project;
  }

  public async list(): Promise<ProjectDocument[]> {
    return this.projectModel
      .find({ deleted: false })
      .populate('amenities', 'title')
      .sort({ createdAt: -1 })
      .exec();
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

  private mapCreateDtoToDocument(
    dto: CreateProjectDto,
  ): Partial<ProjectDocument> {
    const amenities = (dto.amenities ?? []).map(
      (id) => new Types.ObjectId(id),
    );
    return {
      title: dto.title,
      location: dto.location,
      lat: dto.lat,
      lng: dto.lng,
      priceSell: dto.priceSell,
      commissionPercentage: dto.commissionPercentage,
      commissionValue: dto.commissionValue,
      amenities,
      images: dto.images ?? [],
      deleted: false,
    };
  }

  private mapUpdateDtoToDocument(
    dto: UpdateProjectDto,
  ): Partial<ProjectDocument> {
    const payload: Partial<ProjectDocument> = {};
    if (dto.title !== undefined) payload.title = dto.title;
    if (dto.location !== undefined) payload.location = dto.location;
    if (dto.lat !== undefined) payload.lat = dto.lat;
    if (dto.lng !== undefined) payload.lng = dto.lng;
    if (dto.priceSell !== undefined) payload.priceSell = dto.priceSell;
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
    return payload;
  }
}
