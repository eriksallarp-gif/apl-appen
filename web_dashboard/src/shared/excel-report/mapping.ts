import type { ExcelExportEntry, ExcelExportStudent } from '@/shared/excel-report/types';

export function summarizeHoursByActivity(entries: ExcelExportEntry[]): Array<[string, number]> {
  const byActivity = new Map<string, number>();

  for (const entry of entries.filter((item) => item.source === 'Tidkort')) {
    const activityName = String(entry.activity || '').trim() || 'Övrigt';
    byActivity.set(activityName, (byActivity.get(activityName) || 0) + entry.hours);
  }

  return Array.from(byActivity.entries())
    .sort((a, b) => b[1] - a[1])
    .filter((item) => item[1] > 0);
}

export function summarizeHoursByClass(students: ExcelExportStudent[]): Array<[string, number]> {
  const byClass = new Map<string, number>();
  for (const student of students) {
    const className = String(student.className || '').trim() || 'Ingen klass';
    byClass.set(className, (byClass.get(className) || 0) + student.totalHours);
  }

  return Array.from(byClass.entries()).sort((a, b) => b[1] - a[1]);
}

export function getUniqueActivityCount(entries: ExcelExportEntry[]): number {
  return new Set(
    entries
      .filter((entry) => entry.source === 'Tidkort')
      .map((entry) => String(entry.activity || '').trim().toLowerCase())
      .filter(Boolean),
  ).size;
}

export function getUniqueWeekCount(entries: ExcelExportEntry[]): number {
  return new Set(entries.map((entry) => String(entry.weekStart || '').trim()).filter(Boolean)).size;
}

export function getApprovalRate(approved: number, total: number): string {
  if (!total) return '0%';
  return `${Math.round((approved / total) * 100)}%`;
}

export function translateStatus(status: string): string {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'active') return 'Aktiv';
  if (normalized === 'frozen') return 'Fryst';
  if (normalized === 'inactive') return 'Inaktiv';
  return status || 'Okänd';
}

export function translateAssessmentStatus(status: string): string {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'approved') return 'Godkänd';
  if (normalized === 'submitted') return 'Skickad';
  if (normalized === 'pending') return 'Väntar';
  if (normalized === 'rejected') return 'Nekad';
  return status || '-';
}
