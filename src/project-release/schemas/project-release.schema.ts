import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ProjectReleaseDocument = ProjectRelease & Document;

@Schema({ timestamps: true, collection: 'project_releases' })
export class ProjectRelease {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, trim: true })
  googleMapLocation: string;

  @Prop({ required: true, trim: true })
  location: string;

  @Prop({ trim: true, default: '' })
  description: string;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ default: true })
  enabled: boolean;
}

export const ProjectReleaseSchema =
  SchemaFactory.createForClass(ProjectRelease);
