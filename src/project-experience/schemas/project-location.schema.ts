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
export class ProjectLocationRouteGeometry {
  @Prop({ type: String, enum: ['LineString'], required: true })
  type: 'LineString';

  @Prop({ type: [[Number]], required: true })
  coordinates: number[][];
}

@Schema({ _id: false })
export class ProjectLocationRoute {
  @Prop({ type: String, enum: ['driving'], required: true })
  profile: 'driving';

  @Prop({ required: true })
  distanceMeters: number;

  @Prop({ required: true })
  durationSeconds: number;

  @Prop({ type: ProjectLocationRouteGeometry, required: true })
  geometry: ProjectLocationRouteGeometry;
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

  /** Placed map source (experience asset) this place describes. Empty when unset. */
  @Prop({ trim: true, default: '' })
  linkedAssetId: string;

  /** Library resource this place uses. Empty when unset. Does not move the place. */
  @Prop({ trim: true, default: '' })
  linkedResourceId: string;

  /** Meters above the terrain for a linked 3D model. */
  @Prop({ type: Number, default: 0 })
  modelAltitude: number;

  /** Degrees [pitch, heading, roll] for a linked 3D model. */
  @Prop({ type: [Number], default: () => [0, 0, 0] })
  modelRotation: number[];

  /** Color of the driving line from the project to this place. */
  @Prop({ trim: true, default: '#e07a3d' })
  routeColor: string;

  /** solid is one line, double keeps an outline, dashed is a broken line. */
  @Prop({ type: String, enum: ['solid', 'double', 'dashed'], default: 'solid' })
  routeLine: 'solid' | 'double' | 'dashed';

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

  /** Driving line from the project to this place. Null when Directions did not return one. */
  @Prop({ type: ProjectLocationRoute, default: null })
  route: ProjectLocationRoute | null;

  /** When false, the stored driving line stays hidden. */
  @Prop({ default: true })
  showRoute: boolean;

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
