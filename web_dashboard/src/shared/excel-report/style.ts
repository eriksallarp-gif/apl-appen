import ExcelJS from 'exceljs';

export const REPORT_THEME = {
  primary: 'F97316',
  primarySoft: 'FFF7ED',
  primarySoftAlt: 'FFEDD5',
  cardBlue: 'E8F0FF',
  cardGreen: 'EAF8EE',
  cardPurple: 'F4ECFF',
  cardAmber: 'FFF4DD',
  cardTeal: 'E6F8F7',
  cardSlate: 'E2E8F0',
  zebra: 'F9FAFB',
  textDark: '111827',
  textMuted: '6B7280',
  textStrong: '0F172A',
  border: 'FDBA74',
  borderSoft: 'E5E7EB',
  borderStrong: 'CBD5E1',
  success: '16A34A',
};

export type StatCardTone = 'orange' | 'blue' | 'green' | 'purple' | 'amber' | 'teal';

const CARD_TONE_MAP: Record<StatCardTone, { bg: string; value: string; border: string }> = {
  orange: { bg: REPORT_THEME.primarySoft, value: 'C2410C', border: 'FDBA74' },
  blue: { bg: REPORT_THEME.cardBlue, value: '1D4ED8', border: 'BFDBFE' },
  green: { bg: REPORT_THEME.cardGreen, value: '15803D', border: 'BBF7D0' },
  purple: { bg: REPORT_THEME.cardPurple, value: '7E22CE', border: 'DDD6FE' },
  amber: { bg: REPORT_THEME.cardAmber, value: 'B45309', border: 'FDE68A' },
  teal: { bg: REPORT_THEME.cardTeal, value: '0F766E', border: '99F6E4' },
};

export function safeSheetName(name: string): string {
  const cleaned = name.replace(/[\\/*?:\[\]]/g, ' ').trim();
  return cleaned.length > 31 ? cleaned.slice(0, 31) : cleaned || 'Elev';
}

export function formatDateTime(date: Date | null): string {
  if (!date) {
    return '-';
  }

  return new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatDate(date: Date | null): string {
  if (!date) {
    return '-';
  }

  return new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function getIsoWeekNumber(weekStart: string): string {
  const source = String(weekStart || '').trim();
  if (!source) return '-';

  const parsed = new Date(source);
  if (Number.isNaN(parsed.getTime())) {
    return '-';
  }

  const utcDate = new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return String(weekNo);
}

export function translateDayLabel(dayLabel: string): string {
  const normalized = String(dayLabel || '').trim().toLowerCase();
  const dayMap: Record<string, string> = {
    mon: 'Måndag',
    monday: 'Måndag',
    mån: 'Måndag',
    mandag: 'Måndag',
    tue: 'Tisdag',
    tues: 'Tisdag',
    tuesday: 'Tisdag',
    tis: 'Tisdag',
    wed: 'Onsdag',
    wednesday: 'Onsdag',
    ons: 'Onsdag',
    thu: 'Torsdag',
    thur: 'Torsdag',
    thurs: 'Torsdag',
    thursday: 'Torsdag',
    tor: 'Torsdag',
    fri: 'Fredag',
    friday: 'Fredag',
    fre: 'Fredag',
    sat: 'Lördag',
    saturday: 'Lördag',
    lör: 'Lördag',
    lor: 'Lördag',
    sun: 'Söndag',
    sunday: 'Söndag',
    sön: 'Söndag',
    son: 'Söndag',
  };

  return dayMap[normalized] || (dayLabel ? `${dayLabel}` : '-');
}

export function applyHeaderCellStyle(cell: ExcelJS.Cell) {
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: `FF${REPORT_THEME.primary}` },
  };
  cell.font = {
    bold: true,
    color: { argb: 'FFFFFFFF' },
    size: 11,
  };
  cell.alignment = {
    vertical: 'middle',
    horizontal: 'left',
    wrapText: true,
  };
  cell.border = {
    top: { style: 'thin', color: { argb: `FF${REPORT_THEME.border}` } },
    left: { style: 'thin', color: { argb: `FF${REPORT_THEME.border}` } },
    bottom: { style: 'thin', color: { argb: `FF${REPORT_THEME.border}` } },
    right: { style: 'thin', color: { argb: `FF${REPORT_THEME.border}` } },
  };
}

export function applyBodyCellStyle(cell: ExcelJS.Cell) {
  cell.border = {
    top: { style: 'thin', color: { argb: `FF${REPORT_THEME.borderSoft}` } },
    left: { style: 'thin', color: { argb: `FF${REPORT_THEME.borderSoft}` } },
    bottom: { style: 'thin', color: { argb: `FF${REPORT_THEME.borderSoft}` } },
    right: { style: 'thin', color: { argb: `FF${REPORT_THEME.borderSoft}` } },
  };
  cell.font = { size: 10, color: { argb: `FF${REPORT_THEME.textDark}` } };
  cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
}

export function applySectionTitleStyle(cell: ExcelJS.Cell) {
  cell.font = {
    bold: true,
    size: 12,
    color: { argb: `FF${REPORT_THEME.textStrong}` },
  };
  cell.alignment = { vertical: 'middle', horizontal: 'left' };
}

export function applySectionContainerStyle(cell: ExcelJS.Cell) {
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFFFFF' },
  };
  cell.border = {
    top: { style: 'thin', color: { argb: `FF${REPORT_THEME.borderStrong}` } },
    left: { style: 'thin', color: { argb: `FF${REPORT_THEME.borderStrong}` } },
    bottom: { style: 'thin', color: { argb: `FF${REPORT_THEME.borderStrong}` } },
    right: { style: 'thin', color: { argb: `FF${REPORT_THEME.borderStrong}` } },
  };
}

export function applyZebraFill(cell: ExcelJS.Cell, rowIndex: number) {
  if (rowIndex % 2 === 0) {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${REPORT_THEME.zebra}` },
    };
  }
}

export function setPageBackground(worksheet: ExcelJS.Worksheet, startRow = 1, endRow = 140, startCol = 1, endCol = 11) {
  for (let row = startRow; row <= endRow; row += 1) {
    for (let col = startCol; col <= endCol; col += 1) {
      const cell = worksheet.getRow(row).getCell(col);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFFFF' },
      };
    }
  }
}

export function renderStatCard(
  worksheet: ExcelJS.Worksheet,
  config: {
    icon?: string;
    label: string;
    value: string | number;
    range: string;
    tone: StatCardTone;
  },
) {
  const toneConfig = CARD_TONE_MAP[config.tone];
  worksheet.mergeCells(config.range);
  const cell = worksheet.getCell(config.range.split(':')[0]);
  const iconPrefix = config.icon ? `${config.icon}  ` : '';
  cell.value = `${iconPrefix}${config.label}\n${config.value}`;
  cell.alignment = {
    vertical: 'middle',
    horizontal: 'left',
    wrapText: true,
  };
  cell.font = {
    name: 'Segoe UI',
    size: 12,
    bold: true,
    color: { argb: `FF${toneConfig.value}` },
  };
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: `FF${toneConfig.bg}` },
  };
  cell.border = {
    top: { style: 'thin', color: { argb: `FF${toneConfig.border}` } },
    left: { style: 'thin', color: { argb: `FF${toneConfig.border}` } },
    bottom: { style: 'thin', color: { argb: `FF${toneConfig.border}` } },
    right: { style: 'thin', color: { argb: `FF${toneConfig.border}` } },
  };
}

export function applyBrandHeaderStyle(cell: ExcelJS.Cell, isTitle: boolean) {
  if (isTitle) {
    cell.font = {
      bold: true,
      size: 20,
      color: { argb: `FF${REPORT_THEME.textDark}` },
    };
  } else {
    cell.font = {
      size: 11,
      color: { argb: `FF${REPORT_THEME.textMuted}` },
    };
  }

  cell.alignment = { vertical: 'middle', horizontal: 'left' };
}
