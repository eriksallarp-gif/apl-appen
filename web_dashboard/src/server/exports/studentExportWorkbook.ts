import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { buildExcelReportWorkbook } from '@/shared/excel-report/workbook';
import { fetchPieChartBase64 } from '@/shared/excel-report/chart';
import type { ExportDataset } from '@/server/exports/studentExportData';

async function readBase64IfExists(filePath: string): Promise<string | null> {
  try {
    const bytes = await readFile(filePath);
    return bytes.toString('base64');
  } catch {
    return null;
  }
}

async function resolveLogoBase64(): Promise<string | null> {
  const candidates = [
    'd:\\apl_appen\\apl_logo_512_padded.png',
    path.join(process.cwd(), 'public', 'apl_logo_512_padded.png'),
    path.join(process.cwd(), 'public', 'logo.png'),
  ];

  for (const candidate of candidates) {
    const base64 = await readBase64IfExists(candidate);
    if (base64) {
      return base64;
    }
  }

  return null;
}

export async function createStudentExportWorkbook(dataset: ExportDataset): Promise<Buffer> {
  const logoBase64 = await resolveLogoBase64();

  const workbook = await buildExcelReportWorkbook({
    dataset,
    logoBase64,
    fetchPieChartBase64,
    reportTitle: 'APL-appen | Elevstatistik Export',
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
