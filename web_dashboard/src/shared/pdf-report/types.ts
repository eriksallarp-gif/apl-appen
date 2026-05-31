export type PdfEntrySource = 'Tidkort' | 'Bedomning';

export type PdfEntry = {
  registeredAt: Date | null;
  weekStart: string;
  dayLabel: string;
  source: PdfEntrySource;
  activity: string;
  hours: number;
  approved: boolean;
  comment: string;
};

export type PdfAssessmentCriterion = {
  key: string;
  label: string;
  rating: number | null;
  comment: string;
};

export type PdfAssessmentSelfField = {
  key: string;
  label: string;
  value: string;
};

export type PdfAssessmentImage = {
  url: string;
  fileName: string;
  uploadedAt: Date | null;
};

export type PdfAssessment = {
  id: string;
  submittedAt: Date | null;
  weekStart: string;
  assessorName: string;
  assessorCompany: string;
  assessorPhone: string;
  rating: string;
  status: string;
  comment: string;
  lunchApproved: number;
  travelApproved: number;
  criteria: PdfAssessmentCriterion[];
  studentSelfAssessment: PdfAssessmentSelfField[];
  imageComments: string[];
  images: PdfAssessmentImage[];
  supervisorOtherInfo: string;
};

export type PdfCompensation = {
  id: string;
  weekStart: string;
  lunches: number;
  kilometers: number;
  source: 'Bedomning' | 'Compensation';
  comment: string;
};

export type PdfApprovedAssignment = {
  id: string;
  title: string;
  approvedAt: Date | null;
  submittedAt: Date | null;
  teacherComment: string;
  mediaUrls: string[];
};

export type PdfStudent = {
  id: string;
  name: string;
  email: string;
  classId?: string;
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
  approvedAssignmentsCount: number;
  firstRegisteredAt?: Date | null;
  lastRegisteredAt: Date | null;
  entries: PdfEntry[];
  assessments: PdfAssessment[];
  compensations: PdfCompensation[];
  approvedAssignments: PdfApprovedAssignment[];
};

export type PdfDataset = {
  generatedAt: Date;
  students: PdfStudent[];
};
