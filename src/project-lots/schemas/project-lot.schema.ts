import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ProjectLotKind, ProjectLotStatus } from '../types/project-lot.enums';

export type ProjectLotDocument = ProjectLot & Document;

export const DEFAULT_STAGE_KEY = 'default';
export const DEFAULT_STAGE_NAME = 'General';
export const DEFAULT_STAGE_ORDER = 0;

@Schema({ timestamps: true, collection: 'project_lots' })
export class ProjectLot {
  @Prop({ type: Types.ObjectId, ref: 'Project', required: true, index: true })
  projectId: Types.ObjectId;

  @Prop({
    type: String,
    enum: ProjectLotKind,
    required: true,
    index: true,
  })
  kind: ProjectLotKind;

  /** Unit number within the project kind + stage (e.g. "1", "12"). */
  @Prop({ required: true, trim: true })
  number: string;

  /** Stable stage id (e.g. "default", "1", "etapa-norte"). */
  @Prop({ required: true, trim: true, default: DEFAULT_STAGE_KEY, index: true })
  stageKey: string;

  /** Display name for the stage. */
  @Prop({ required: true, trim: true, default: DEFAULT_STAGE_NAME })
  stageName: string;

  /** Sort order among stages (lower first). */
  @Prop({ required: true, default: DEFAULT_STAGE_ORDER, min: 0 })
  stageOrder: number;

  /** Area in square meters. */
  @Prop({ required: true, min: 0 })
  area: number;

  @Prop({
    type: String,
    enum: ProjectLotStatus,
    default: ProjectLotStatus.available,
    index: true,
  })
  status: ProjectLotStatus;

  /** Sale price in COP. */
  @Prop({ required: true, min: 0 })
  price: number;

  /** Optional customers-ms customer ObjectId (stored as string). */
  @Prop({ trim: true, default: '' })
  soldBy: string;

  /** Optional seller name (may be external to company ventors). */
  @Prop({ trim: true, default: '' })
  ventorName: string;

  /**
   * When status is hold, deadline after which the lot returns to available.
   * Cleared when status is not hold.
   */
  @Prop({ type: Date, default: null })
  holdUntil: Date | null;

  /** Office user id (JWT sub) who placed the current hold, if any. */
  @Prop({ trim: true, default: '' })
  heldByUserId: string;
}

export const ProjectLotSchema = SchemaFactory.createForClass(ProjectLot);

ProjectLotSchema.index(
  { projectId: 1, kind: 1, stageKey: 1, number: 1 },
  { unique: true },
);

ProjectLotSchema.index({ status: 1, holdUntil: 1 });
