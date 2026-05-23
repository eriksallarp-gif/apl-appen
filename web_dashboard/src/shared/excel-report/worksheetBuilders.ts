import ExcelJS from 'exceljs';
import {
  applyBodyCellStyle,
  applyBrandHeaderStyle,
  applyHeaderCellStyle,
  applySectionContainerStyle,
  applySectionTitleStyle,
  applyZebraFill,
  formatDate,
  formatDateTime,
  getIsoWeekNumber,
  renderStatCard,
  REPORT_THEME,
  safeSheetName,
  setPageBackground,
  translateDayLabel,
} from '@/shared/excel-report/style';
import {
  getApprovalRate,
  getUniqueActivityCount,
  getUniqueWeekCount,
  summarizeHoursByActivity,
  summarizeHoursByClass,
  translateAssessmentStatus,
  translateStatus,
} from '@/shared/excel-report/mapping';
import type {
  ExcelExportDataset,
  ExcelExportEntry,
  ExcelExportStudent,
  PieChartSeries,
} from '@/shared/excel-report/types';

type ChartFetcher = (series: PieChartSeries) => Promise<string | null>;

function addLogoToSheet(workbook: ExcelJS.Workbook, worksheet: ExcelJS.Worksheet, logoBase64: string | null) {
  if (!logoBase64) {
    return;
  }

  const imageId = workbook.addImage({
    base64: logoBase64,
    extension: 'png',
  });

  worksheet.addImage(imageId, {
    tl: { col: 1.2, row: 0.2 },
    ext: { width: 72, height: 72 },
  });
}

function setupDashboardColumns(worksheet: ExcelJS.Worksheet) {
  worksheet.columns = [
    { width: 3 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 2 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
  ];
}

function applyRangeContainer(
  worksheet: ExcelJS.Worksheet,
  startRow: number,
  endRow: number,
  startCol: number,
  endCol: number,
) {
  for (let row = startRow; row <= endRow; row += 1) {
    for (let col = startCol; col <= endCol; col += 1) {
      applySectionContainerStyle(worksheet.getRow(row).getCell(col));
    }
  }
}

function addBranding(
  workbook: ExcelJS.Workbook,
  worksheet: ExcelJS.Worksheet,
  generatedAt: Date,
  logoBase64: string | null,
  reportTitle: string,
) {
  addLogoToSheet(workbook, worksheet, logoBase64);

  worksheet.mergeCells('C1:I1');
  worksheet.getCell('C1').value = reportTitle;
  applyBrandHeaderStyle(worksheet.getCell('C1'), true);

  worksheet.mergeCells('C2:I2');
  worksheet.getCell('C2').value = `Genererad: ${formatDateTime(generatedAt)} | Rapportspråk: Svenska`;
  applyBrandHeaderStyle(worksheet.getCell('C2'), false);

  worksheet.getRow(1).height = 34;
  worksheet.getRow(2).height = 22;
  worksheet.getRow(3).height = 8;

  for (let col = 2; col <= 13; col += 1) {
    const cell = worksheet.getRow(4).getCell(col);
    cell.border = {
      bottom: { style: 'medium', color: { argb: `FF${REPORT_THEME.borderStrong}` } },
    };
  }
}

function addStudentCards(worksheet: ExcelJS.Worksheet, student: ExcelExportStudent) {
  renderStatCard(worksheet, {
    icon: '⏱',
    label: 'Totala timmar',
    value: Number(student.totalHours.toFixed(1)),
    range: 'B6:C8',
    tone: 'amber',
  });
  renderStatCard(worksheet, {
    icon: '✅',
    label: 'Godkända tidkort',
    value: `${student.approvedTimesheets}/${student.timesheetCount}`,
    range: 'D6:E8',
    tone: 'green',
  });
  renderStatCard(worksheet, {
    icon: '📝',
    label: 'Bedömningar',
    value: student.assessmentCount,
    range: 'F6:G8',
    tone: 'purple',
  });
  renderStatCard(worksheet, {
    icon: '📆',
    label: 'Antal veckor',
    value: getUniqueWeekCount(student.entries),
    range: 'H6:I8',
    tone: 'blue',
  });
  renderStatCard(worksheet, {
    icon: '🛠',
    label: 'Arbetsmoment',
    value: getUniqueActivityCount(student.entries),
    range: 'B9:C11',
    tone: 'teal',
  });
  renderStatCard(worksheet, {
    icon: '💰',
    label: 'Ersättning',
    value: `${student.approvedLunches} luncher | ${student.approvedKilometers} km`,
    range: 'D9:E11',
    tone: 'green',
  });
}

function renderInfoBox(
  worksheet: ExcelJS.Worksheet,
  range: string,
  label: string,
  value: string,
) {
  worksheet.mergeCells(range);
  const cell = worksheet.getCell(range.split(':')[0]);
  cell.value = `${label}\n${value || '-'}`;
  cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  cell.font = { name: 'Segoe UI', bold: true, size: 11, color: { argb: `FF${REPORT_THEME.textStrong}` } };
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF8FAFC' },
  };
  cell.border = {
    top: { style: 'thin', color: { argb: `FF${REPORT_THEME.borderStrong}` } },
    left: { style: 'thin', color: { argb: `FF${REPORT_THEME.borderStrong}` } },
    bottom: { style: 'thin', color: { argb: `FF${REPORT_THEME.borderStrong}` } },
    right: { style: 'thin', color: { argb: `FF${REPORT_THEME.borderStrong}` } },
  };
}

function addStudentInfo(worksheet: ExcelJS.Worksheet, student: ExcelExportStudent) {
  renderInfoBox(worksheet, 'F9:G11', 'Elev', student.name);
  renderInfoBox(worksheet, 'H9:I11', 'Klass', student.className || 'Ingen klass');
  renderInfoBox(worksheet, 'B12:C14', 'Status', translateStatus(student.status));
  renderInfoBox(worksheet, 'D12:E14', 'Handledare', student.supervisorName || '-');
  renderInfoBox(worksheet, 'F12:I14', 'Senast registrerat', formatDateTime(student.lastRegisteredAt));
}

async function addStudentChartSection(
  workbook: ExcelJS.Workbook,
  worksheet: ExcelJS.Worksheet,
  student: ExcelExportStudent,
  fetchPieChartBase64: ChartFetcher,
) {
  applyRangeContainer(worksheet, 6, 20, 11, 13);

  worksheet.mergeCells('K6:M6');
  const titleCell = worksheet.getCell('K6');
  titleCell.value = 'Fördelning av tid per arbetsmoment';
  applySectionTitleStyle(titleCell);

  const topActivities = summarizeHoursByActivity(student.entries).slice(0, 7);
  const chartBase64 = await fetchPieChartBase64({
    title: 'Tid per arbetsmoment',
    labels: topActivities.map(([label]) => label),
    values: topActivities.map(([, value]) => Number(value.toFixed(2))),
  });

  if (!chartBase64) {
    worksheet.mergeCells('K8:M12');
    worksheet.getCell('K8').value = 'Ingen aktivitetsdata att visa i diagram.';
    worksheet.getCell('K8').font = { italic: true, color: { argb: `FF${REPORT_THEME.textMuted}` } };
    worksheet.getCell('K8').alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    return;
  }

  const imageId = workbook.addImage({ base64: chartBase64, extension: 'png' });
  worksheet.addImage(imageId, {
    tl: { col: 10.55, row: 7.2 },
    ext: { width: 320, height: 220 },
  });
}

function addActivityTable(worksheet: ExcelJS.Worksheet, student: ExcelExportStudent, startRow: number): number {
  worksheet.mergeCells(`B${startRow}:I${startRow}`);
  worksheet.getCell(`B${startRow}`).value = 'Aktiviteter';
  applySectionTitleStyle(worksheet.getCell(`B${startRow}`));

  const headerRowIndex = startRow + 1;
  const headers = ['Datum', 'Vecka', 'Veckodag', 'Arbetsmoment', 'Typ', 'Timmar', 'Godkänd', 'Kommentarer'];

  const headerRow = worksheet.getRow(headerRowIndex);
  headerRow.values = ['', ...headers];
  headerRow.height = 24;

  for (let col = 2; col <= 9; col += 1) {
    applyHeaderCellStyle(headerRow.getCell(col));
  }

  const activityEntries = student.entries
    .filter((entry) => entry.source === 'Tidkort')
    .sort((a, b) => (b.registeredAt?.getTime() || 0) - (a.registeredAt?.getTime() || 0));

  let rowIndex = headerRowIndex + 1;
  if (activityEntries.length === 0) {
    worksheet.mergeCells(`B${rowIndex}:I${rowIndex}`);
    const emptyCell = worksheet.getCell(`B${rowIndex}`);
    emptyCell.value = 'Ingen aktivitetsdata tillgänglig.';
    emptyCell.font = { italic: true, color: { argb: `FF${REPORT_THEME.textMuted}` } };
    emptyCell.alignment = { vertical: 'middle', horizontal: 'left' };
    rowIndex += 1;
  } else {
    for (const entry of activityEntries) {
      const row = worksheet.getRow(rowIndex);
      row.values = [
        '',
        formatDate(entry.registeredAt),
        getIsoWeekNumber(entry.weekStart),
        translateDayLabel(entry.dayLabel),
        entry.activity || '-',
        entry.source,
        Number(entry.hours.toFixed(2)),
        entry.approved ? 'Ja' : 'Nej',
        entry.comment || '-',
      ];

      for (let col = 2; col <= 9; col += 1) {
        const cell = row.getCell(col);
        applyBodyCellStyle(cell);
        applyZebraFill(cell, rowIndex);
      }

      row.getCell(7).numFmt = '0.00';
      row.height = 22;
      rowIndex += 1;
    }
  }

  worksheet.autoFilter = {
    from: { row: headerRowIndex, column: 2 },
    to: { row: headerRowIndex, column: 9 },
  };

  return rowIndex + 1;
}

function addAssessmentsTable(worksheet: ExcelJS.Worksheet, student: ExcelExportStudent, startRow: number): number {
  worksheet.mergeCells(`B${startRow}:I${startRow}`);
  worksheet.getCell(`B${startRow}`).value = 'Bedömningar';
  applySectionTitleStyle(worksheet.getCell(`B${startRow}`));

  const headerRowIndex = startRow + 1;
  const headers = ['Datum', 'Bedömare', 'Bedömning', 'Kommentar'];
  const headerRow = worksheet.getRow(headerRowIndex);
  headerRow.values = ['', ...headers];
  headerRow.height = 24;

  for (let col = 2; col <= 5; col += 1) {
    applyHeaderCellStyle(headerRow.getCell(col));
  }

  worksheet.mergeCells(`F${headerRowIndex}:I${headerRowIndex}`);
  const metaHeader = worksheet.getCell(`F${headerRowIndex}`);
  metaHeader.value = 'Status / Företag';
  applyHeaderCellStyle(metaHeader);

  let rowIndex = headerRowIndex + 1;
  if (student.assessments.length === 0) {
    worksheet.mergeCells(`B${rowIndex}:I${rowIndex}`);
    const emptyCell = worksheet.getCell(`B${rowIndex}`);
    emptyCell.value = 'Ingen bedömning registrerad för eleven.';
    emptyCell.font = { italic: true, color: { argb: `FF${REPORT_THEME.textMuted}` } };
    emptyCell.alignment = { vertical: 'middle', horizontal: 'left' };
    rowIndex += 1;
  } else {
    for (const assessment of student.assessments) {
      const row = worksheet.getRow(rowIndex);
      row.values = [
        '',
        formatDate(assessment.submittedAt),
        assessment.assessorName || '-',
        assessment.rating || '-',
        assessment.comment || '-',
      ];

      for (let col = 2; col <= 5; col += 1) {
        const cell = row.getCell(col);
        applyBodyCellStyle(cell);
        applyZebraFill(cell, rowIndex);
      }

      worksheet.mergeCells(`F${rowIndex}:I${rowIndex}`);
      const metaCell = worksheet.getCell(`F${rowIndex}`);
      metaCell.value = `${translateAssessmentStatus(assessment.status)} | ${assessment.assessorCompany || '-'}`;
      applyBodyCellStyle(metaCell);
      applyZebraFill(metaCell, rowIndex);
      row.height = 22;
      rowIndex += 1;
    }
  }

  return rowIndex + 1;
}

function addCompensationSection(worksheet: ExcelJS.Worksheet, student: ExcelExportStudent, startRow: number): number {
  worksheet.mergeCells(`B${startRow}:I${startRow}`);
  worksheet.getCell(`B${startRow}`).value = 'Ersättning';
  applySectionTitleStyle(worksheet.getCell(`B${startRow}`));

  const summaryRow = startRow + 1;
  worksheet.mergeCells(`B${summaryRow}:E${summaryRow + 1}`);
  worksheet.mergeCells(`F${summaryRow}:I${summaryRow + 1}`);

  const lunchCell = worksheet.getCell(`B${summaryRow}`);
  lunchCell.value = `Antal luncher\n${student.approvedLunches}`;
  lunchCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  lunchCell.font = { bold: true, size: 12, color: { argb: `FF${REPORT_THEME.textStrong}` } };
  lunchCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
  lunchCell.border = {
    top: { style: 'thin', color: { argb: `FF${REPORT_THEME.borderStrong}` } },
    left: { style: 'thin', color: { argb: `FF${REPORT_THEME.borderStrong}` } },
    bottom: { style: 'thin', color: { argb: `FF${REPORT_THEME.borderStrong}` } },
    right: { style: 'thin', color: { argb: `FF${REPORT_THEME.borderStrong}` } },
  };

  const kmCell = worksheet.getCell(`F${summaryRow}`);
  kmCell.value = `Antal kilometer\n${student.approvedKilometers}`;
  kmCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  kmCell.font = { bold: true, size: 12, color: { argb: `FF${REPORT_THEME.textStrong}` } };
  kmCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
  kmCell.border = {
    top: { style: 'thin', color: { argb: `FF${REPORT_THEME.borderStrong}` } },
    left: { style: 'thin', color: { argb: `FF${REPORT_THEME.borderStrong}` } },
    bottom: { style: 'thin', color: { argb: `FF${REPORT_THEME.borderStrong}` } },
    right: { style: 'thin', color: { argb: `FF${REPORT_THEME.borderStrong}` } },
  };

  const tableHeaderRow = summaryRow + 3;
  const headerRow = worksheet.getRow(tableHeaderRow);
  headerRow.values = ['', 'Vecka', 'Luncher', 'Kilometer', 'Källa', 'Kommentar'];
  headerRow.height = 24;

  for (let col = 2; col <= 6; col += 1) {
    applyHeaderCellStyle(headerRow.getCell(col));
  }

  let rowIndex = tableHeaderRow + 1;
  if (student.compensations.length === 0) {
    worksheet.mergeCells(`B${rowIndex}:F${rowIndex}`);
    const emptyCell = worksheet.getCell(`B${rowIndex}`);
    emptyCell.value = 'Ingen ersättningsdata registrerad.';
    emptyCell.font = { italic: true, color: { argb: `FF${REPORT_THEME.textMuted}` } };
    emptyCell.alignment = { vertical: 'middle', horizontal: 'left' };
    rowIndex += 1;
  } else {
    for (const compensation of student.compensations) {
      const row = worksheet.getRow(rowIndex);
      row.values = [
        '',
        getIsoWeekNumber(compensation.weekStart),
        compensation.lunches,
        compensation.kilometers,
        compensation.source === 'Bedomning' ? 'Bedömning' : 'Ersättning',
        compensation.comment || '-',
      ];

      for (let col = 2; col <= 6; col += 1) {
        const cell = row.getCell(col);
        applyBodyCellStyle(cell);
        applyZebraFill(cell, rowIndex);
      }
      row.height = 22;
      rowIndex += 1;
    }
  }

  return rowIndex;
}

export async function buildStudentDashboardSheet(
  workbook: ExcelJS.Workbook,
  student: ExcelExportStudent,
  generatedAt: Date,
  logoBase64: string | null,
  fetchPieChartBase64: ChartFetcher,
  reportTitle: string,
) {
  const worksheet = workbook.addWorksheet(safeSheetName(student.name), {
    views: [{ state: 'normal' }],
  });

  setupDashboardColumns(worksheet);
  setPageBackground(worksheet, 1, 320, 1, 14);
  addBranding(workbook, worksheet, generatedAt, logoBase64, reportTitle);
  addStudentCards(worksheet, student);
  addStudentInfo(worksheet, student);
  await addStudentChartSection(workbook, worksheet, student, fetchPieChartBase64);

  const afterActivityRow = addActivityTable(worksheet, student, 22);
  const afterAssessmentRow = addAssessmentsTable(worksheet, student, afterActivityRow);
  addCompensationSection(worksheet, student, afterAssessmentRow);
}

function addSummaryTable(worksheet: ExcelJS.Worksheet, students: ExcelExportStudent[], startRow: number): number {
  worksheet.mergeCells(`B${startRow}:I${startRow}`);
  worksheet.getCell(`B${startRow}`).value = 'Sammanställning per elev';
  applySectionTitleStyle(worksheet.getCell(`B${startRow}`));

  const headerRowIndex = startRow + 1;
  const headers = ['Elev', 'Klass', 'Timmar', 'Godkända tidkort', 'Bedömningar', 'Ersättning', 'Senast registrerat'];
  const headerRow = worksheet.getRow(headerRowIndex);
  headerRow.values = ['', ...headers];
  headerRow.height = 24;

  for (let col = 2; col <= 8; col += 1) {
    applyHeaderCellStyle(headerRow.getCell(col));
  }

  let rowIndex = headerRowIndex + 1;
  for (const student of students) {
    const row = worksheet.getRow(rowIndex);
    row.values = [
      '',
      student.name,
      student.className,
      Number(student.totalHours.toFixed(1)),
      `${student.approvedTimesheets}/${student.timesheetCount}`,
      student.assessmentCount,
      `${student.approvedLunches} luncher | ${student.approvedKilometers} km`,
      formatDateTime(student.lastRegisteredAt),
    ];

    for (let col = 2; col <= 8; col += 1) {
      const cell = row.getCell(col);
      applyBodyCellStyle(cell);
      applyZebraFill(cell, rowIndex);
    }

    row.height = 22;
    rowIndex += 1;
  }

  return rowIndex;
}

async function addSummaryChart(
  workbook: ExcelJS.Workbook,
  worksheet: ExcelJS.Worksheet,
  students: ExcelExportStudent[],
  fetchPieChartBase64: ChartFetcher,
) {
  applyRangeContainer(worksheet, 6, 20, 11, 13);

  worksheet.mergeCells('K6:M6');
  worksheet.getCell('K6').value = 'Tidfördelning per arbetsmoment';
  applySectionTitleStyle(worksheet.getCell('K6'));

  const activitySummary = summarizeHoursByActivity(students.flatMap((student) => student.entries)).slice(0, 7);
  const activityChart = await fetchPieChartBase64({
    title: 'Arbetsmoment i urvalet',
    labels: activitySummary.map(([label]) => label),
    values: activitySummary.map(([, value]) => Number(value.toFixed(2))),
  });

  if (!activityChart) {
    worksheet.mergeCells('K8:M12');
    worksheet.getCell('K8').value = 'Ingen data tillgänglig för diagram.';
    worksheet.getCell('K8').font = { italic: true, color: { argb: `FF${REPORT_THEME.textMuted}` } };
    worksheet.getCell('K8').alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    return;
  }

  const imageId = workbook.addImage({ base64: activityChart, extension: 'png' });
  worksheet.addImage(imageId, {
    tl: { col: 10.55, row: 7.2 },
    ext: { width: 320, height: 220 },
  });
}

export async function buildSummaryDashboardSheet(
  workbook: ExcelJS.Workbook,
  dataset: ExcelExportDataset,
  logoBase64: string | null,
  fetchPieChartBase64: ChartFetcher,
  reportTitle: string,
) {
  const worksheet = workbook.addWorksheet('Sammanfattning', {
    views: [{ state: 'normal' }],
  });

  setupDashboardColumns(worksheet);
  setPageBackground(worksheet, 1, 260, 1, 14);
  addBranding(workbook, worksheet, dataset.generatedAt, logoBase64, reportTitle);

  const totalHours = dataset.students.reduce((sum, student) => sum + student.totalHours, 0);
  const totalTimesheets = dataset.students.reduce((sum, student) => sum + student.timesheetCount, 0);
  const totalApprovedTimesheets = dataset.students.reduce((sum, student) => sum + student.approvedTimesheets, 0);
  const totalAssessments = dataset.students.reduce((sum, student) => sum + student.assessmentCount, 0);
  const totalLunches = dataset.students.reduce((sum, student) => sum + student.approvedLunches, 0);
  const totalKilometers = dataset.students.reduce((sum, student) => sum + student.approvedKilometers, 0);
  const classSummary = summarizeHoursByClass(dataset.students);

  renderStatCard(worksheet, { icon: '👥', label: 'Elever i urval', value: dataset.students.length, range: 'B6:C8', tone: 'orange' });
  renderStatCard(worksheet, { icon: '⏱', label: 'Totala timmar', value: Number(totalHours.toFixed(1)), range: 'D6:E8', tone: 'amber' });
  renderStatCard(worksheet, { icon: '✅', label: 'Godkända tidkort', value: `${totalApprovedTimesheets}/${totalTimesheets}`, range: 'F6:G8', tone: 'green' });
  renderStatCard(worksheet, { icon: '📝', label: 'Bedömningar', value: totalAssessments, range: 'H6:I8', tone: 'purple' });
  renderStatCard(worksheet, { icon: '📈', label: 'Godkännandegrad', value: getApprovalRate(totalApprovedTimesheets, totalTimesheets), range: 'B9:C11', tone: 'blue' });
  renderStatCard(worksheet, { icon: '💰', label: 'Ersättning', value: `${totalLunches} luncher | ${totalKilometers} km`, range: 'D9:G11', tone: 'teal' });

  worksheet.mergeCells('H9:I11');
  const classCell = worksheet.getCell('H9');
  classCell.value = classSummary.length > 0 ? `Största klass: ${classSummary[0][0]}` : 'Ingen klassdata';
  classCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  classCell.font = { size: 11, bold: true, color: { argb: `FF${REPORT_THEME.textStrong}` } };
  classCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
  classCell.border = {
    top: { style: 'thin', color: { argb: `FF${REPORT_THEME.borderStrong}` } },
    left: { style: 'thin', color: { argb: `FF${REPORT_THEME.borderStrong}` } },
    bottom: { style: 'thin', color: { argb: `FF${REPORT_THEME.borderStrong}` } },
    right: { style: 'thin', color: { argb: `FF${REPORT_THEME.borderStrong}` } },
  };

  await addSummaryChart(workbook, worksheet, dataset.students, fetchPieChartBase64);
  addSummaryTable(worksheet, dataset.students, 22);
}
