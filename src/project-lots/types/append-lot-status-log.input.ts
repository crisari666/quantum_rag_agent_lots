import { Types } from 'mongoose';
import { ProjectLotStatusLogAction } from './project-lot-status-log.enums';

export type AppendLotStatusLogInput = Readonly<{
  projectId: string | Types.ObjectId;
  lotId: string | Types.ObjectId;
  number: string;
  fromStatus: string;
  toStatus: string;
  action: ProjectLotStatusLogAction;
  actorUserId?: string;
  actorLevel?: string | number;
  note?: string;
  evidenceFiles?: string[];
}>;
