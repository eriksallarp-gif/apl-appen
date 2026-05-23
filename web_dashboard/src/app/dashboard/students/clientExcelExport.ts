import {
  collection,
  getDocs,
  query,
  where,
  type Firestore,
  type QueryConstraint,
} from 'firebase/firestore';
import { buildExcelReportWorkbook } from '@/shared/excel-report/workbook';
import { fetchPieChartBase64 } from '@/shared/excel-report/chart';
import type {
  ExcelExportAssessment,
  ExcelExportCompensation,
  ExcelExportDataset,
  ExcelExportEntry,
  ExcelExportStudent,
} from '@/shared/excel-report/types';

export type ExportScope = 'single' | 'multiple' | 'class' | 'all';

export type ExportStudentInput = {
  id: string;
  name: string;
  email: string;
  classId: string;
  className: string;
  specialization: string;
  status?: string;
};

type ClientExportOptions = {
  db: Firestore;
  role: 'teacher' | 'admin';
  currentUserUid: string;
  scope: ExportScope;
  selectedStudentId: string;
  selectedStudentIds: string[];
  selectedClassId: string;
  students: ExportStudentInput[];
};

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

function selectStudents(options: ClientExportOptions): ExportStudentInput[] {
  const byId = new Map(options.students.map((student) => [student.id, student]));

  if (options.scope === 'single') {
    const selected = byId.get(options.selectedStudentId);
    return selected ? [selected] : [];
  }

  if (options.scope === 'multiple') {
    return options.selectedStudentIds
      .map((studentId) => byId.get(studentId))
      .filter((student): student is ExportStudentInput => Boolean(student));
  }

  if (options.scope === 'class') {
    return options.students.filter((student) => student.classId === options.selectedClassId);
  }

  return options.students;
}

function maxDate(entries: ExcelExportEntry[]): Date | null {
  const dates = entries
    .map((entry) => entry.registeredAt)
    .filter((value): value is Date => value instanceof Date)
    .sort((a, b) => b.getTime() - a.getTime());

  return dates[0] || null;
}

async function loadStudentRecord(options: {
  db: Firestore;
  student: ExportStudentInput;
  role: 'teacher' | 'admin';
  currentUserUid: string;
}): Promise<ExcelExportStudent> {
  const { db, student, role, currentUserUid } = options;

  const timesheetConstraints: QueryConstraint[] = [where('studentUid', '==', student.id)];
  if (role === 'teacher') {
    timesheetConstraints.push(where('teacherUid', '==', currentUserUid));
  }

  const timesheetSnapshot = await getDocs(query(collection(db, 'timesheets'), ...timesheetConstraints));

  const assessmentConstraints: QueryConstraint[] = [where('studentUid', '==', student.id)];
  if (role === 'teacher') {
    assessmentConstraints.push(where('teacherUid', '==', currentUserUid));
  }

  const assessmentSnapshot = await getDocs(query(collection(db, 'assessmentRequests'), ...assessmentConstraints));

  const entries: ExcelExportEntry[] = [];
  const assessments: ExcelExportAssessment[] = [];
  const compensations: ExcelExportCompensation[] = [];
  let approvedTimesheets = 0;

  const isDayLike = (value: string): boolean => {
    const normalized = String(value || '').trim().toLowerCase();
    return [
      'mon',
      'monday',
      'mån',
      'mandag',
      'tue',
      'tues',
      'tuesday',
      'tis',
      'wed',
      'wednesday',
      'ons',
      'thu',
      'thur',
      'thurs',
      'thursday',
      'tor',
      'fri',
      'friday',
      'fre',
      'sat',
      'saturday',
      'lör',
      'lor',
      'sun',
      'sunday',
      'sön',
      'son',
    ].includes(normalized);
  };

  for (const timesheetDoc of timesheetSnapshot.docs) {
    const data = timesheetDoc.data() || {};
    const approved = Boolean(data.approved);
    if (approved) {
      approvedTimesheets += 1;
    }

    const fallbackDate = parseDate(data.submittedAt) || parseDate(data.updatedAt) || parseDate(data.createdAt);
    const rawEntries = (data.entries || {}) as Record<string, unknown>;
    const rawComments = (data.comments || {}) as Record<string, unknown>;

    for (const [outerKey, innerRaw] of Object.entries(rawEntries)) {
      if (!innerRaw || typeof innerRaw !== 'object') {
        continue;
      }

      const innerEntries = Object.entries(innerRaw as Record<string, unknown>);
      const innerHasDayLikeKey = innerEntries.some(([innerKey]) => isDayLike(innerKey));
      const outerIsDayLike = isDayLike(outerKey);

      for (const [innerKey, hoursRaw] of innerEntries) {
        const dayLabel = outerIsDayLike || !innerHasDayLikeKey ? outerKey : innerKey;
        const activityName = outerIsDayLike || !innerHasDayLikeKey ? innerKey : outerKey;
        const hours = Number(hoursRaw || 0);
        entries.push({
          registeredAt: fallbackDate,
          weekStart: String(data.weekStart || ''),
          dayLabel,
          source: 'Tidkort',
          activity: activityName,
          hours: Number.isFinite(hours) ? hours : 0,
          approved,
          comment: String(rawComments[activityName] || ''),
        });
      }
    }
  }

  for (const assessmentDoc of assessmentSnapshot.docs) {
    const data = assessmentDoc.data() || {};
    const assessmentData = (data.assessmentData || {}) as Record<string, unknown>;
    const lunchApproved = Number(data.lunchApproved ?? data.lunchCount ?? assessmentData.lunchApproved ?? 0) || 0;
    const travelApproved = Number(data.travelApproved ?? data.travelCount ?? assessmentData.travelApproved ?? 0) || 0;

    assessments.push({
      id: assessmentDoc.id,
      submittedAt: parseDate(data.submittedAt),
      weekStart: String(data.weekStart || ''),
      assessorName: String(data.supervisorName || '-'),
      assessorCompany: String(data.supervisorCompany || '-'),
      rating: String(data.averageRating || '-'),
      status: String(data.status || ''),
      comment: String(data.comment || assessmentData.comment || '-'),
      lunchApproved,
      travelApproved,
    });

    compensations.push({
      id: `assessment_${assessmentDoc.id}`,
      weekStart: String(data.weekStart || ''),
      lunches: lunchApproved,
      kilometers: travelApproved,
      source: 'Bedomning',
      comment: String(data.comment || assessmentData.comment || ''),
    });
  }

  const compensationSnapshot = await getDocs(query(collection(db, 'compensation'), where('studentUid', '==', student.id)));
  for (const compensationDoc of compensationSnapshot.docs) {
    const data = compensationDoc.data() || {};
    compensations.push({
      id: compensationDoc.id,
      weekStart: String(data.weekStart || ''),
      lunches: Number(data.lunchCount ?? data.lunchApproved ?? 0) || 0,
      kilometers: Number(data.travelCount ?? data.travelApproved ?? 0) || 0,
      source: 'Compensation',
      comment: String(data.comment || data.description || ''),
    });
  }

  entries.sort((a, b) => (b.registeredAt?.getTime() || 0) - (a.registeredAt?.getTime() || 0));
  assessments.sort((a, b) => (b.submittedAt?.getTime() || 0) - (a.submittedAt?.getTime() || 0));

  const totalHours = entries
    .filter((entry) => entry.source === 'Tidkort')
    .reduce((sum, entry) => sum + entry.hours, 0);

  const approvedLunches = compensations.reduce((sum, row) => sum + row.lunches, 0);
  const approvedKilometers = compensations.reduce((sum, row) => sum + row.kilometers, 0);
  const supervisorName = assessments.find((row) => row.assessorName && row.assessorName !== '-')?.assessorName || '-';

  return {
    id: student.id,
    name: student.name,
    email: student.email,
    classId: student.classId,
    className: student.className || 'Ingen klass',
    specialization: student.specialization || '-',
    status: student.status || 'active',
    supervisorName,
    totalHours,
    approvedTimesheets,
    timesheetCount: timesheetSnapshot.size,
    assessmentCount: assessmentSnapshot.size,
    approvedLunches,
    approvedKilometers,
    firstRegisteredAt: null,
    lastRegisteredAt: maxDate(entries),
    entries,
    assessments,
    compensations,
  };
}

function triggerDownload(arrayBuffer: ArrayBuffer, fileName: string) {
  const blob = new Blob([arrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

async function loadLogoBase64(): Promise<string | null> {
  const candidates = ['/apl_logo_512_padded.png', '/logo.png'];

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, { cache: 'force-cache' });
      if (!response.ok) {
        continue;
      }

      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let index = 0; index < bytes.length; index += 1) {
        binary += String.fromCharCode(bytes[index]);
      }
      return btoa(binary);
    } catch {
      // Try next candidate.
    }
  }

  return null;
}

export async function exportStudentsToExcelInBrowser(options: ClientExportOptions): Promise<void> {
  const selectedStudents = selectStudents(options);
  if (selectedStudents.length === 0) {
    throw new Error('Inga elever matchade valt exporturval.');
  }

  const records: ExcelExportStudent[] = [];
  for (const student of selectedStudents) {
    const record = await loadStudentRecord({
      db: options.db,
      student,
      role: options.role,
      currentUserUid: options.currentUserUid,
    });
    records.push(record);
  }

  records.sort((a, b) => a.name.localeCompare(b.name, 'sv'));

  const dataset: ExcelExportDataset = {
    generatedAt: new Date(),
    students: records,
  };

  const logoBase64 = await loadLogoBase64();

  const workbook = await buildExcelReportWorkbook({
    dataset,
    logoBase64,
    fetchPieChartBase64,
    reportTitle: 'APL-appen | Elevstatistik Export',
  });

  const bytes = await workbook.xlsx.writeBuffer();
  triggerDownload(bytes as ArrayBuffer, `apl_elevexport_${dataset.generatedAt.toISOString().slice(0, 10)}.xlsx`);
}
