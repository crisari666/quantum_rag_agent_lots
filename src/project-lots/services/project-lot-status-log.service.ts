import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ProjectLotStatusLog,
  ProjectLotStatusLogDocument,
} from '../schemas/project-lot-status-log.schema';
import type { AppendLotStatusLogInput } from '../types/append-lot-status-log.input';

/**
 * Append-only history of lot status transitions.
 */
@Injectable()
export class ProjectLotStatusLogService {
  public constructor(
    @InjectModel(ProjectLotStatusLog.name)
    private readonly logModel: Model<ProjectLotStatusLogDocument>,
  ) {}

  public async append(
    input: AppendLotStatusLogInput,
  ): Promise<ProjectLotStatusLogDocument> {
    return this.logModel.create({
      projectId: new Types.ObjectId(String(input.projectId)),
      lotId: new Types.ObjectId(String(input.lotId)),
      number: input.number,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      action: input.action,
      actorUserId: (input.actorUserId ?? '').trim(),
      actorLevel:
        input.actorLevel === undefined || input.actorLevel === null
          ? ''
          : String(input.actorLevel),
      note: (input.note ?? '').trim(),
      evidenceFiles: input.evidenceFiles ?? [],
    });
  }

  public async listByLot(params: {
    readonly projectId: string;
    readonly lotId: string;
  }): Promise<ProjectLotStatusLogDocument[]> {
    return this.logModel
      .find({
        projectId: new Types.ObjectId(params.projectId),
        lotId: new Types.ObjectId(params.lotId),
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  public async deleteByProject(projectId: string): Promise<number> {
    const result = await this.logModel
      .deleteMany({ projectId: new Types.ObjectId(projectId) })
      .exec();
    return result.deletedCount;
  }

  public async deleteByLotIds(params: {
    readonly projectId: string;
    readonly lotIds: string[];
  }): Promise<number> {
    if (params.lotIds.length === 0) {
      return 0;
    }
    const result = await this.logModel
      .deleteMany({
        projectId: new Types.ObjectId(params.projectId),
        lotId: { $in: params.lotIds.map((id) => new Types.ObjectId(id)) },
      })
      .exec();
    return result.deletedCount;
  }
}
