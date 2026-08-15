import { ProjectLotExcelParserService } from './project-lot-excel-parser.service';
import * as ExcelJS from 'exceljs';

describe('ProjectLotExcelParserService stage defaults', () => {
  const parser = new ProjectLotExcelParserService();

  async function buildBuffer(rows: string[][]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('lots');
    for (const row of rows) {
      sheet.addRow(row);
    }
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  it('requires stage header and defaults empty stage to 1', async () => {
    const buffer = await buildBuffer([
      ['stage', 'nLots', 'area', 'price', 'status', 'ventor'],
      ['', '65', '72', '34999999', 'V', 'ZAIDA'],
      ['2', '3', '80', '100', 'S', ''],
    ]);
    const result = await parser.parseWorkbook(buffer);
    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      number: '65',
      stageKey: '1',
      stageName: 'Etapa 1',
      status: 'sold',
    });
    expect(result.rows[1]).toMatchObject({
      number: '3',
      stageKey: '2',
      status: 'hold',
    });
  });

  it('maps general/default stage labels to 1', async () => {
    const buffer = await buildBuffer([
      ['stage', 'nLots', 'area', 'price', 'status'],
      ['General', '1', '10', '100', ''],
      ['default', '2', '10', '100', ''],
    ]);
    const result = await parser.parseWorkbook(buffer);
    expect(result.rows.every((row) => row.stageKey === '1')).toBe(true);
  });

  it('rejects workbooks without stage column', async () => {
    const buffer = await buildBuffer([
      ['nLots', 'area', 'price', 'status'],
      ['1', '10', '100', 'V'],
    ]);
    const result = await parser.parseWorkbook(buffer);
    expect(result.rows).toHaveLength(0);
    expect(result.errors[0]).toMatch(/stage/i);
  });
});
