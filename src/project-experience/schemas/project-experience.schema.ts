import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ProjectExperienceStatus } from '../types/project-experience.enums';
import { DEFAULT_MAP_STYLE } from '../constants/experience-asset-upload.constants';
import {
  ProjectLocationCategory,
  ProjectLocationImportance,
} from '../types/project-location.enums';

export type ProjectExperienceDocument = ProjectExperience & Document;

@Schema({ _id: false })
export class ExperienceCameraSettings {
  @Prop({ required: true })
  longitude: number;

  @Prop({ required: true })
  latitude: number;

  @Prop({ default: 14, min: 0, max: 22 })
  zoom: number;

  @Prop({ default: 60, min: 0, max: 85 })
  pitch: number;

  @Prop({ default: 0, min: -180, max: 180 })
  bearing: number;
}

@Schema({ _id: false })
export class ExperienceRoadsStyle {
  @Prop({ trim: true, default: '#38bdf8' })
  color: string;

  @Prop({ default: 3, min: 1, max: 12 })
  width: number;

  @Prop({ default: 0.95, min: 0.2, max: 1 })
  opacity: number;

  /** solid hides the casing, double keeps the outline, dashed is one broken line. */
  @Prop({ type: String, enum: ['solid', 'double', 'dashed'], default: 'solid' })
  line: 'solid' | 'double' | 'dashed';
}

@Schema({ _id: false })
export class ExperienceMapSettings {
  @Prop({ trim: true, default: DEFAULT_MAP_STYLE })
  styleUrl: string;

  @Prop({ default: 14, min: 0, max: 22 })
  defaultZoom: number;

  @Prop({ default: 60, min: 0, max: 85 })
  pitch: number;

  @Prop({ default: -20, min: -180, max: 180 })
  bearing: number;

  @Prop({ type: Number, default: null })
  centerLongitude: number | null;

  @Prop({ type: Number, default: null })
  centerLatitude: number | null;

  @Prop({ default: true })
  terrainEnabled: boolean;

  @Prop({ default: 1, min: 0, max: 5 })
  terrainExaggeration: number;

  @Prop({ default: false })
  buildings3DEnabled: boolean;

  @Prop({ default: true })
  satelliteEnabled: boolean;

  @Prop({ default: true })
  fogEnabled: boolean;

  @Prop({ type: ExperienceRoadsStyle, default: () => ({}) })
  roadsStyle: ExperienceRoadsStyle;
}

@Schema({ _id: false })
export class ExperienceLayerSettings {
  @Prop({ default: true })
  lots: boolean;

  @Prop({ default: true })
  roads: boolean;

  @Prop({ default: true })
  locations: boolean;

  @Prop({ default: true })
  assets: boolean;

  @Prop({ default: true })
  models3D: boolean;
}

@Schema({ _id: false })
export class ExperiencePoiSettings {
  @Prop({ default: 10_000, min: 1_000, max: 50_000 })
  publicRadiusMeters: number;

  @Prop({
    type: [String],
    enum: ProjectLocationCategory,
    default: [],
  })
  publicCategories: ProjectLocationCategory[];

  @Prop({ default: false })
  liveMapboxEnabled: boolean;

  @Prop({
    type: String,
    enum: ProjectLocationImportance,
    default: ProjectLocationImportance.low,
  })
  minImportance: ProjectLocationImportance;
}

@Schema({ _id: false })
export class AmenityCategoryDefinition {
  @Prop({ required: true, trim: true })
  key: string;

  @Prop({ required: true, trim: true })
  label: string;

  @Prop({ default: 0, min: 0 })
  sortOrder: number;

  /** Marker color as #RRGGBB. Empty lets the player pick a stable fallback. */
  @Prop({ trim: true, default: '' })
  color: string;
}

@Schema({ _id: false })
export class ExperienceSceneNarrative {
  @Prop({ trim: true, default: '' })
  title: string;

  @Prop({ trim: true, default: '' })
  text: string;
}

@Schema({ _id: false })
export class ExperienceScene {
  @Prop({ required: true, trim: true })
  id: string;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ trim: true, default: '' })
  description: string;

  @Prop({ type: ExperienceCameraSettings, required: true })
  camera: ExperienceCameraSettings;

  /** Travel time into this camera, in milliseconds. */
  @Prop({ default: 4000, min: 500 })
  durationMs: number;

  @Prop({ type: [String], default: [] })
  visibleLayers: string[];

  @Prop({ type: [String], default: [] })
  locationIds: string[];

  @Prop({ type: [String], default: [] })
  assetIds: string[];

  @Prop({ type: ExperienceSceneNarrative, default: null })
  narrative: ExperienceSceneNarrative | null;

  @Prop({ default: 0, min: 0 })
  sortOrder: number;
}

@Schema({ timestamps: true, collection: 'project_experiences' })
export class ProjectExperience {
  @Prop({
    type: Types.ObjectId,
    ref: 'Project',
    required: true,
    unique: true,
    index: true,
  })
  projectId: Types.ObjectId;

  @Prop({
    type: String,
    enum: ProjectExperienceStatus,
    default: ProjectExperienceStatus.draft,
    index: true,
  })
  status: ProjectExperienceStatus;

  @Prop({ default: 1, min: 1 })
  version: number;

  @Prop({ type: ExperienceMapSettings, default: () => ({}) })
  settings: ExperienceMapSettings;

  @Prop({ type: ExperienceLayerSettings, default: () => ({}) })
  layers: ExperienceLayerSettings;

  @Prop({ type: ExperiencePoiSettings, default: () => ({}) })
  poi: ExperiencePoiSettings;

  /** Visitor amenity groups defined by this project (not the Mapbox POI enum). */
  @Prop({ type: [AmenityCategoryDefinition], default: [] })
  amenityCategories: AmenityCategoryDefinition[];

  @Prop({ type: [ExperienceScene], default: [] })
  scenes: ExperienceScene[];

  @Prop({ type: Object, default: null })
  publishedSnapshot: Record<string, unknown> | null;

  @Prop({ type: Date, default: null })
  publishedAt: Date | null;

  @Prop({ type: Number, default: null })
  publishedVersion: number | null;
}

export const ProjectExperienceSchema =
  SchemaFactory.createForClass(ProjectExperience);
