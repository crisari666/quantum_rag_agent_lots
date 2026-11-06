import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ProjectExperienceAssetType } from '../types/project-experience.enums';

export type ProjectExperienceAssetDocument = ProjectExperienceAsset & Document;

@Schema({ _id: false })
export class ExperienceAssetPosition {
  @Prop({ required: true })
  longitude: number;

  @Prop({ required: true })
  latitude: number;

  @Prop({ type: Number, default: null })
  altitude: number | null;
}

@Schema({ _id: false })
export class ExperienceAssetTransform {
  @Prop({ type: [Number], default: [0, 0, 0] })
  rotation: number[];

  @Prop({ default: 1, min: 0.01 })
  scale: number;
}

@Schema({ timestamps: true, collection: 'project_experience_assets' })
export class ProjectExperienceAsset {
  @Prop({ type: Types.ObjectId, ref: 'Project', required: true, index: true })
  projectId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'ProjectExperienceResource',
    required: false,
    index: true,
    default: null,
  })
  resourceId: Types.ObjectId | null;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({
    type: String,
    enum: ProjectExperienceAssetType,
    required: true,
    index: true,
  })
  type: ProjectExperienceAssetType;

  @Prop({ required: true, trim: true })
  fileName: string;

  /** Absolute URL copied from the library resource (or set on direct upload). */
  @Prop({ trim: true, default: '' })
  url: string;

  @Prop({ trim: true, default: '' })
  thumbnailFileName: string;

  /** Absolute thumbnail URL copied from the library resource. */
  @Prop({ trim: true, default: '' })
  thumbnailUrl: string;

  @Prop({ type: ExperienceAssetPosition, required: true })
  position: ExperienceAssetPosition;

  @Prop({ type: ExperienceAssetTransform, default: () => ({}) })
  transform: ExperienceAssetTransform;

  @Prop({ default: true })
  visible: boolean;

  @Prop({ default: 0, min: 0 })
  sortOrder: number;

  @Prop({ default: 0, min: 0 })
  sizeBytes: number;

  @Prop({ trim: true, default: '' })
  mimeType: string;
}

export const ProjectExperienceAssetSchema = SchemaFactory.createForClass(
  ProjectExperienceAsset,
);

ProjectExperienceAssetSchema.index({ projectId: 1, type: 1 });
ProjectExperienceAssetSchema.index({ projectId: 1, resourceId: 1 });
