import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OFFICE_USER_LEVEL } from '../core/constants/office-user-level.constants';
import { ProjectsService } from '../projects/projects.service';
import { ProjectDocument } from '../projects/schemas/project.schema';
import { HoldProjectLotDto } from './dto/hold-project-lot.dto';
import {
  BulkUpdateLotStatusDto,
  GenerateProjectLotsDto,
  UpdateProjectLotDto,
} from './dto/project-lot.dto';
import {
  DEFAULT_STAGE_KEY,
  DEFAULT_STAGE_NAME,
  DEFAULT_STAGE_ORDER,
  ProjectLot,
  ProjectLotDocument,
} from './schemas/project-lot.schema';
import { ProjectLotKind, ProjectLotStatus } from './types/project-lot.enums';
import type {
  LotKindSummary,
  LotStatusSummary,
  ProjectLotInventoryRow,
  PublicProjectLot,
} from './types/project-lot-summary.type';
import { ProjectLotExcelParserService } from './services/project-lot-excel-parser.service';
import { ProjectLotStatusLogService } from './services/project-lot-status-log.service';
import { ProjectLotStatusLogAction } from './types/project-lot-status-log.enums';
import { ProjectImageStorageService } from '../projects/services/project-image-storage.service';
import { ProjectLotStatusLogDocument } from './schemas/project-lot-status-log.schema';

export type ListLotsResult = Readonly<{
  lots: ProjectLotDocument[];
  summary: LotKindSummary;
}>;

export type PublicLotsResult = Readonly<{
  projectId: string;
  projectTitle: string;
  lots: PublicProjectLot[];
  summary: LotKindSummary;
}>;

export type ImportLotsResult = Readonly<{
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}>;

export type GenerateLotsResult = Readonly<{
  createdLots: number;
  createdCommercial: number;
  project: ProjectDocument;
}>;

const HOLD_DEFAULT_MS = 24 * 60 * 60 * 1000;
const HOLD_EXTERNAL_AGENT_MS = 72 * 60 * 60 * 1000;

/**
 * Inventory of physical lots and commercial spaces per project.
 */
@Injectable()
export class ProjectLotsService implements OnModuleInit {
  public constructor(
    @InjectModel(ProjectLot.name)
    private readonly projectLotModel: Model<ProjectLotDocument>,
    @Inject(forwardRef(() => ProjectsService))
    private readonly projectsService: ProjectsService,
    private readonly excelParser: ProjectLotExcelParserService,
    private readonly statusLogService: ProjectLotStatusLogService,
    @Inject(forwardRef(() => ProjectImageStorageService))
    private readonly imageStorageService: ProjectImageStorageService,
  ) {}

  public async onModuleInit(): Promise<void> {
    try {
      await this.projectLotModel.collection.dropIndex(
        'projectId_1_kind_1_number_1',
      );
    } catch {
      // Index may already be absent after migration.
    }
  }

  public async listInventoryHub(): Promise<ProjectLotInventoryRow[]> {
    await this.releaseExpiredHolds();
    const projects = await this.projectsService.list('all');
    const summaries = await this.buildSummariesByProjectIds(
      projects.map((p) => String(p._id)),
    );
    return projects.map((p) => {
      const projectId = String(p._id);
      return {
        projectId,
        title: p.title,
        enabled: Boolean(p.enabled),
        nLots: p.nLots ?? 0,
        nCommercialSpaces: p.nCommercialSpaces ?? 0,
        baseLotArea: p.baseLotArea ?? 0,
        baseCommercialArea: p.baseCommercialArea ?? 0,
        summary: summaries.get(projectId) ?? this.emptyKindSummary(),
      };
    });
  }

  public async listByProject(
    projectId: string,
    kind: ProjectLotKind | 'all' = 'all',
    stageKey?: string,
  ): Promise<ListLotsResult> {
    await this.projectsService.getById(projectId);
    await this.releaseExpiredHolds(projectId);
    await this.backfillMissingStages(projectId);
    const filter: Record<string, unknown> = {
      projectId: new Types.ObjectId(projectId),
    };
    if (kind !== 'all') {
      filter.kind = kind;
    }
    if (stageKey !== undefined && stageKey.trim() !== '') {
      filter.stageKey = stageKey.trim();
    }
    const lots = await this.projectLotModel
      .find(filter)
      .sort({ kind: 1, stageOrder: 1, stageKey: 1, number: 1 })
      .exec();
    lots.sort((a, b) => this.compareLotsByStageAndNumber(a, b));
    const summary = await this.buildSummaryForProject(projectId);
    return { lots, summary };
  }

  /**
   * Deletes all inventory units for a project so Excel can be re-imported.
   */
  public async deleteInventory(
    projectId: string,
    kind: ProjectLotKind | 'all' = 'all',
  ): Promise<{ deletedLots: number; deletedLogs: number }> {
    await this.projectsService.getById(projectId);
    const lotFilter: Record<string, unknown> = {
      projectId: new Types.ObjectId(projectId),
    };
    if (kind !== 'all') {
      lotFilter.kind = kind;
    }
    const lots = await this.projectLotModel.find(lotFilter).select('_id').exec();
    const lotIds = lots.map((lot) => lot._id);
    const lotsResult = await this.projectLotModel.deleteMany(lotFilter).exec();
    let deletedLogs = 0;
    if (kind === 'all') {
      deletedLogs = await this.statusLogService.deleteByProject(projectId);
    } else if (lotIds.length > 0) {
      deletedLogs = await this.statusLogService.deleteByLotIds({
        projectId,
        lotIds: lotIds.map((id) => String(id)),
      });
    }
    return {
      deletedLots: lotsResult.deletedCount,
      deletedLogs,
    };
  }

  public async listPublic(
    projectId: string,
    kind: ProjectLotKind | 'all' = 'all',
    stageKey?: string,
  ): Promise<PublicLotsResult> {
    const { lots, summary } = await this.listByProject(
      projectId,
      kind,
      stageKey,
    );
    const project = await this.projectsService.getById(projectId);
    return {
      projectId,
      projectTitle: project.title,
      summary,
      lots: lots.map((lot) => ({
        id: String(lot._id),
        number: lot.number,
        area: lot.area,
        price: lot.price,
        status: lot.status,
        kind: lot.kind,
        ventorName: lot.ventorName ?? '',
        heldByUserId: lot.heldByUserId ?? '',
        holdUntil: lot.holdUntil ? lot.holdUntil.toISOString() : null,
        stageKey: lot.stageKey ?? DEFAULT_STAGE_KEY,
        stageName: lot.stageName ?? DEFAULT_STAGE_NAME,
        stageOrder: lot.stageOrder ?? DEFAULT_STAGE_ORDER,
      })),
    };
  }

  public async generate(
    projectId: string,
    dto: GenerateProjectLotsDto,
  ): Promise<GenerateLotsResult> {
    const project = await this.projectsService.getById(projectId);
    const nLots = dto.nLots ?? project.nLots ?? 0;
    const nCommercial =
      dto.nCommercialSpaces ?? project.nCommercialSpaces ?? 0;
    const baseLotArea = dto.baseLotArea ?? project.baseLotArea ?? 0;
    const baseCommercialArea =
      dto.baseCommercialArea ?? project.baseCommercialArea ?? 0;
    const defaultLotPrice =
      dto.defaultLotPrice ??
      (project.defaultLotPrice > 0
        ? project.defaultLotPrice
        : project.priceSell);
    const defaultCommercialPrice =
      dto.defaultCommercialPrice ??
      (project.defaultCommercialPrice > 0
        ? project.defaultCommercialPrice
        : project.priceSell);
    if (nLots <= 0 && nCommercial <= 0) {
      throw new BadRequestException(
        'Set nLots and/or nCommercialSpaces before generating inventory',
      );
    }
    if (nLots > 0 && baseLotArea <= 0) {
      throw new BadRequestException(
        'baseLotArea must be greater than 0 when generating lots',
      );
    }
    if (nCommercial > 0 && baseCommercialArea <= 0) {
      throw new BadRequestException(
        'baseCommercialArea must be greater than 0 when generating commercial spaces',
      );
    }
    await this.assertCanShrinkCounts(projectId, nLots, nCommercial);
    await this.projectsService.update(projectId, {
      nLots,
      nCommercialSpaces: nCommercial,
      baseLotArea,
      baseCommercialArea,
      defaultLotPrice,
      defaultCommercialPrice,
    });
    const createdLots = await this.createMissingUnits({
      projectId,
      kind: ProjectLotKind.lot,
      count: nLots,
      area: baseLotArea,
      price: defaultLotPrice,
    });
    const createdCommercial = await this.createMissingUnits({
      projectId,
      kind: ProjectLotKind.commercial,
      count: nCommercial,
      area: baseCommercialArea,
      price: defaultCommercialPrice,
    });
    const updatedProject = await this.projectsService.getById(projectId);
    return { createdLots, createdCommercial, project: updatedProject };
  }

  public async updateLot(
    projectId: string,
    lotId: string,
    dto: UpdateProjectLotDto,
    actor?: { readonly userId: string; readonly level?: number },
  ): Promise<ProjectLotDocument> {
    await this.projectsService.getById(projectId);
    await this.releaseExpiredHolds(projectId);
    const existing = await this.projectLotModel
      .findOne({ _id: lotId, projectId: new Types.ObjectId(projectId) })
      .exec();
    if (!existing) {
      throw new NotFoundException(
        `Lot ${lotId} not found in project ${projectId}`,
      );
    }
    const nextStatus = dto.status ?? existing.status;
    const setPayload: Record<string, unknown> = {};
    const unsetPayload: Record<string, unknown> = {};
    if (dto.area !== undefined) setPayload.area = dto.area;
    if (dto.price !== undefined) setPayload.price = dto.price;
    if (dto.status !== undefined) setPayload.status = dto.status;
    if (dto.ventorName !== undefined) setPayload.ventorName = dto.ventorName.trim();
    if (dto.soldBy !== undefined) setPayload.soldBy = dto.soldBy.trim();
    if (dto.stageKey !== undefined) {
      setPayload.stageKey = this.normalizeStageKey(dto.stageKey);
    }
    if (dto.stageName !== undefined) {
      setPayload.stageName = this.normalizeStageName(
        dto.stageName,
        String(setPayload.stageKey ?? existing.stageKey ?? DEFAULT_STAGE_KEY),
      );
    }
    if (dto.stageOrder !== undefined) {
      setPayload.stageOrder = dto.stageOrder;
    }
    if (nextStatus === ProjectLotStatus.hold) {
      setPayload.holdUntil = this.resolveHoldUntil(dto.holdUntil);
    } else if (dto.status !== undefined || dto.holdUntil !== undefined) {
      setPayload.holdUntil = null;
      setPayload.heldByUserId = '';
    }
    const update: Record<string, unknown> = {};
    if (Object.keys(setPayload).length > 0) {
      update.$set = setPayload;
    }
    if (Object.keys(unsetPayload).length > 0) {
      update.$unset = unsetPayload;
    }
    const lot = await this.projectLotModel
      .findOneAndUpdate(
        { _id: lotId, projectId: new Types.ObjectId(projectId) },
        update,
        { new: true },
      )
      .exec();
    if (!lot) {
      throw new NotFoundException(
        `Lot ${lotId} not found in project ${projectId}`,
      );
    }
    if (dto.status !== undefined && existing.status !== lot.status) {
      await this.statusLogService.append({
        projectId,
        lotId: String(lot._id),
        number: lot.number,
        fromStatus: existing.status,
        toStatus: lot.status,
        action: ProjectLotStatusLogAction.update,
        actorUserId: actor?.userId ?? '',
        actorLevel: actor?.level,
      });
    }
    return lot;
  }

  public async bulkUpdateStatus(
    projectId: string,
    dto: BulkUpdateLotStatusDto,
    actor?: { readonly userId: string; readonly level?: number },
  ): Promise<{ modifiedCount: number }> {
    await this.projectsService.getById(projectId);
    await this.releaseExpiredHolds(projectId);
    if (!dto.lotIds?.length) {
      throw new BadRequestException('lotIds must not be empty');
    }
    const objectIds = dto.lotIds.map((id) => new Types.ObjectId(id));
    const beforeLots = await this.projectLotModel
      .find({
        projectId: new Types.ObjectId(projectId),
        _id: { $in: objectIds },
      })
      .exec();
    const setPayload: Record<string, unknown> = { status: dto.status };
    if (dto.ventorName !== undefined) {
      setPayload.ventorName = dto.ventorName.trim();
    }
    if (dto.soldBy !== undefined) {
      setPayload.soldBy = dto.soldBy.trim();
    }
    if (dto.status === ProjectLotStatus.hold) {
      setPayload.holdUntil = this.resolveHoldUntil(dto.holdUntil);
    } else {
      setPayload.holdUntil = null;
      setPayload.heldByUserId = '';
    }
    const result = await this.projectLotModel
      .updateMany(
        {
          projectId: new Types.ObjectId(projectId),
          _id: { $in: objectIds },
        },
        { $set: setPayload },
      )
      .exec();
    const changed = beforeLots.filter((lot) => lot.status !== dto.status);
    await Promise.all(
      changed.map((lot) =>
        this.statusLogService.append({
          projectId,
          lotId: String(lot._id),
          number: lot.number,
          fromStatus: lot.status,
          toStatus: dto.status,
          action: ProjectLotStatusLogAction.bulk,
          actorUserId: actor?.userId ?? '',
          actorLevel: actor?.level,
        }),
      ),
    );
    return { modifiedCount: result.modifiedCount };
  }

  public async importFromExcel(
    projectId: string,
    buffer: Buffer,
    kind: ProjectLotKind = ProjectLotKind.lot,
  ): Promise<ImportLotsResult> {
    const project = await this.projectsService.getById(projectId);
    const parsed = await this.excelParser.parseWorkbook(buffer);
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [...parsed.errors];
    let maxNumber = 0;
    for (const row of parsed.rows) {
      const numeric = parseInt(row.number, 10);
      if (Number.isFinite(numeric) && numeric > maxNumber) {
        maxNumber = numeric;
      }
      let existing = await this.projectLotModel
        .findOne({
          projectId: new Types.ObjectId(projectId),
          kind,
          stageKey: row.stageKey,
          number: row.number,
        })
        .exec();
      if (!existing && row.stageKey === '1') {
        existing = await this.projectLotModel
          .findOne({
            projectId: new Types.ObjectId(projectId),
            kind,
            stageKey: DEFAULT_STAGE_KEY,
            number: row.number,
          })
          .exec();
      }
      if (existing) {
        const setFields: Record<string, unknown> = {
          area: row.area,
          price: row.price,
          status: row.status,
          ventorName: row.ventorName,
          stageKey: row.stageKey,
          stageName: row.stageName,
          stageOrder: row.stageOrder,
        };
        if (row.status === ProjectLotStatus.hold) {
          setFields.holdUntil = this.defaultHoldUntil();
        } else {
          setFields.holdUntil = null;
        }
        await this.projectLotModel
          .updateOne({ _id: existing._id }, { $set: setFields })
          .exec();
        updated += 1;
      } else {
        await this.projectLotModel.create({
          projectId: new Types.ObjectId(projectId),
          kind,
          number: row.number,
          stageKey: row.stageKey,
          stageName: row.stageName,
          stageOrder: row.stageOrder,
          area: row.area,
          price: row.price,
          status: row.status,
          ventorName: row.ventorName,
          soldBy: '',
          holdUntil:
            row.status === ProjectLotStatus.hold
              ? this.defaultHoldUntil()
              : null,
        });
        created += 1;
      }
    }
    if (maxNumber > 0) {
      if (kind === ProjectLotKind.lot && maxNumber > (project.nLots ?? 0)) {
        await this.projectsService.update(projectId, { nLots: maxNumber });
      }
      if (
        kind === ProjectLotKind.commercial &&
        maxNumber > (project.nCommercialSpaces ?? 0)
      ) {
        await this.projectsService.update(projectId, {
          nCommercialSpaces: maxNumber,
        });
      }
    }
    if (parsed.rows.length === 0 && errors.length === 0) {
      skipped = 0;
    }
    return { created, updated, skipped, errors };
  }

  /**
   * Compact stock summary for agent list_projects (by project ids).
   */
  public async getStockSummariesForProjects(
    projectIds: readonly string[],
  ): Promise<Map<string, LotKindSummary>> {
    return this.buildSummariesByProjectIds([...projectIds]);
  }

  /**
   * Public-safe lot rows for the agent tool.
   */
  public async listForAgent(params: {
    readonly projectIds: readonly string[];
    readonly kind?: ProjectLotKind;
    readonly status?: ProjectLotStatus;
  }): Promise<
    ReadonlyArray<{
      projectId: string;
      kind: string;
      number: string;
      area: number;
      price: number;
      status: string;
    }>
  > {
    if (!params.projectIds.length) {
      return [];
    }
    await this.releaseExpiredHolds();
    const filter: Record<string, unknown> = {
      projectId: {
        $in: params.projectIds.map((id) => new Types.ObjectId(id)),
      },
    };
    if (params.kind) {
      filter.kind = params.kind;
    }
    if (params.status) {
      filter.status = params.status;
    }
    const lots = await this.projectLotModel
      .find(filter)
      .sort({ projectId: 1, kind: 1, stageOrder: 1, stageKey: 1, number: 1 })
      .limit(500)
      .exec();
    lots.sort((a, b) => {
      const projectDiff = String(a.projectId).localeCompare(String(b.projectId));
      if (projectDiff !== 0) {
        return projectDiff;
      }
      return this.compareLotsByStageAndNumber(a, b);
    });
    return lots.map((lot) => ({
      projectId: String(lot.projectId),
      kind: lot.kind,
      number: lot.number,
      area: lot.area,
      price: lot.price,
      status: lot.status,
      stageKey: lot.stageKey ?? DEFAULT_STAGE_KEY,
      stageName: lot.stageName ?? DEFAULT_STAGE_NAME,
      stageOrder: lot.stageOrder ?? DEFAULT_STAGE_ORDER,
    }));
  }

  private async createMissingUnits(params: {
    readonly projectId: string;
    readonly kind: ProjectLotKind;
    readonly count: number;
    readonly area: number;
    readonly price: number;
  }): Promise<number> {
    if (params.count <= 0) {
      return 0;
    }
    const existing = await this.projectLotModel
      .find({
        projectId: new Types.ObjectId(params.projectId),
        kind: params.kind,
        stageKey: DEFAULT_STAGE_KEY,
      })
      .select('number')
      .lean()
      .exec();
    const existingNumbers = new Set(existing.map((e) => e.number));
    const toCreate: Partial<ProjectLot>[] = [];
    for (let i = 1; i <= params.count; i += 1) {
      const number = String(i);
      if (existingNumbers.has(number)) {
        continue;
      }
      toCreate.push({
        projectId: new Types.ObjectId(params.projectId),
        kind: params.kind,
        number,
        stageKey: DEFAULT_STAGE_KEY,
        stageName: DEFAULT_STAGE_NAME,
        stageOrder: DEFAULT_STAGE_ORDER,
        area: params.area,
        price: params.price,
        status: ProjectLotStatus.available,
        soldBy: '',
        ventorName: '',
        holdUntil: null,
      });
    }
    if (toCreate.length === 0) {
      return 0;
    }
    await this.projectLotModel.insertMany(toCreate);
    return toCreate.length;
  }

  /**
   * One-time backfill for lots missing stage fields (legacy rows).
   */
  private async backfillMissingStages(projectId: string): Promise<void> {
    await this.projectLotModel
      .updateMany(
        {
          projectId: new Types.ObjectId(projectId),
          $or: [
            { stageKey: { $exists: false } },
            { stageKey: null },
            { stageKey: '' },
          ],
        },
        {
          $set: {
            stageKey: DEFAULT_STAGE_KEY,
            stageName: DEFAULT_STAGE_NAME,
            stageOrder: DEFAULT_STAGE_ORDER,
          },
        },
      )
      .exec();
  }

  private normalizeStageKey(raw: string): string {
    const trimmed = raw.trim().toLowerCase().replace(/\s+/g, '-');
    return trimmed === '' ? DEFAULT_STAGE_KEY : trimmed;
  }

  private compareLotsByStageAndNumber(
    a: {
      kind: string;
      stageOrder?: number;
      stageKey?: string;
      number: string;
    },
    b: {
      kind: string;
      stageOrder?: number;
      stageKey?: string;
      number: string;
    },
  ): number {
    if (a.kind !== b.kind) {
      return a.kind.localeCompare(b.kind);
    }
    const orderDiff =
      (a.stageOrder ?? DEFAULT_STAGE_ORDER) -
      (b.stageOrder ?? DEFAULT_STAGE_ORDER);
    if (orderDiff !== 0) {
      return orderDiff;
    }
    const stageKeyA = a.stageKey ?? DEFAULT_STAGE_KEY;
    const stageKeyB = b.stageKey ?? DEFAULT_STAGE_KEY;
    if (stageKeyA !== stageKeyB) {
      return stageKeyA.localeCompare(stageKeyB);
    }
    return a.number.localeCompare(b.number, undefined, { numeric: true });
  }

  private normalizeStageName(raw: string, stageKey: string): string {
    const trimmed = raw.trim();
    if (trimmed !== '') {
      return trimmed;
    }
    if (stageKey === DEFAULT_STAGE_KEY) {
      return DEFAULT_STAGE_NAME;
    }
    return `Etapa ${stageKey}`;
  }


  /**
   * Releases hold lots whose holdUntil has passed (on-read expiry).
   */
  private async releaseExpiredHolds(projectId?: string): Promise<void> {
    const filter: Record<string, unknown> = {
      status: ProjectLotStatus.hold,
      holdUntil: { $lte: new Date() },
    };
    if (projectId) {
      filter.projectId = new Types.ObjectId(projectId);
    }
    const expired = await this.projectLotModel.find(filter).exec();
    if (expired.length === 0) {
      return;
    }
    await this.projectLotModel
      .updateMany(filter, {
        $set: {
          status: ProjectLotStatus.available,
          holdUntil: null,
          heldByUserId: '',
        },
      })
      .exec();
    await Promise.all(
      expired.map((lot) =>
        this.statusLogService.append({
          projectId: String(lot.projectId),
          lotId: String(lot._id),
          number: lot.number,
          fromStatus: ProjectLotStatus.hold,
          toStatus: ProjectLotStatus.available,
          action: ProjectLotStatusLogAction.expire,
          actorUserId: '',
          actorLevel: 'system',
        }),
      ),
    );
  }

  /**
   * Places a hold on an available lot. External agents default 72h; ventors 24h.
   */
  public async holdAvailableLot(params: {
    readonly projectId: string;
    readonly lotId: string;
    readonly actorUserId: string;
    readonly actorLevel?: number;
    readonly dto: HoldProjectLotDto;
  }): Promise<ProjectLotDocument> {
    await this.projectsService.getById(params.projectId);
    await this.releaseExpiredHolds(params.projectId);
    const actorUserId = params.actorUserId.trim();
    if (actorUserId === '') {
      throw new UnauthorizedException('JWT payload is missing userId');
    }
    const existing = await this.projectLotModel
      .findOne({
        _id: params.lotId,
        projectId: new Types.ObjectId(params.projectId),
      })
      .exec();
    if (!existing) {
      throw new NotFoundException(
        `Lot ${params.lotId} not found in project ${params.projectId}`,
      );
    }
    if (existing.status !== ProjectLotStatus.available) {
      throw new ConflictException(
        `Lot ${existing.number} is not available to hold`,
      );
    }
    const useLongHold = params.actorLevel === OFFICE_USER_LEVEL.externalAgent;
    const holdUntil = useLongHold
      ? this.resolveExternalAgentHoldUntil(params.dto.holdUntil)
      : this.resolveHoldUntil(params.dto.holdUntil);
    const ventorName = (params.dto.ventorName ?? '').trim();
    const lot = await this.projectLotModel
      .findOneAndUpdate(
        {
          _id: params.lotId,
          projectId: new Types.ObjectId(params.projectId),
          status: ProjectLotStatus.available,
        },
        {
          $set: {
            status: ProjectLotStatus.hold,
            holdUntil,
            heldByUserId: actorUserId,
            ...(ventorName !== '' ? { ventorName } : {}),
          },
        },
        { new: true },
      )
      .exec();
    if (!lot) {
      throw new ConflictException(
        `Lot ${existing.number} is not available to hold`,
      );
    }
    await this.statusLogService.append({
      projectId: params.projectId,
      lotId: String(lot._id),
      number: lot.number,
      fromStatus: ProjectLotStatus.available,
      toStatus: ProjectLotStatus.hold,
      action: ProjectLotStatusLogAction.hold,
      actorUserId,
      actorLevel: params.actorLevel,
    });
    return lot;
  }

  /**
   * Releases a hold placed by the same JWT user. Admins may unhold any hold.
   */
  public async unholdHeldLot(params: {
    readonly projectId: string;
    readonly lotId: string;
    readonly actorUserId: string;
    readonly actorLevel?: number;
  }): Promise<ProjectLotDocument> {
    await this.projectsService.getById(params.projectId);
    await this.releaseExpiredHolds(params.projectId);
    const actorUserId = params.actorUserId.trim();
    if (actorUserId === '') {
      throw new UnauthorizedException('JWT payload is missing userId');
    }
    const existing = await this.projectLotModel
      .findOne({
        _id: params.lotId,
        projectId: new Types.ObjectId(params.projectId),
      })
      .exec();
    if (!existing) {
      throw new NotFoundException(
        `Lot ${params.lotId} not found in project ${params.projectId}`,
      );
    }
    if (existing.status !== ProjectLotStatus.hold) {
      throw new ConflictException(`Lot ${existing.number} is not on hold`);
    }
    const isAdmin = params.actorLevel === OFFICE_USER_LEVEL.admin;
    if (!isAdmin && (existing.heldByUserId ?? '') !== actorUserId) {
      throw new ForbiddenException(
        'Only the user who reserved this lot can release the hold',
      );
    }
    const lot = await this.projectLotModel
      .findOneAndUpdate(
        {
          _id: params.lotId,
          projectId: new Types.ObjectId(params.projectId),
          status: ProjectLotStatus.hold,
        },
        {
          $set: {
            status: ProjectLotStatus.available,
            holdUntil: null,
            heldByUserId: '',
            ventorName: '',
          },
        },
        { new: true },
      )
      .exec();
    if (!lot) {
      throw new ConflictException(`Lot ${existing.number} is not on hold`);
    }
    await this.statusLogService.append({
      projectId: params.projectId,
      lotId: String(lot._id),
      number: lot.number,
      fromStatus: ProjectLotStatus.hold,
      toStatus: ProjectLotStatus.available,
      action: ProjectLotStatusLogAction.unhold,
      actorUserId,
      actorLevel: params.actorLevel,
    });
    return lot;
  }

  public async listLotHistory(params: {
    readonly projectId: string;
    readonly lotId: string;
  }): Promise<ProjectLotStatusLogDocument[]> {
    await this.projectsService.getById(params.projectId);
    const existing = await this.projectLotModel
      .findOne({
        _id: params.lotId,
        projectId: new Types.ObjectId(params.projectId),
      })
      .exec();
    if (!existing) {
      throw new NotFoundException(
        `Lot ${params.lotId} not found in project ${params.projectId}`,
      );
    }
    return this.statusLogService.listByLot(params);
  }

  /**
   * Returns a sold lot to available with required evidence files.
   */
  public async desistSoldLot(params: {
    readonly projectId: string;
    readonly lotId: string;
    readonly actorUserId: string;
    readonly actorLevel?: number;
    readonly note?: string;
    readonly files: Express.Multer.File[];
  }): Promise<ProjectLotDocument> {
    await this.projectsService.getById(params.projectId);
    await this.releaseExpiredHolds(params.projectId);
    const actorUserId = params.actorUserId.trim();
    if (actorUserId === '') {
      throw new UnauthorizedException('JWT payload is missing userId');
    }
    if (!params.files?.length) {
      throw new BadRequestException('At least one evidence file is required');
    }
    const existing = await this.projectLotModel
      .findOne({
        _id: params.lotId,
        projectId: new Types.ObjectId(params.projectId),
      })
      .exec();
    if (!existing) {
      throw new NotFoundException(
        `Lot ${params.lotId} not found in project ${params.projectId}`,
      );
    }
    if (existing.status !== ProjectLotStatus.sold) {
      throw new ConflictException(
        `Lot ${existing.number} is not sold and cannot be desisted`,
      );
    }
    const evidenceFiles: string[] = [];
    for (const [index, file] of params.files.entries()) {
      const extension = this.resolveEvidenceExtension(file);
      const fileName = `lot_desist_${existing.number}_${Date.now()}_${index}.${extension}`;
      await this.imageStorageService.saveFile(file.buffer, fileName);
      evidenceFiles.push(fileName);
    }
    const lot = await this.projectLotModel
      .findOneAndUpdate(
        {
          _id: params.lotId,
          projectId: new Types.ObjectId(params.projectId),
          status: ProjectLotStatus.sold,
        },
        {
          $set: {
            status: ProjectLotStatus.available,
            soldBy: '',
            holdUntil: null,
            heldByUserId: '',
          },
        },
        { new: true },
      )
      .exec();
    if (!lot) {
      throw new ConflictException(
        `Lot ${existing.number} is not sold and cannot be desisted`,
      );
    }
    await this.statusLogService.append({
      projectId: params.projectId,
      lotId: String(lot._id),
      number: lot.number,
      fromStatus: ProjectLotStatus.sold,
      toStatus: ProjectLotStatus.available,
      action: ProjectLotStatusLogAction.desist,
      actorUserId,
      actorLevel: params.actorLevel,
      note: params.note,
      evidenceFiles,
    });
    return lot;
  }

  private resolveEvidenceExtension(file: Express.Multer.File): string {
    const name = (file.originalname ?? '').toLowerCase();
    if (name.endsWith('.pdf')) return 'pdf';
    if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'jpg';
    if (name.endsWith('.png')) return 'png';
    if (name.endsWith('.webp')) return 'webp';
    const mime = (file.mimetype ?? '').toLowerCase();
    if (mime === 'application/pdf') return 'pdf';
    if (mime === 'image/jpeg') return 'jpg';
    if (mime === 'image/png') return 'png';
    if (mime === 'image/webp') return 'webp';
    throw new BadRequestException(
      'Evidence files must be pdf, jpg, png, or webp',
    );
  }

  /**
   * Resolves holdUntil for external agents: default now+72h; custom must be at least 72h ahead.
   */
  private resolveExternalAgentHoldUntil(raw?: string): Date {
    const minimum = new Date(Date.now() + HOLD_EXTERNAL_AGENT_MS);
    if (raw === undefined || raw.trim() === '') {
      return minimum;
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('holdUntil must be a valid ISO datetime');
    }
    if (parsed.getTime() < minimum.getTime()) {
      throw new BadRequestException(
        'holdUntil must be at least 72 hours from now',
      );
    }
    return parsed;
  }

  private defaultHoldUntil(): Date {
    return new Date(Date.now() + HOLD_DEFAULT_MS);
  }

  /**
   * Resolves holdUntil from optional ISO string; defaults to now+24h.
   * Rejects past dates.
   */
  private resolveHoldUntil(raw?: string): Date {
    if (raw === undefined || raw.trim() === '') {
      return this.defaultHoldUntil();
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('holdUntil must be a valid ISO datetime');
    }
    if (parsed.getTime() <= Date.now()) {
      throw new BadRequestException('holdUntil must be in the future');
    }
    return parsed;
  }

  private async assertCanShrinkCounts(
    projectId: string,
    nLots: number,
    nCommercial: number,
  ): Promise<void> {
    const existingLots = await this.projectLotModel
      .find({
        projectId: new Types.ObjectId(projectId),
        kind: ProjectLotKind.lot,
      })
      .select('number')
      .lean()
      .exec();
    const maxLot = this.maxNumericNumber(existingLots.map((e) => e.number));
    if (maxLot > nLots) {
      throw new BadRequestException(
        `Cannot set nLots to ${nLots}: inventory already has lot number ${maxLot}. Increase nLots or leave it at least ${maxLot}.`,
      );
    }
    const existingCommercial = await this.projectLotModel
      .find({
        projectId: new Types.ObjectId(projectId),
        kind: ProjectLotKind.commercial,
      })
      .select('number')
      .lean()
      .exec();
    const maxCommercial = this.maxNumericNumber(
      existingCommercial.map((e) => e.number),
    );
    if (maxCommercial > nCommercial) {
      throw new BadRequestException(
        `Cannot set nCommercialSpaces to ${nCommercial}: inventory already has commercial number ${maxCommercial}.`,
      );
    }
  }

  private maxNumericNumber(numbers: readonly string[]): number {
    let max = 0;
    for (const n of numbers) {
      const parsed = parseInt(n, 10);
      if (Number.isFinite(parsed) && parsed > max) {
        max = parsed;
      }
    }
    return max;
  }

  private async buildSummaryForProject(
    projectId: string,
  ): Promise<LotKindSummary> {
    const map = await this.buildSummariesByProjectIds([projectId]);
    return map.get(projectId) ?? this.emptyKindSummary();
  }

  private async buildSummariesByProjectIds(
    projectIds: string[],
  ): Promise<Map<string, LotKindSummary>> {
    const result = new Map<string, LotKindSummary>();
    for (const id of projectIds) {
      result.set(id, this.emptyKindSummary());
    }
    if (projectIds.length === 0) {
      return result;
    }
    const rows = await this.projectLotModel
      .aggregate<{
        _id: { projectId: Types.ObjectId; kind: string; status: string };
        count: number;
      }>([
        {
          $match: {
            projectId: {
              $in: projectIds.map((id) => new Types.ObjectId(id)),
            },
          },
        },
        {
          $group: {
            _id: {
              projectId: '$projectId',
              kind: '$kind',
              status: '$status',
            },
            count: { $sum: 1 },
          },
        },
      ])
      .exec();
    for (const row of rows) {
      const projectId = String(row._id.projectId);
      const summary = result.get(projectId) ?? this.emptyKindSummary();
      const kindKey =
        row._id.kind === ProjectLotKind.commercial ? 'commercial' : 'lot';
      const statusKey = row._id.status as keyof LotStatusSummary;
      const kindSummary = { ...summary[kindKey] };
      if (statusKey in kindSummary && statusKey !== 'total') {
        kindSummary[statusKey] = row.count;
      }
      kindSummary.total =
        kindSummary.available +
        kindSummary.sold +
        kindSummary.hold +
        kindSummary.locked;
      result.set(projectId, {
        ...summary,
        [kindKey]: kindSummary,
      });
    }
    return result;
  }

  private emptyStatusSummary(): LotStatusSummary {
    return { available: 0, sold: 0, hold: 0, locked: 0, total: 0 };
  }

  private emptyKindSummary(): LotKindSummary {
    return {
      lot: this.emptyStatusSummary(),
      commercial: this.emptyStatusSummary(),
    };
  }
}
