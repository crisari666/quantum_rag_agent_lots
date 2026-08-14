import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ProjectsService } from '../projects/projects.service';
import { ProjectDocument } from '../projects/schemas/project.schema';
import {
  BulkUpdateLotStatusDto,
  GenerateProjectLotsDto,
  UpdateProjectLotDto,
} from './dto/project-lot.dto';
import {
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

/**
 * Inventory of physical lots and commercial spaces per project.
 */
@Injectable()
export class ProjectLotsService {
  public constructor(
    @InjectModel(ProjectLot.name)
    private readonly projectLotModel: Model<ProjectLotDocument>,
    @Inject(forwardRef(() => ProjectsService))
    private readonly projectsService: ProjectsService,
    private readonly excelParser: ProjectLotExcelParserService,
  ) {}

  public async listInventoryHub(): Promise<ProjectLotInventoryRow[]> {
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
  ): Promise<ListLotsResult> {
    await this.projectsService.getById(projectId);
    const filter: Record<string, unknown> = {
      projectId: new Types.ObjectId(projectId),
    };
    if (kind !== 'all') {
      filter.kind = kind;
    }
    const lots = await this.projectLotModel
      .find(filter)
      .sort({ kind: 1, number: 1 })
      .exec();
    const summary = await this.buildSummaryForProject(projectId);
    return { lots, summary };
  }

  public async listPublic(
    projectId: string,
    kind: ProjectLotKind | 'all' = 'all',
  ): Promise<PublicLotsResult> {
    const { lots, summary } = await this.listByProject(projectId, kind);
    const project = await this.projectsService.getById(projectId);
    return {
      projectId,
      projectTitle: project.title,
      summary,
      lots: lots.map((lot) => ({
        number: lot.number,
        area: lot.area,
        price: lot.price,
        status: lot.status,
        kind: lot.kind,
        ventorName: lot.ventorName ?? '',
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
  ): Promise<ProjectLotDocument> {
    await this.projectsService.getById(projectId);
    const payload: Partial<ProjectLot> = {};
    if (dto.area !== undefined) payload.area = dto.area;
    if (dto.price !== undefined) payload.price = dto.price;
    if (dto.status !== undefined) payload.status = dto.status;
    if (dto.ventorName !== undefined) payload.ventorName = dto.ventorName.trim();
    if (dto.soldBy !== undefined) payload.soldBy = dto.soldBy.trim();
    const lot = await this.projectLotModel
      .findOneAndUpdate(
        { _id: lotId, projectId: new Types.ObjectId(projectId) },
        { $set: payload },
        { new: true },
      )
      .exec();
    if (!lot) {
      throw new NotFoundException(
        `Lot ${lotId} not found in project ${projectId}`,
      );
    }
    return lot;
  }

  public async bulkUpdateStatus(
    projectId: string,
    dto: BulkUpdateLotStatusDto,
  ): Promise<{ modifiedCount: number }> {
    await this.projectsService.getById(projectId);
    if (!dto.lotIds?.length) {
      throw new BadRequestException('lotIds must not be empty');
    }
    const setPayload: Record<string, unknown> = { status: dto.status };
    if (dto.ventorName !== undefined) {
      setPayload.ventorName = dto.ventorName.trim();
    }
    if (dto.soldBy !== undefined) {
      setPayload.soldBy = dto.soldBy.trim();
    }
    const result = await this.projectLotModel
      .updateMany(
        {
          projectId: new Types.ObjectId(projectId),
          _id: {
            $in: dto.lotIds.map((id) => new Types.ObjectId(id)),
          },
        },
        { $set: setPayload },
      )
      .exec();
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
      const existing = await this.projectLotModel
        .findOne({
          projectId: new Types.ObjectId(projectId),
          kind,
          number: row.number,
        })
        .exec();
      if (existing) {
        await this.projectLotModel
          .updateOne(
            { _id: existing._id },
            {
              $set: {
                area: row.area,
                price: row.price,
                status: row.status,
                ventorName: row.ventorName,
              },
            },
          )
          .exec();
        updated += 1;
      } else {
        await this.projectLotModel.create({
          projectId: new Types.ObjectId(projectId),
          kind,
          number: row.number,
          area: row.area,
          price: row.price,
          status: row.status,
          ventorName: row.ventorName,
          soldBy: '',
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
      .sort({ projectId: 1, kind: 1, number: 1 })
      .limit(500)
      .exec();
    return lots.map((lot) => ({
      projectId: String(lot.projectId),
      kind: lot.kind,
      number: lot.number,
      area: lot.area,
      price: lot.price,
      status: lot.status,
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
        area: params.area,
        price: params.price,
        status: ProjectLotStatus.available,
        soldBy: '',
        ventorName: '',
      });
    }
    if (toCreate.length === 0) {
      return 0;
    }
    await this.projectLotModel.insertMany(toCreate);
    return toCreate.length;
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
