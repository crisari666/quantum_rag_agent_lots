import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ProjectLotStatusLogAction } from '../types/project-lot-status-log.enums';

export type ProjectLotStatusLogDocument = ProjectLotStatusLog & Document;

@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'project_lot_status_logs' })
export class ProjectLotStatusLog {
  @Prop({ type: Types.ObjectId, ref: 'Project', required: true, index: true })
  projectId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ProjectLot', required: true, index: true })
  lotId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  number: string;

  @Prop({ required: true, trim: true })
  fromStatus: string;

  @Prop({ required: true, trim: true })
  toStatus: string;

  @Prop({
    type: String,
    enum: ProjectLotStatusLogAction,
    required: true,
    index: true,
  })
  action: ProjectLotStatusLogAction;

  @Prop({ trim: true, default: '' })
  actorUserId: string;

  @Prop({ trim: true, default: '' })
  actorLevel: string;

  @Prop({ trim: true, default: '' })
  note: string;

  @Prop({ type: [String], default: [] })
  evidenceFiles: string[];

  createdAt?: Date;
}

export const ProjectLotStatusLogSchema =
  SchemaFactory.createForClass(ProjectLotStatusLog);

ProjectLotStatusLogSchema.index({ projectId: 1, lotId: 1, createdAt: -1 });
