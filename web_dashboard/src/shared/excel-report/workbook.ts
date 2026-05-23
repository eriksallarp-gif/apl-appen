import ExcelJS from 'exceljs';
import { buildStudentDashboardSheet, buildSummaryDashboardSheet } from '@/shared/excel-report/worksheetBuildersV2';
import type { ExcelExportDataset, PieChartSeries } from '@/shared/excel-report/types';

export type BuildWorkbookOptions = {
  dataset: ExcelExportDataset;
  logoBase64: string | null;
  fetchPieChartBase64: (series: PieChartSeries) => Promise<string | null>;
  reportTitle?: string;
};

export async function buildExcelReportWorkbook(options: BuildWorkbookOptions): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'APL-appen';
  workbook.lastModifiedBy = 'APL-appen Export Service';
  workbook.created = options.dataset.generatedAt;
  workbook.modified = options.dataset.generatedAt;

  const reportTitle = options.reportTitle || 'APL-appen | Elevstatistik Export';

  await buildSummaryDashboardSheet(
    workbook,
    options.dataset,
    options.logoBase64,
    options.fetchPieChartBase64,
    reportTitle,
  );

  for (const student of options.dataset.students) {
    await buildStudentDashboardSheet(
      workbook,
      student,
      options.dataset.generatedAt,
      options.logoBase64,
      options.fetchPieChartBase64,
      reportTitle,
    );
  }

  return workbook;
}
