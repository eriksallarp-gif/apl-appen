import {
  collection,
  getDocs,
  query,
  where,
  type Firestore,
  type QueryConstraint,
} from 'firebase/firestore';
import type {
  PdfAssessment,
  PdfCompensation,
  PdfDataset,
  PdfEntry,
  PdfStudent,
} from '@/shared/pdf-report/types';

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

export type { ClientExportOptions };

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

function normalizeWeekValue(value: unknown): string {
  if (value === null || value === undefined) return '';

  const dateValue = parseDate(value);
  if (dateValue) {
    return dateValue.toISOString().slice(0, 10);
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return `W${Math.trunc(value)}`;
  }

  const text = String(value).trim();
  if (!text) return '';
  return text;
}

function resolveWeekStart(candidates: unknown[], fallbackDate?: Date | null): string {
  for (const candidate of candidates) {
    const normalized = normalizeWeekValue(candidate);
    if (normalized) {
      return normalized;
    }
  }

  if (fallbackDate) {
    return fallbackDate.toISOString().slice(0, 10);
  }

  return '';
}

function extractWeekFromTimesheetId(timesheetId: string): string {
  const id = String(timesheetId || '').trim();
  if (!id) return '';

  const isoDateAtEnd = id.match(/_(\d{4}-\d{2}-\d{2})$/);
  if (isoDateAtEnd?.[1]) {
    return isoDateAtEnd[1];
  }

  const isoWeekAtEnd = id.match(/_(\d{4}-W\d{1,2})$/i);
  if (isoWeekAtEnd?.[1]) {
    return isoWeekAtEnd[1].toUpperCase();
  }

  return '';
}

function resolveAssessmentWeekStart(data: Record<string, unknown>, assessmentData: Record<string, unknown>, submittedAt: Date | null): string {
  const timesheetSummaries = Array.isArray(data.timesheetSummaries)
    ? data.timesheetSummaries
    : Array.isArray(assessmentData.timesheetSummaries)
      ? assessmentData.timesheetSummaries
      : [];

  const weekFromSummaries = timesheetSummaries
    .map((item) => (item && typeof item === 'object' ? normalizeWeekValue((item as Record<string, unknown>).weekLabel) : ''))
    .find(Boolean);

  const weeks = Array.isArray(data.weeks)
    ? data.weeks
    : Array.isArray(assessmentData.weeks)
      ? assessmentData.weeks
      : [];

  const weekFromWeeksArray = weeks
    .map((item) => normalizeWeekValue(item))
    .find(Boolean);

  const timesheetIds = Array.isArray(data.timesheetIds)
    ? data.timesheetIds
    : Array.isArray(assessmentData.timesheetIds)
      ? assessmentData.timesheetIds
      : [];

  const weekFromTimesheetIds = timesheetIds
    .map((item) => extractWeekFromTimesheetId(String(item || '')))
    .find(Boolean);

  return resolveWeekStart(
    [
      weekFromSummaries,
      weekFromWeeksArray,
      weekFromTimesheetIds,
      data.weekStart,
      data.week,
      data.weekLabel,
      data.weekNumber,
      assessmentData.weekStart,
      assessmentData.week,
      assessmentData.weekLabel,
      assessmentData.weekNumber,
    ],
    submittedAt,
  );
}

function textFromCandidate(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const nested = [
      record.name,
      record.displayName,
      record.company,
      record.companyName,
      record.supervisorName,
      record.supervisorCompany,
    ];

    for (const candidate of nested) {
      const text = textFromCandidate(candidate);
      if (text) return text;
    }
  }
  return '';
}

function resolveText(candidates: unknown[], fallback = '-'): string {
  for (const candidate of candidates) {
    const text = textFromCandidate(candidate);
    if (text) return text;
  }
  return fallback;
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

function maxDate(entries: PdfEntry[]): Date | null {
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
}): Promise<PdfStudent> {
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

  const entries: PdfEntry[] = [];
  const assessments: PdfAssessment[] = [];
  const compensations: PdfCompensation[] = [];
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
    const entryWeekStart = resolveWeekStart(
      [data.weekStart, data.week, data.weekLabel, data.weekNumber],
      fallbackDate,
    );
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
          weekStart: entryWeekStart,
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
    const submittedAt =
      parseDate(data.submittedAt) ||
      parseDate(data.updatedAt) ||
      parseDate(data.createdAt) ||
      parseDate(assessmentData.submittedAt) ||
      parseDate(assessmentData.updatedAt) ||
      parseDate(assessmentData.createdAt);
    const weekStart = resolveAssessmentWeekStart(data, assessmentData, submittedAt);
    const lunchApproved = Number(data.lunchApproved ?? data.lunchCount ?? assessmentData.lunchApproved ?? 0) || 0;
    const travelApproved = Number(data.travelApproved ?? data.travelCount ?? assessmentData.travelApproved ?? 0) || 0;

    assessments.push({
      id: assessmentDoc.id,
      submittedAt,
      weekStart,
      assessorName: resolveText([
        data.supervisorName,
        data.assessorName,
        data.teacherName,
        assessmentData.supervisorName,
        assessmentData.assessorName,
        assessmentData.teacherName,
      ]),
      assessorCompany: resolveText([
        data.supervisorCompany,
        data.companyName,
        data.company,
        data.workplace,
        data.workplaceName,
        data.supervisor,
        data.assessor,
        assessmentData.supervisorCompany,
        assessmentData.companyName,
        assessmentData.company,
        assessmentData.workplace,
        assessmentData.workplaceName,
        assessmentData.supervisor,
        assessmentData.assessor,
      ]),
      assessorPhone: resolveText([
        data.supervisorPhone,
        data.assessorPhone,
        data.phone,
        assessmentData.supervisorPhone,
        assessmentData.assessorPhone,
        assessmentData.phone,
      ]),
      rating: String(data.averageRating || '-'),
      status: String(data.status || ''),
      comment: String(data.comment || assessmentData.comment || '-'),
      lunchApproved,
      travelApproved,
    });

    compensations.push({
      id: `assessment_${assessmentDoc.id}`,
      weekStart,
      lunches: lunchApproved,
      kilometers: travelApproved,
      source: 'Bedomning',
      comment: String(data.comment || assessmentData.comment || ''),
    });
  }

  const compensationSnapshot = await getDocs(query(collection(db, 'compensation'), where('studentUid', '==', student.id)));
  for (const compensationDoc of compensationSnapshot.docs) {
    const data = compensationDoc.data() || {};
    const fallbackCompDate = parseDate(data.submittedAt) || parseDate(data.updatedAt) || parseDate(data.createdAt);
    compensations.push({
      id: compensationDoc.id,
      weekStart: resolveWeekStart([data.weekStart, data.week, data.weekLabel, data.weekNumber], fallbackCompDate),
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

export async function buildExportDatasetInBrowser(options: ClientExportOptions): Promise<PdfDataset> {
  const selectedStudents = selectStudents(options);
  if (selectedStudents.length === 0) {
    throw new Error('Inga elever matchade valt exporturval.');
  }

  const records: PdfStudent[] = [];
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

  return {
    generatedAt: new Date(),
    students: records,
  };
}
