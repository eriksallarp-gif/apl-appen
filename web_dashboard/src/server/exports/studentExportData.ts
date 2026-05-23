import { FieldPath } from 'firebase-admin/firestore';
import { adminDb } from '@/server/firebaseAdmin';

export type ExportScope = 'single' | 'multiple' | 'class' | 'all';
export type ExportRole = 'teacher' | 'admin';

export type ExportRequestPayload = {
  scope: ExportScope;
  studentIds?: string[];
  classId?: string;
};

export type ExportRequester = {
  uid: string;
  role: ExportRole;
};

export type ExportEntryRow = {
  registeredAt: Date | null;
  weekStart: string;
  dayLabel: string;
  source: 'Tidkort' | 'Bedömning';
  activity: string;
  hours: number;
  approved: boolean;
  comment: string;
};

export type ExportAssessmentRow = {
  id: string;
  submittedAt: Date | null;
  weekStart: string;
  assessorName: string;
  assessorCompany: string;
  rating: string;
  status: string;
  comment: string;
  lunchApproved: number;
  travelApproved: number;
};

export type ExportCompensationRow = {
  id: string;
  weekStart: string;
  lunches: number;
  kilometers: number;
  source: 'Bedomning' | 'Compensation';
  comment: string;
};

export type ExportStudentRecord = {
  id: string;
  name: string;
  email: string;
  classId: string;
  className: string;
  specialization: string;
  status: string;
  supervisorName: string;
  totalHours: number;
  approvedTimesheets: number;
  timesheetCount: number;
  assessmentCount: number;
  approvedLunches: number;
  approvedKilometers: number;
  firstRegisteredAt: Date | null;
  lastRegisteredAt: Date | null;
  entries: ExportEntryRow[];
  assessments: ExportAssessmentRow[];
  compensations: ExportCompensationRow[];
};

export type ExportDataset = {
  requester: ExportRequester;
  generatedAt: Date;
  students: ExportStudentRecord[];
};

type RawStudent = {
  id: string;
  displayName: string;
  email: string;
  classId: string;
  specialization: string;
  status: string;
  teacherUid: string;
};

type RawTimesheet = {
  id: string;
  studentUid: string;
  weekStart: string;
  approved: boolean;
  entries: Record<string, unknown>;
  comments: Record<string, string>;
  createdAt: Date | null;
  submittedAt: Date | null;
  updatedAt: Date | null;
};

type RawAssessment = {
  id: string;
  studentUid: string;
  status: string;
  weekStart: string;
  submittedAt: Date | null;
  averageRating: string;
  supervisorName: string;
  supervisorCompany: string;
  textComment: string;
  lunchApproved: number;
  travelApproved: number;
};

type RawCompensation = {
  id: string;
  studentUid: string;
  weekStart: string;
  lunchCount: number;
  travelCount: number;
  comment: string;
};

const FIRESTORE_IN_LIMIT = 30;

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

function normalizeIdList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];

  const seen = new Set<string>();
  const ids: string[] = [];

  for (const value of values) {
    const id = String(value || '').trim();
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    ids.push(id);
  }

  return ids;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function getClassNames(classIds: string[]): Promise<Map<string, string>> {
  const classNameById = new Map<string, string>();
  const uniqueClassIds = Array.from(new Set(classIds.filter(Boolean)));
  if (uniqueClassIds.length === 0) {
    return classNameById;
  }

  for (const classChunk of chunkArray(uniqueClassIds, FIRESTORE_IN_LIMIT)) {
    const classSnapshot = await adminDb
      .collection('classes')
      .where(FieldPath.documentId(), 'in', classChunk)
      .get();

    for (const classDoc of classSnapshot.docs) {
      const classData = classDoc.data() || {};
      classNameById.set(classDoc.id, String(classData.name || 'Ingen klass'));
    }
  }

  return classNameById;
}

async function getAdminAccessibleStudents(): Promise<Map<string, RawStudent>> {
  const snapshot = await adminDb.collection('users').where('role', '==', 'student').get();
  const byId = new Map<string, RawStudent>();

  for (const studentDoc of snapshot.docs) {
    const data = studentDoc.data() || {};
    byId.set(studentDoc.id, {
      id: studentDoc.id,
      displayName: String(data.displayName || data.email || 'Okänd elev'),
      email: String(data.email || ''),
      classId: String(data.classId || ''),
      specialization: String(data.specialization || ''),
      status: String(data.status || 'active'),
      teacherUid: String(data.teacherUid || ''),
    });
  }

  return byId;
}

async function getTeacherAccessibleStudents(teacherUid: string): Promise<Map<string, RawStudent>> {
  const byId = new Map<string, RawStudent>();

  const ownStudentsSnapshot = await adminDb
    .collection('users')
    .where('role', '==', 'student')
    .where('teacherUid', '==', teacherUid)
    .get();

  for (const studentDoc of ownStudentsSnapshot.docs) {
    const data = studentDoc.data() || {};
    byId.set(studentDoc.id, {
      id: studentDoc.id,
      displayName: String(data.displayName || data.email || 'Okänd elev'),
      email: String(data.email || ''),
      classId: String(data.classId || ''),
      specialization: String(data.specialization || ''),
      status: String(data.status || 'active'),
      teacherUid: String(data.teacherUid || ''),
    });
  }

  const classSnapshot = await adminDb.collection('classes').where('teacherUid', '==', teacherUid).get();
  const classIds = classSnapshot.docs.map((classDoc) => classDoc.id).filter(Boolean);

  for (const classChunk of chunkArray(classIds, FIRESTORE_IN_LIMIT)) {
    const classStudentsSnapshot = await adminDb
      .collection('users')
      .where('role', '==', 'student')
      .where('classId', 'in', classChunk)
      .get();

    for (const studentDoc of classStudentsSnapshot.docs) {
      const data = studentDoc.data() || {};
      byId.set(studentDoc.id, {
        id: studentDoc.id,
        displayName: String(data.displayName || data.email || 'Okänd elev'),
        email: String(data.email || ''),
        classId: String(data.classId || ''),
        specialization: String(data.specialization || ''),
        status: String(data.status || 'active'),
        teacherUid: String(data.teacherUid || ''),
      });
    }
  }

  return byId;
}

async function getAccessibleStudents(requester: ExportRequester): Promise<Map<string, RawStudent>> {
  if (requester.role === 'admin') {
    return getAdminAccessibleStudents();
  }

  return getTeacherAccessibleStudents(requester.uid);
}

function selectStudentIds(
  accessibleStudents: Map<string, RawStudent>,
  payload: ExportRequestPayload,
): string[] {
  const accessibleStudentIds = new Set(accessibleStudents.keys());
  const requestedIds = normalizeIdList(payload.studentIds);

  if (payload.scope === 'single') {
    if (requestedIds.length === 0) {
      throw new Error('Ingen elev vald för enskild export.');
    }
    return requestedIds.slice(0, 1).filter((id) => accessibleStudentIds.has(id));
  }

  if (payload.scope === 'multiple') {
    if (requestedIds.length === 0) {
      throw new Error('Inga elever valda för multi-export.');
    }
    return requestedIds.filter((id) => accessibleStudentIds.has(id));
  }

  if (payload.scope === 'class') {
    const classId = String(payload.classId || '').trim();
    if (!classId) {
      throw new Error('Ingen klass vald för klassexport.');
    }

    return Array.from(accessibleStudentIds).filter((id) => {
      const student = accessibleStudents.get(id);
      return student?.classId === classId;
    });
  }

  return Array.from(accessibleStudentIds);
}

async function fetchTimesheets(studentIds: string[]): Promise<RawTimesheet[]> {
  const results: RawTimesheet[] = [];
  if (studentIds.length === 0) {
    return results;
  }

  for (const studentChunk of chunkArray(studentIds, FIRESTORE_IN_LIMIT)) {
    const timesheetSnapshot = await adminDb
      .collection('timesheets')
      .where('studentUid', 'in', studentChunk)
      .get();

    for (const timesheetDoc of timesheetSnapshot.docs) {
      const data = timesheetDoc.data() || {};
      results.push({
        id: timesheetDoc.id,
        studentUid: String(data.studentUid || ''),
        weekStart: String(data.weekStart || ''),
        approved: Boolean(data.approved),
        entries: (data.entries || {}) as Record<string, unknown>,
        comments: (data.comments || {}) as Record<string, string>,
        createdAt: toDate(data.createdAt),
        submittedAt: toDate(data.submittedAt),
        updatedAt: toDate(data.updatedAt),
      });
    }
  }

  return results;
}

async function fetchAssessments(studentIds: string[]): Promise<RawAssessment[]> {
  const results: RawAssessment[] = [];
  if (studentIds.length === 0) {
    return results;
  }

  for (const studentChunk of chunkArray(studentIds, FIRESTORE_IN_LIMIT)) {
    const assessmentSnapshot = await adminDb
      .collection('assessmentRequests')
      .where('studentUid', 'in', studentChunk)
      .get();

    for (const assessmentDoc of assessmentSnapshot.docs) {
      const data = assessmentDoc.data() || {};
      const assessmentData = (data.assessmentData || {}) as Record<string, unknown>;

      results.push({
        id: assessmentDoc.id,
        studentUid: String(data.studentUid || ''),
        status: String(data.status || ''),
        weekStart: String(data.weekStart || ''),
        submittedAt: toDate(data.submittedAt),
        averageRating: String(data.averageRating || ''),
        supervisorName: String(data.supervisorName || ''),
        supervisorCompany: String(data.supervisorCompany || ''),
        textComment: String(data.comment || assessmentData.comment || ''),
        lunchApproved: Number(data.lunchApproved ?? data.lunchCount ?? assessmentData.lunchApproved ?? 0) || 0,
        travelApproved: Number(data.travelApproved ?? data.travelCount ?? assessmentData.travelApproved ?? 0) || 0,
      });
    }
  }

  return results;
}

async function fetchCompensations(studentIds: string[]): Promise<RawCompensation[]> {
  const results: RawCompensation[] = [];
  if (studentIds.length === 0) {
    return results;
  }

  for (const studentChunk of chunkArray(studentIds, FIRESTORE_IN_LIMIT)) {
    const compensationSnapshot = await adminDb
      .collection('compensation')
      .where('studentUid', 'in', studentChunk)
      .get();

    for (const compensationDoc of compensationSnapshot.docs) {
      const data = compensationDoc.data() || {};
      results.push({
        id: compensationDoc.id,
        studentUid: String(data.studentUid || ''),
        weekStart: String(data.weekStart || ''),
        lunchCount: Number(data.lunchCount ?? data.lunchApproved ?? 0) || 0,
        travelCount: Number(data.travelCount ?? data.travelApproved ?? 0) || 0,
        comment: String(data.comment || data.description || ''),
      });
    }
  }

  return results;
}

function flattenTimesheetEntries(timesheet: RawTimesheet): ExportEntryRow[] {
  const rows: ExportEntryRow[] = [];
  const fallbackDate = timesheet.submittedAt || timesheet.updatedAt || timesheet.createdAt || null;

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

  for (const [outerKey, innerRaw] of Object.entries(timesheet.entries || {})) {
    if (!innerRaw || typeof innerRaw !== 'object') {
      continue;
    }

    const innerEntries = Object.entries(innerRaw as Record<string, unknown>);
    const innerHasDayLikeKey = innerEntries.some(([innerKey]) => isDayLike(innerKey));
    const outerIsDayLike = isDayLike(outerKey);

    for (const [innerKey, rawHours] of innerEntries) {
      const dayLabel = outerIsDayLike || !innerHasDayLikeKey ? outerKey : innerKey;
      const activityName = outerIsDayLike || !innerHasDayLikeKey ? innerKey : outerKey;
      const parsedHours = Number(rawHours || 0);
      rows.push({
        registeredAt: fallbackDate,
        weekStart: timesheet.weekStart,
        dayLabel,
        source: 'Tidkort',
        activity: activityName,
        hours: Number.isFinite(parsedHours) ? parsedHours : 0,
        approved: timesheet.approved,
        comment: String(timesheet.comments?.[activityName] || ''),
      });
    }
  }

  return rows;
}

function mapAssessments(assessments: RawAssessment[]): ExportAssessmentRow[] {
  return assessments
    .map((assessment) => ({
      id: assessment.id,
      submittedAt: assessment.submittedAt,
      weekStart: assessment.weekStart,
      assessorName: assessment.supervisorName || '-',
      assessorCompany: assessment.supervisorCompany || '-',
      rating: assessment.averageRating || '-',
      status: assessment.status || '',
      comment: assessment.textComment || '-',
      lunchApproved: assessment.lunchApproved,
      travelApproved: assessment.travelApproved,
    }))
    .sort((a, b) => (b.submittedAt?.getTime() || 0) - (a.submittedAt?.getTime() || 0));
}

function mapCompensations(
  assessments: RawAssessment[],
  compensations: RawCompensation[],
): ExportCompensationRow[] {
  const mappedFromAssessments: ExportCompensationRow[] = assessments.map((assessment) => ({
    id: `assessment_${assessment.id}`,
    weekStart: assessment.weekStart,
    lunches: assessment.lunchApproved,
    kilometers: assessment.travelApproved,
    source: 'Bedomning',
    comment: assessment.textComment || '',
  }));

  const mappedCompensations: ExportCompensationRow[] = compensations.map((compensation) => ({
    id: compensation.id,
    weekStart: compensation.weekStart,
    lunches: compensation.lunchCount,
    kilometers: compensation.travelCount,
    source: 'Compensation',
    comment: compensation.comment,
  }));

  return [...mappedFromAssessments, ...mappedCompensations].sort((a, b) => {
    return String(b.weekStart || '').localeCompare(String(a.weekStart || ''));
  });
}

function getDateBounds(entries: ExportEntryRow[]): { first: Date | null; last: Date | null } {
  const dates = entries
    .map((entry) => entry.registeredAt)
    .filter((value): value is Date => value instanceof Date)
    .sort((a, b) => a.getTime() - b.getTime());

  return {
    first: dates[0] || null,
    last: dates[dates.length - 1] || null,
  };
}

export async function collectStudentExportDataset(
  requester: ExportRequester,
  payload: ExportRequestPayload,
): Promise<ExportDataset> {
  const accessibleStudents = await getAccessibleStudents(requester);

  if (accessibleStudents.size === 0) {
    throw new Error('Inga elever hittades för den inloggade användaren.');
  }

  const selectedStudentIds = selectStudentIds(accessibleStudents, payload);
  if (selectedStudentIds.length === 0) {
    throw new Error('Valt urval innehåller inga tillgängliga elever.');
  }

  const selectedStudents = selectedStudentIds
    .map((studentId) => accessibleStudents.get(studentId))
    .filter((student): student is RawStudent => Boolean(student));

  const classNameById = await getClassNames(selectedStudents.map((student) => student.classId));
  const timesheets = await fetchTimesheets(selectedStudentIds);
  const assessments = await fetchAssessments(selectedStudentIds);
  const compensations = await fetchCompensations(selectedStudentIds);

  const timesheetsByStudent = new Map<string, RawTimesheet[]>();
  for (const timesheet of timesheets) {
    const existing = timesheetsByStudent.get(timesheet.studentUid) || [];
    existing.push(timesheet);
    timesheetsByStudent.set(timesheet.studentUid, existing);
  }

  const assessmentsByStudent = new Map<string, RawAssessment[]>();
  for (const assessment of assessments) {
    const existing = assessmentsByStudent.get(assessment.studentUid) || [];
    existing.push(assessment);
    assessmentsByStudent.set(assessment.studentUid, existing);
  }

  const compensationsByStudent = new Map<string, RawCompensation[]>();
  for (const compensation of compensations) {
    const existing = compensationsByStudent.get(compensation.studentUid) || [];
    existing.push(compensation);
    compensationsByStudent.set(compensation.studentUid, existing);
  }

  const students: ExportStudentRecord[] = selectedStudents
    .map((student) => {
      const studentTimesheets = timesheetsByStudent.get(student.id) || [];
      const studentAssessments = assessmentsByStudent.get(student.id) || [];
      const studentCompensations = compensationsByStudent.get(student.id) || [];
      const approvedTimesheets = studentTimesheets.filter((timesheet) => timesheet.approved);

      const entryRows = studentTimesheets.flatMap((timesheet) => flattenTimesheetEntries(timesheet)).sort((a, b) => {
        const aTime = a.registeredAt?.getTime() || 0;
        const bTime = b.registeredAt?.getTime() || 0;
        return bTime - aTime;
      });

      const assessmentRows = mapAssessments(studentAssessments);
      const compensationRows = mapCompensations(studentAssessments, studentCompensations);
      const approvedLunches = compensationRows.reduce((sum, row) => sum + row.lunches, 0);
      const approvedKilometers = compensationRows.reduce((sum, row) => sum + row.kilometers, 0);
      const supervisorName = assessmentRows.find((row) => row.assessorName && row.assessorName !== '-')?.assessorName || '-';

      const { first, last } = getDateBounds(entryRows);
      const totalHours = entryRows
        .filter((entry) => entry.source === 'Tidkort')
        .reduce((sum, entry) => sum + entry.hours, 0);

      return {
        id: student.id,
        name: student.displayName,
        email: student.email,
        classId: student.classId,
        className: classNameById.get(student.classId) || 'Ingen klass',
        specialization: student.specialization || '-',
        status: student.status || 'active',
        supervisorName,
        totalHours,
        approvedTimesheets: approvedTimesheets.length,
        timesheetCount: studentTimesheets.length,
        assessmentCount: studentAssessments.length,
        approvedLunches,
        approvedKilometers,
        firstRegisteredAt: first,
        lastRegisteredAt: last,
        entries: entryRows,
        assessments: assessmentRows,
        compensations: compensationRows,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'sv'));

  return {
    requester,
    generatedAt: new Date(),
    students,
  };
}
