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
import type { ExcelExportDataset, ExcelExportStudent, PieChartSeries } from '@/shared/excel-report/types';

type ChartFetcher = (series: PieChartSeries) => Promise<string | null>;

function setupDashboardColumns(worksheet: ExcelJS.Worksheet) {
  worksheet.columns = [
    { width: 2.5 },
    { width: 13 },
    { width: 9 },
    { width: 13 },
    { width: 9 },
    { width: 13 },
    { width: 9 },
    { width: 13 },
    { width: 9 },
    { width: 12 },
    { width: 9 },
    { width: 12 },
    { width: 9 },
    { width: 12 },
    { width: 9 },
    { width: 2.5 },
  ];
}

function addLogoToSheet(workbook: ExcelJS.Workbook, worksheet: ExcelJS.Worksheet, logoBase64: string | null) {
  if (!logoBase64) return;
  const imageId = workbook.addImage({ base64: logoBase64, extension: 'png' });
  worksheet.addImage(imageId, {
    tl: { col: 1.2, row: 0.5 },
    ext: { width: 86, height: 86 },
  });
}

function decorateContainer(
  worksheet: ExcelJS.Worksheet,
  startRow: number,
  endRow: number,
  startCol: number,
  endCol: number,
  fill = 'FFFFFFFF',
) {
  for (let row = startRow; row <= endRow; row += 1) {
    for (let col = startCol; col <= endCol; col += 1) {
      const cell = worksheet.getRow(row).getCell(col);
      applySectionContainerStyle(cell);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: fill },
      };
    }
  }
}

function addDashboardHeader(
  workbook: ExcelJS.Workbook,
  worksheet: ExcelJS.Worksheet,
  generatedAt: Date,
  logoBase64: string | null,
  reportTitle: string,
) {
  decorateContainer(worksheet, 1, 5, 2, 15, 'FFFFFFFF');
  addLogoToSheet(workbook, worksheet, logoBase64);

  worksheet.mergeCells('C2:O2');
  worksheet.getCell('C2').value = reportTitle;
  applyBrandHeaderStyle(worksheet.getCell('C2'), true);

  worksheet.mergeCells('C3:O3');
  worksheet.getCell('C3').value = `Genererad: ${formatDateTime(generatedAt)} | Rapportspråk: Svenska`;
  applyBrandHeaderStyle(worksheet.getCell('C3'), false);

  worksheet.getRow(1).height = 16;
  worksheet.getRow(2).height = 34;
  worksheet.getRow(3).height = 22;
  worksheet.getRow(4).height = 16;

  for (let col = 2; col <= 15; col += 1) {
    const cell = worksheet.getRow(5).getCell(col);
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    };
  }
}

function addStudentTopCards(worksheet: ExcelJS.Worksheet, student: ExcelExportStudent) {
  renderStatCard(worksheet, { icon: '⏱', label: 'Totala timmar', value: Number(student.totalHours.toFixed(1)), range: 'B7:C10', tone: 'amber' });
  renderStatCard(worksheet, { icon: '✅', label: 'Godkända tidkort', value: `${student.approvedTimesheets}/${student.timesheetCount}`, range: 'D7:E10', tone: 'green' });
  renderStatCard(worksheet, { icon: '📝', label: 'Bedömningar', value: student.assessmentCount, range: 'F7:G10', tone: 'purple' });
  renderStatCard(worksheet, { icon: '📆', label: 'Antal veckor', value: getUniqueWeekCount(student.entries), range: 'H7:I10', tone: 'blue' });
  renderStatCard(worksheet, { icon: '🛠', label: 'Arbetsmoment', value: getUniqueActivityCount(student.entries), range: 'J7:K10', tone: 'teal' });
  renderStatCard(worksheet, { icon: '🍽', label: 'Luncher', value: student.approvedLunches, range: 'L7:M10', tone: 'green' });
  renderStatCard(worksheet, { icon: '🚗', label: 'Kilometer', value: student.approvedKilometers, range: 'N7:O10', tone: 'orange' });
}

function renderInfoPair(worksheet: ExcelJS.Worksheet, row: number, label: string, value: string, leftCell: string, rightCell: string) {
  worksheet.mergeCells(`${leftCell}${row}:${rightCell}${row}`);
  const cell = worksheet.getCell(`${leftCell}${row}`);
  cell.value = `${label}: ${value || '-'}`;
  cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: `FF${REPORT_THEME.textStrong}` } };
  cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
}

function addStudentInfoBlock(worksheet: ExcelJS.Worksheet, student: ExcelExportStudent) {
  decorateContainer(worksheet, 12, 17, 2, 8, 'FFF8FAFC');
  worksheet.mergeCells('B12:H12');
  worksheet.getCell('B12').value = 'Elevinformation';
  applySectionTitleStyle(worksheet.getCell('B12'));

  renderInfoPair(worksheet, 13, 'Elev', student.name, 'B', 'E');
  renderInfoPair(worksheet, 13, 'Klass', student.className || 'Ingen klass', 'F', 'H');
  renderInfoPair(worksheet, 14, 'Status', translateStatus(student.status), 'B', 'E');
  renderInfoPair(worksheet, 14, 'Handledare', student.supervisorName || '-', 'F', 'H');
  renderInfoPair(worksheet, 15, 'Senast registrerat', formatDateTime(student.lastRegisteredAt), 'B', 'H');
}

async function addStudentChartBlock(
  workbook: ExcelJS.Workbook,
  worksheet: ExcelJS.Worksheet,
  student: ExcelExportStudent,
  fetchPieChartBase64: ChartFetcher,
) {
  decorateContainer(worksheet, 12, 22, 9, 15, 'FFFFFFFF');

  worksheet.mergeCells('I12:O12');
  worksheet.getCell('I12').value = 'Fördelning av tid per arbetsmoment';
  applySectionTitleStyle(worksheet.getCell('I12'));

  const topActivities = summarizeHoursByActivity(student.entries).slice(0, 8);
  const chartBase64 = await fetchPieChartBase64({
    title: 'Arbetsmoment',
    labels: topActivities.map(([label]) => label),
    values: topActivities.map(([, value]) => Number(value.toFixed(2))),
  });

  if (!chartBase64) {
    worksheet.mergeCells('I15:O18');
    const emptyCell = worksheet.getCell('I15');
    emptyCell.value = 'Ingen aktivitetsdata att visa i diagram.';
    emptyCell.font = { size: 10, italic: true, color: { argb: `FF${REPORT_THEME.textMuted}` } };
    emptyCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    return;
  }

  const imageId = workbook.addImage({ base64: chartBase64, extension: 'png' });
  worksheet.addImage(imageId, {
    tl: { col: 8.95, row: 12.9 },
    ext: { width: 460, height: 280 },
  });
}

function addActivitySection(worksheet: ExcelJS.Worksheet, student: ExcelExportStudent, startRow: number): number {
  decorateContainer(worksheet, startRow, startRow + 1, 2, 15, 'FFFFFFFF');
  worksheet.mergeCells(`B${startRow}:O${startRow}`);
  worksheet.getCell(`B${startRow}`).value = 'Aktiviteter';
  applySectionTitleStyle(worksheet.getCell(`B${startRow}`));

  const headerRowIndex = startRow + 1;
  const headerRow = worksheet.getRow(headerRowIndex);
  headerRow.values = ['', 'Datum', 'Vecka', 'Veckodag', 'Arbetsmoment', '', 'Typ', 'Timmar', 'Godkänd', 'Kommentarer'];
  headerRow.height = 26;
  worksheet.mergeCells(`E${headerRowIndex}:F${headerRowIndex}`);
  worksheet.mergeCells(`J${headerRowIndex}:O${headerRowIndex}`);

  for (let col = 2; col <= 9; col += 1) {
    applyHeaderCellStyle(headerRow.getCell(col));
  }
  applyHeaderCellStyle(worksheet.getCell(`J${headerRowIndex}`));

  const activityEntries = student.entries
    .filter((entry) => entry.source === 'Tidkort')
    .sort((a, b) => (b.registeredAt?.getTime() || 0) - (a.registeredAt?.getTime() || 0));

  let rowIndex = headerRowIndex + 1;
  if (activityEntries.length === 0) {
    worksheet.mergeCells(`B${rowIndex}:O${rowIndex}`);
    const emptyCell = worksheet.getCell(`B${rowIndex}`);
    emptyCell.value = 'Ingen aktivitetsdata tillgänglig.';
    emptyCell.font = { italic: true, color: { argb: `FF${REPORT_THEME.textMuted}` } };
    emptyCell.alignment = { vertical: 'middle', horizontal: 'left' };
    return rowIndex + 2;
  }

  for (const entry of activityEntries) {
    const row = worksheet.getRow(rowIndex);
    row.values = [
      '',
      formatDate(entry.registeredAt),
      getIsoWeekNumber(entry.weekStart),
      translateDayLabel(entry.dayLabel),
      entry.activity || '-',
      '',
      entry.source,
      Number(entry.hours.toFixed(2)),
      entry.approved ? 'Ja' : 'Nej',
      entry.comment || '-',
    ];

    worksheet.mergeCells(`E${rowIndex}:F${rowIndex}`);
    worksheet.mergeCells(`J${rowIndex}:O${rowIndex}`);

    for (let col = 2; col <= 9; col += 1) {
      const cell = row.getCell(col);
      applyBodyCellStyle(cell);
      applyZebraFill(cell, rowIndex);
    }
    const commentCell = worksheet.getCell(`J${rowIndex}`);
    applyBodyCellStyle(commentCell);
    applyZebraFill(commentCell, rowIndex);

    row.getCell(8).numFmt = '0.00';
    row.height = 24;
    rowIndex += 1;
  }

  worksheet.autoFilter = {
    from: { row: headerRowIndex, column: 2 },
    to: { row: headerRowIndex, column: 9 },
  };

  return rowIndex + 1;
}

function addAssessmentsSection(worksheet: ExcelJS.Worksheet, student: ExcelExportStudent, startRow: number): number {
  decorateContainer(worksheet, startRow, startRow + 1, 2, 15, 'FFFFFFFF');
  worksheet.mergeCells(`B${startRow}:O${startRow}`);
  worksheet.getCell(`B${startRow}`).value = 'Bedömningar';
  applySectionTitleStyle(worksheet.getCell(`B${startRow}`));

  const headerRowIndex = startRow + 1;
  const headerRow = worksheet.getRow(headerRowIndex);
  headerRow.values = ['', 'Datum', 'Bedömare', 'Bedömning', '', 'Kommentar', '', '', '', 'Status / Företag'];
  headerRow.height = 26;

  worksheet.mergeCells(`D${headerRowIndex}:E${headerRowIndex}`);
  worksheet.mergeCells(`F${headerRowIndex}:I${headerRowIndex}`);
  worksheet.mergeCells(`J${headerRowIndex}:O${headerRowIndex}`);

  for (let col = 2; col <= 3; col += 1) {
    applyHeaderCellStyle(headerRow.getCell(col));
  }
  applyHeaderCellStyle(worksheet.getCell(`D${headerRowIndex}`));
  applyHeaderCellStyle(worksheet.getCell(`F${headerRowIndex}`));
  applyHeaderCellStyle(worksheet.getCell(`J${headerRowIndex}`));

  let rowIndex = headerRowIndex + 1;
  if (student.assessments.length === 0) {
    worksheet.mergeCells(`B${rowIndex}:O${rowIndex}`);
    const emptyCell = worksheet.getCell(`B${rowIndex}`);
    emptyCell.value = 'Ingen bedömning registrerad för eleven.';
    emptyCell.font = { italic: true, color: { argb: `FF${REPORT_THEME.textMuted}` } };
    emptyCell.alignment = { vertical: 'middle', horizontal: 'left' };
    return rowIndex + 2;
  }

  for (const assessment of student.assessments) {
    const row = worksheet.getRow(rowIndex);
    row.values = [
      '',
      formatDate(assessment.submittedAt),
      assessment.assessorName || '-',
      assessment.rating || '-',
      '',
      assessment.comment || '-',
      '',
      '',
      '',
      `${translateAssessmentStatus(assessment.status)} | ${assessment.assessorCompany || '-'}`,
    ];

    worksheet.mergeCells(`D${rowIndex}:E${rowIndex}`);
    worksheet.mergeCells(`F${rowIndex}:I${rowIndex}`);
    worksheet.mergeCells(`J${rowIndex}:O${rowIndex}`);

    for (const cellRef of [`B${rowIndex}`, `C${rowIndex}`, `D${rowIndex}`, `F${rowIndex}`, `J${rowIndex}`]) {
      const cell = worksheet.getCell(cellRef);
      applyBodyCellStyle(cell);
      applyZebraFill(cell, rowIndex);
    }

    row.height = 24;
    rowIndex += 1;
  }

  return rowIndex + 1;
}

function addCompensationSection(worksheet: ExcelJS.Worksheet, student: ExcelExportStudent, startRow: number): number {
  decorateContainer(worksheet, startRow, startRow + 2, 2, 15, 'FFFFFFFF');

  worksheet.mergeCells(`B${startRow}:O${startRow}`);
  worksheet.getCell(`B${startRow}`).value = 'Luncher & Kilometer';
  applySectionTitleStyle(worksheet.getCell(`B${startRow}`));

  renderStatCard(worksheet, {
    icon: '🍽',
    label: 'Luncher',
    value: student.approvedLunches,
    range: `B${startRow + 1}:G${startRow + 2}`,
    tone: 'green',
  });
  renderStatCard(worksheet, {
    icon: '🚗',
    label: 'Kilometer',
    value: `${student.approvedKilometers} km`,
    range: `H${startRow + 1}:O${startRow + 2}`,
    tone: 'blue',
  });

  let rowIndex = startRow + 4;
  const headerRow = worksheet.getRow(rowIndex);
  headerRow.values = ['', 'Vecka', 'Luncher', 'Kilometer', 'Källa', '', 'Kommentar'];
  headerRow.height = 24;

  worksheet.mergeCells(`F${rowIndex}:I${rowIndex}`);
  worksheet.mergeCells(`J${rowIndex}:O${rowIndex}`);

  for (const cellRef of [`B${rowIndex}`, `C${rowIndex}`, `D${rowIndex}`, `E${rowIndex}`, `J${rowIndex}`]) {
    applyHeaderCellStyle(worksheet.getCell(cellRef));
  }

  rowIndex += 1;
  if (student.compensations.length === 0) {
    worksheet.mergeCells(`B${rowIndex}:O${rowIndex}`);
    const emptyCell = worksheet.getCell(`B${rowIndex}`);
    emptyCell.value = 'Ingen ersättningsdata registrerad.';
    emptyCell.font = { italic: true, color: { argb: `FF${REPORT_THEME.textMuted}` } };
    emptyCell.alignment = { vertical: 'middle', horizontal: 'left' };
    return rowIndex + 2;
  }

  for (const compensation of student.compensations) {
    const row = worksheet.getRow(rowIndex);
    row.values = [
      '',
      getIsoWeekNumber(compensation.weekStart),
      compensation.lunches,
      compensation.kilometers,
      compensation.source === 'Bedomning' ? 'Bedömning' : 'Ersättning',
      '',
      compensation.comment || '-',
    ];

    worksheet.mergeCells(`F${rowIndex}:I${rowIndex}`);
    worksheet.mergeCells(`J${rowIndex}:O${rowIndex}`);

    for (const cellRef of [`B${rowIndex}`, `C${rowIndex}`, `D${rowIndex}`, `E${rowIndex}`, `J${rowIndex}`]) {
      const cell = worksheet.getCell(cellRef);
      applyBodyCellStyle(cell);
      applyZebraFill(cell, rowIndex);
    }

    row.height = 22;
    rowIndex += 1;
  }

  return rowIndex + 1;
}

function addFooter(worksheet: ExcelJS.Worksheet, rowIndex: number) {
  decorateContainer(worksheet, rowIndex, rowIndex + 1, 2, 15, 'FFF8FAFC');
  worksheet.mergeCells(`B${rowIndex}:O${rowIndex + 1}`);
  const cell = worksheet.getCell(`B${rowIndex}`);
  cell.value = 'APL-appen Dashboard Report | Data avser valt urval av elevens tidkort, bedömningar och ersättningar.';
  cell.font = { size: 10, color: { argb: `FF${REPORT_THEME.textMuted}` } };
  cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
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
    views: [{ state: 'normal', showGridLines: false }],
  });

  setupDashboardColumns(worksheet);
  setPageBackground(worksheet, 1, 420, 1, 16);

  addDashboardHeader(workbook, worksheet, generatedAt, logoBase64, reportTitle);
  addStudentTopCards(worksheet, student);
  addStudentInfoBlock(worksheet, student);
  await addStudentChartBlock(workbook, worksheet, student, fetchPieChartBase64);

  const afterActivity = addActivitySection(worksheet, student, 24);
  const afterAssessments = addAssessmentsSection(worksheet, student, afterActivity);
  const afterCompensation = addCompensationSection(worksheet, student, afterAssessments);
  addFooter(worksheet, afterCompensation + 1);
}

function addSummaryCards(worksheet: ExcelJS.Worksheet, dataset: ExcelExportDataset) {
  const totalHours = dataset.students.reduce((sum, student) => sum + student.totalHours, 0);
  const totalTimesheets = dataset.students.reduce((sum, student) => sum + student.timesheetCount, 0);
  const totalApprovedTimesheets = dataset.students.reduce((sum, student) => sum + student.approvedTimesheets, 0);
  const totalAssessments = dataset.students.reduce((sum, student) => sum + student.assessmentCount, 0);
  const totalLunches = dataset.students.reduce((sum, student) => sum + student.approvedLunches, 0);
  const totalKilometers = dataset.students.reduce((sum, student) => sum + student.approvedKilometers, 0);
  const allEntries = dataset.students.flatMap((student) => student.entries);

  renderStatCard(worksheet, { icon: '👥', label: 'Elever', value: dataset.students.length, range: 'B7:C10', tone: 'orange' });
  renderStatCard(worksheet, { icon: '⏱', label: 'Totala timmar', value: Number(totalHours.toFixed(1)), range: 'D7:E10', tone: 'amber' });
  renderStatCard(worksheet, { icon: '✅', label: 'Godkända tidkort', value: `${totalApprovedTimesheets}/${totalTimesheets}`, range: 'F7:G10', tone: 'green' });
  renderStatCard(worksheet, { icon: '📝', label: 'Bedömningar', value: totalAssessments, range: 'H7:I10', tone: 'purple' });
  renderStatCard(worksheet, { icon: '🛠', label: 'Arbetsmoment', value: getUniqueActivityCount(allEntries), range: 'J7:K10', tone: 'teal' });
  renderStatCard(worksheet, { icon: '🍽', label: 'Luncher', value: totalLunches, range: 'L7:M10', tone: 'green' });
  renderStatCard(worksheet, { icon: '🚗', label: 'Kilometer', value: totalKilometers, range: 'N7:O10', tone: 'blue' });

  worksheet.mergeCells('B11:O12');
  const rateCell = worksheet.getCell('B11');
  rateCell.value = `Godkännandegrad: ${getApprovalRate(totalApprovedTimesheets, totalTimesheets)}`;
  rateCell.font = { size: 11, bold: true, color: { argb: `FF${REPORT_THEME.textStrong}` } };
  rateCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  rateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
  rateCell.border = {
    top: { style: 'thin', color: { argb: `FF${REPORT_THEME.borderStrong}` } },
    left: { style: 'thin', color: { argb: `FF${REPORT_THEME.borderStrong}` } },
    bottom: { style: 'thin', color: { argb: `FF${REPORT_THEME.borderStrong}` } },
    right: { style: 'thin', color: { argb: `FF${REPORT_THEME.borderStrong}` } },
  };
}

async function addSummaryChart(
  workbook: ExcelJS.Workbook,
  worksheet: ExcelJS.Worksheet,
  students: ExcelExportStudent[],
  fetchPieChartBase64: ChartFetcher,
) {
  decorateContainer(worksheet, 14, 25, 9, 15, 'FFFFFFFF');
  worksheet.mergeCells('I14:O14');
  worksheet.getCell('I14').value = 'Fördelning av tid per arbetsmoment';
  applySectionTitleStyle(worksheet.getCell('I14'));

  const activitySummary = summarizeHoursByActivity(students.flatMap((student) => student.entries)).slice(0, 8);
  const activityChart = await fetchPieChartBase64({
    title: 'Arbetsmoment i urvalet',
    labels: activitySummary.map(([label]) => label),
    values: activitySummary.map(([, value]) => Number(value.toFixed(2))),
  });

  if (!activityChart) {
    worksheet.mergeCells('I18:O20');
    const cell = worksheet.getCell('I18');
    cell.value = 'Ingen data tillgänglig för diagram.';
    cell.font = { italic: true, color: { argb: `FF${REPORT_THEME.textMuted}` } };
    return;
  }

  const imageId = workbook.addImage({ base64: activityChart, extension: 'png' });
  worksheet.addImage(imageId, {
    tl: { col: 8.95, row: 14.9 },
    ext: { width: 460, height: 280 },
  });
}

function addSummaryTable(worksheet: ExcelJS.Worksheet, students: ExcelExportStudent[], startRow: number): number {
  decorateContainer(worksheet, startRow, startRow + 1, 2, 15, 'FFFFFFFF');
  worksheet.mergeCells(`B${startRow}:O${startRow}`);
  worksheet.getCell(`B${startRow}`).value = 'Sammanställning per elev';
  applySectionTitleStyle(worksheet.getCell(`B${startRow}`));

  const headerRowIndex = startRow + 1;
  const headerRow = worksheet.getRow(headerRowIndex);
  headerRow.values = ['', 'Elev', '', 'Klass', '', 'Timmar', 'Godkända tidkort', 'Bedömningar', 'Luncher', 'Kilometer', 'Senast registrerat'];
  headerRow.height = 24;

  worksheet.mergeCells(`B${headerRowIndex}:C${headerRowIndex}`);
  worksheet.mergeCells(`D${headerRowIndex}:E${headerRowIndex}`);
  worksheet.mergeCells(`K${headerRowIndex}:O${headerRowIndex}`);

  for (const cellRef of [`B${headerRowIndex}`, `D${headerRowIndex}`, `F${headerRowIndex}`, `G${headerRowIndex}`, `H${headerRowIndex}`, `I${headerRowIndex}`, `J${headerRowIndex}`, `K${headerRowIndex}`]) {
    applyHeaderCellStyle(worksheet.getCell(cellRef));
  }

  let rowIndex = headerRowIndex + 1;
  for (const student of students) {
    const row = worksheet.getRow(rowIndex);
    row.values = [
      '',
      student.name,
      '',
      student.className,
      '',
      Number(student.totalHours.toFixed(1)),
      `${student.approvedTimesheets}/${student.timesheetCount}`,
      student.assessmentCount,
      student.approvedLunches,
      student.approvedKilometers,
      formatDateTime(student.lastRegisteredAt),
    ];

    worksheet.mergeCells(`B${rowIndex}:C${rowIndex}`);
    worksheet.mergeCells(`D${rowIndex}:E${rowIndex}`);
    worksheet.mergeCells(`K${rowIndex}:O${rowIndex}`);

    for (const cellRef of [`B${rowIndex}`, `D${rowIndex}`, `F${rowIndex}`, `G${rowIndex}`, `H${rowIndex}`, `I${rowIndex}`, `J${rowIndex}`, `K${rowIndex}`]) {
      const cell = worksheet.getCell(cellRef);
      applyBodyCellStyle(cell);
      applyZebraFill(cell, rowIndex);
    }

    row.height = 22;
    rowIndex += 1;
  }

  return rowIndex + 1;
}

export async function buildSummaryDashboardSheet(
  workbook: ExcelJS.Workbook,
  dataset: ExcelExportDataset,
  logoBase64: string | null,
  fetchPieChartBase64: ChartFetcher,
  reportTitle: string,
) {
  const worksheet = workbook.addWorksheet('Sammanfattning', {
    views: [{ state: 'normal', showGridLines: false }],
  });

  setupDashboardColumns(worksheet);
  setPageBackground(worksheet, 1, 320, 1, 16);

  addDashboardHeader(workbook, worksheet, dataset.generatedAt, logoBase64, reportTitle);
  addSummaryCards(worksheet, dataset);
  await addSummaryChart(workbook, worksheet, dataset.students, fetchPieChartBase64);

  const classSummary = summarizeHoursByClass(dataset.students);
  decorateContainer(worksheet, 14, 18, 2, 8, 'FFF8FAFC');
  worksheet.mergeCells('B14:H14');
  worksheet.getCell('B14').value = 'Översikt';
  applySectionTitleStyle(worksheet.getCell('B14'));
  worksheet.mergeCells('B15:H16');
  worksheet.getCell('B15').value = classSummary.length > 0 ? `Största klass: ${classSummary[0][0]}` : 'Ingen klassdata';
  worksheet.getCell('B15').font = { size: 11, bold: true, color: { argb: `FF${REPORT_THEME.textStrong}` } };
  worksheet.getCell('B15').alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

  const afterTable = addSummaryTable(worksheet, dataset.students, 28);
  addFooter(worksheet, afterTable + 1);
}
