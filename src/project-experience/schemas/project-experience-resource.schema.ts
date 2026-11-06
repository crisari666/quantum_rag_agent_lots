import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ProjectExperienceAssetType } from '../types/project-experience.enums';

export type ProjectExperienceResourceDocument = ProjectExperienceResource &
  Document;

@Schema({ timestamps: true, collection: 'project_experience_resources' })
export class ProjectExperienceResource {
  @Prop({ type: Types.ObjectId, ref: 'Project', required: true, index: true })
  projectId: Types.ObjectId;

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

  /** Absolute URL of the library file. Saved when the resource is uploaded. */
  @Prop({ trim: true, default: '' })
  url: string;

  @Prop({ trim: true, default: '' })
  thumbnailFileName: string;

  /** Absolute URL of the thumbnail, when one exists. */
  @Prop({ trim: true, default: '' })
  thumbnailUrl: string;

  @Prop({ default: 0, min: 0 })
  sizeBytes: number;

  @Prop({ trim: true, default: '' })
  mimeType: string;
}

export const ProjectExperienceResourceSchema = SchemaFactory.createForClass(
  ProjectExperienceResource,
);

ProjectExperienceResourceSchema.index({ projectId: 1, type: 1 });
