import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import {
  DEFAULT_STAGE_KEY,
  DEFAULT_STAGE_NAME,
  DEFAULT_STAGE_ORDER,
} from '../schemas/project-lot.schema';
import { ProjectLotStatus } from '../types/project-lot.enums';

export type ParsedLotImportRow = Readonly<{
  number: string;
  area: number;
  price: number;
  ventorName: string;
  status: ProjectLotStatus;
  stageKey: string;
  stageName: string;
  stageOrder: number;
  rowIndex: number;
}>;

export type LotImportParseResult = Readonly<{
  rows: ParsedLotImportRow[];
  errors: string[];
}>;

const STATUS_MAP: Readonly<Record<string, ProjectLotStatus>> = {
  v: ProjectLotStatus.sold,
  sold: ProjectLotStatus.sold,
  vendido: ProjectLotStatus.sold,
  s: ProjectLotStatus.hold,
  hold: ProjectLotStatus.hold,
  separado: ProjectLotStatus.hold,
  c: ProjectLotStatus.locked,
  locked: ProjectLotStatus.locked,
  bloqueado: ProjectLotStatus.locked,
  d: ProjectLotStatus.available,
  a: ProjectLotStatus.available,
  disponible: ProjectLotStatus.available,
  available: ProjectLotStatus.available,
  '': ProjectLotStatus.available,
};

/**
 * Parses lot inventory Excel (.xlsx) files.
 */
@Injectable()
export class ProjectLotExcelParserService {
  /**
   * Reads workbook buffer and maps rows by headers.
   * Required: stage, nLots, area, price, status.
   * Optional: ventor, stageName, stageOrder.
   * Empty stage cell defaults to stage `1` (Etapa 1).
   */
  public async parseWorkbook(buffer: Buffer): Promise<LotImportParseResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      return { rows: [], errors: ['Workbook has no sheets'] };
    }
    const headerRow = sheet.getRow(1);
    const headerMap = this.buildHeaderMap(headerRow);
    const required = ['stage', 'nlots', 'area', 'price', 'status'] as const;
    const missing = required.filter((key) => headerMap[key] === undefined);
    if (missing.length > 0) {
      return {
        rows: [],
        errors: [
          `Missing required headers: ${missing.join(', ')} (expected stage, nLots, area, price, status; optional ventor, stageName, stageOrder). Stage column is required; empty cells default to 1.`,
        ],
      };
    }
    const rows: ParsedLotImportRow[] = [];
    const errors: string[] = [];
    const stageOrderByKey = new Map<string, number>();
    let nextDerivedOrder = 1;
    const lastRow = sheet.rowCount;
    for (let rowIndex = 2; rowIndex <= lastRow; rowIndex += 1) {
      const row = sheet.getRow(rowIndex);
      if (this.isEmptyRow(row, headerMap)) {
        continue;
      }
      try {
        const numberRaw = this.cellText(row, headerMap.nlots);
        const number = this.normalizeLotNumber(numberRaw);
        if (!number) {
          errors.push(`Row ${rowIndex}: invalid nLots value "${numberRaw}"`);
          continue;
        }
        const area = this.cellNumber(row, headerMap.area);
        const price = this.cellNumber(row, headerMap.price);
        if (area === null || area < 0) {
          errors.push(`Row ${rowIndex}: invalid area`);
          continue;
        }
        if (price === null || price < 0) {
          errors.push(`Row ${rowIndex}: invalid price`);
          continue;
        }
        const ventorName =
          headerMap.ventor !== undefined
            ? this.cellText(row, headerMap.ventor).trim()
            : '';
        const statusRaw = this.cellText(row, headerMap.status)
          .trim()
          .toLowerCase();
        const status = STATUS_MAP[statusRaw];
        if (!status) {
          errors.push(
            `Row ${rowIndex}: unknown status "${statusRaw}" (use V/S/C or available)`,
          );
          continue;
        }
        const stageRaw = this.cellText(row, headerMap.stage);
        const stageKey = this.normalizeStageKey(stageRaw);
        const stageNameRaw =
          headerMap.stagename !== undefined
            ? this.cellText(row, headerMap.stagename)
            : '';
        const stageName = this.normalizeStageName(stageNameRaw, stageKey);
        let stageOrder = DEFAULT_STAGE_ORDER;
        if (headerMap.stageorder !== undefined) {
          const parsedOrder = this.cellNumber(row, headerMap.stageorder);
          if (parsedOrder !== null && parsedOrder >= 0) {
            stageOrder = parsedOrder;
          } else {
            stageOrder = this.deriveStageOrder(
              stageKey,
              stageOrderByKey,
              () => {
                const order = nextDerivedOrder;
                nextDerivedOrder += 1;
                return order;
              },
            );
          }
        } else {
          stageOrder = this.deriveStageOrder(
            stageKey,
            stageOrderByKey,
            () => {
              const order = nextDerivedOrder;
              nextDerivedOrder += 1;
              return order;
            },
          );
        }
        stageOrderByKey.set(stageKey, stageOrder);
        rows.push({
          number,
          area,
          price,
          ventorName,
          status,
          stageKey,
          stageName,
          stageOrder,
          rowIndex,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`Row ${rowIndex}: ${message}`);
      }
    }
    return { rows, errors };
  }

  private buildHeaderMap(
    headerRow: ExcelJS.Row,
  ): Record<string, number> {
    const map: Record<string, number> = {};
    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const key = String(cell.value ?? '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '');
      if (key === 'nlots' || key === 'nlot' || key === 'number' || key === 'lote') {
        map.nlots = colNumber;
      } else if (key === 'area' || key === 'área' || key === 'm2') {
        map.area = colNumber;
      } else if (key === 'price' || key === 'precio') {
        map.price = colNumber;
      } else if (key === 'ventor' || key === 'vendor' || key === 'vendedor') {
        map.ventor = colNumber;
      } else if (key === 'status' || key === 'estado') {
        map.status = colNumber;
      } else if (
        key === 'stage' ||
        key === 'etapa' ||
        key === 'fase' ||
        key === 'stagekey'
      ) {
        map.stage = colNumber;
      } else if (
        key === 'stagename' ||
        key === 'etapanombre' ||
        key === 'nombreetapa'
      ) {
        map.stagename = colNumber;
      } else if (
        key === 'stageorder' ||
        key === 'ordenetapa' ||
        key === 'etapaorden'
      ) {
        map.stageorder = colNumber;
      }
    });
    return map;
  }

  private isEmptyRow(
    row: ExcelJS.Row,
    headerMap: Record<string, number>,
  ): boolean {
    const cols = Object.values(headerMap);
    return cols.every((col) => {
      const value = row.getCell(col).value;
      return value === null || value === undefined || String(value).trim() === '';
    });
  }

  private cellText(row: ExcelJS.Row, col: number): string {
    const value = row.getCell(col).value;
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'object' && 'text' in value) {
      return String((value as { text: string }).text ?? '');
    }
    if (typeof value === 'object' && 'result' in value) {
      return String((value as { result: unknown }).result ?? '');
    }
    return String(value);
  }

  private cellNumber(row: ExcelJS.Row, col: number): number | null {
    return this.parseNumericCell(this.cellText(row, col));
  }

  /**
   * Parses numbers from Excel cells, including COP-style money:
   * `$ 52.000.000` → 52000000, `1.200,5` → 1200.5, `450000000` → 450000000.
   */
  public parseNumericCell(raw: string): number | null {
    let value = raw
      .trim()
      .replace(/\$/g, '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, '')
      .replace(/cop/gi, '');
    if (value === '') {
      return null;
    }
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(value)) {
      value = value.replace(/\./g, '').replace(',', '.');
    } else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(value)) {
      value = value.replace(/,/g, '');
    } else if (/^\d+,\d+$/.test(value)) {
      value = value.replace(',', '.');
    } else {
      value = value.replace(/,/g, '');
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  /**
   * Normalizes "12", "12.0", "L-12" → "12" when the numeric part is clear.
   */
  public normalizeLotNumber(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) {
      return '';
    }
    const digitMatch = trimmed.match(/(\d+)/);
    if (digitMatch) {
      return String(parseInt(digitMatch[1], 10));
    }
    return trimmed;
  }

  /**
   * Empty / general / default → stage `1` so Excel inventory joins map polygons.
   */
  public normalizeStageKey(raw: string): string {
    const trimmed = raw.trim().toLowerCase().replace(/\s+/g, '-');
    if (
      trimmed === '' ||
      trimmed === DEFAULT_STAGE_KEY ||
      trimmed === 'general' ||
      trimmed === 'etapa-1' ||
      trimmed === 'etapa1'
    ) {
      return '1';
    }
    const digitMatch = trimmed.match(/^(\d+)/);
    if (digitMatch) {
      return String(parseInt(digitMatch[1], 10));
    }
    return trimmed;
  }

  public normalizeStageName(raw: string, stageKey: string): string {
    const trimmed = raw.trim();
    if (trimmed !== '') {
      return trimmed;
    }
    if (stageKey === DEFAULT_STAGE_KEY) {
      return DEFAULT_STAGE_NAME;
    }
    return `Etapa ${stageKey}`;
  }

  private deriveStageOrder(
    stageKey: string,
    known: Map<string, number>,
    nextOrder: () => number,
  ): number {
    if (stageKey === DEFAULT_STAGE_KEY) {
      return DEFAULT_STAGE_ORDER;
    }
    const existing = known.get(stageKey);
    if (existing !== undefined) {
      return existing;
    }
    const numericKey = Number(stageKey);
    if (Number.isFinite(numericKey) && numericKey >= 0) {
      return numericKey;
    }
    return nextOrder();
  }
}
