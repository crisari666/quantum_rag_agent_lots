import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ProjectLotKind, ProjectLotStatus } from '../types/project-lot.enums';

export type ProjectLotDocument = ProjectLot & Document;

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

  /** Unit number within the project kind (e.g. "1", "12"). */
  @Prop({ required: true, trim: true })
  number: string;

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
}

export const ProjectLotSchema = SchemaFactory.createForClass(ProjectLot);

ProjectLotSchema.index(
  { projectId: 1, kind: 1, number: 1 },
  { unique: true },
);
