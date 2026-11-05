import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  ProjectLocationCategory,
  ProjectLocationGeometryType,
  ProjectLocationImportance,
  ProjectLocationSource,
} from '../types/project-location.enums';

export type ProjectLocationDocument = ProjectLocation & Document;

@Schema({ _id: false })
export class ProjectLocationMedia {
  @Prop({ trim: true, default: '' })
  cover: string;

  @Prop({ type: [String], default: [] })
  gallery: string[];

  @Prop({ trim: true, default: '' })
  video: string;
}

@Schema({ _id: false })
export class ProjectLocationGeometry {
  @Prop({
    type: String,
    enum: ProjectLocationGeometryType,
    required: true,
  })
  type: ProjectLocationGeometryType;

  @Prop({ type: Object, required: true })
  coordinates: unknown;
}

@Schema({ timestamps: true, collection: 'project_locations' })
export class ProjectLocation {
  @Prop({ type: Types.ObjectId, ref: 'Project', required: true, index: true })
  projectId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true, default: '' })
  description: string;

  /** Short line under the name in the public amenities list. */
  @Prop({ trim: true, default: '' })
  subtitle: string;

  @Prop({
    type: String,
    enum: ProjectLocationCategory,
    required: true,
    index: true,
  })
  category: ProjectLocationCategory;

  /** Project amenity category key. Empty until an author assigns one. */
  @Prop({ trim: true, default: '' })
  categoryKey: string;

  /** Experience panorama asset id. Empty when this amenity is not a 360 photo. */
  @Prop({ trim: true, default: '' })
  panoramaAssetId: string;

  @Prop({ type: ProjectLocationGeometry, required: true })
  geometry: ProjectLocationGeometry;

  @Prop({
    type: String,
    enum: ProjectLocationSource,
    default: ProjectLocationSource.manual,
    index: true,
  })
  source: ProjectLocationSource;

  @Prop({ trim: true, default: '' })
  sourceId: string;

  @Prop({
    type: String,
    enum: ProjectLocationImportance,
    default: ProjectLocationImportance.medium,
  })
  importance: ProjectLocationImportance;

  @Prop({ type: ProjectLocationMedia, default: () => ({}) })
  media: ProjectLocationMedia;

  @Prop({ type: Number, default: null })
  distanceMeters: number | null;

  @Prop({ type: Number, default: null })
  roadDistanceMeters: number | null;

  @Prop({ type: Number, default: null })
  estimatedTravelMinutes: number | null;

  @Prop({ default: true })
  isVisible: boolean;

  @Prop({ default: false })
  isVerified: boolean;

  @Prop({ type: Date, default: null })
  verifiedAt: Date | null;

  @Prop({ trim: true, default: '' })
  verifiedByUserId: string;

  @Prop({ default: 0, min: 0 })
  sortOrder: number;

  @Prop({ trim: true, default: '' })
  attribution: string;
}

export const ProjectLocationSchema =
  SchemaFactory.createForClass(ProjectLocation);

ProjectLocationSchema.index({ projectId: 1, category: 1 });
ProjectLocationSchema.index({ projectId: 1, source: 1, sourceId: 1 });
ProjectLocationSchema.index({ 'geometry': '2dsphere' });
