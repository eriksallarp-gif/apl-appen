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
};

export type PdfCompensation = {
  id: string;
  weekStart: string;
  lunches: number;
  kilometers: number;
  source: 'Bedomning' | 'Compensation';
  comment: string;
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
  firstRegisteredAt?: Date | null;
  lastRegisteredAt: Date | null;
  entries: PdfEntry[];
  assessments: PdfAssessment[];
  compensations: PdfCompensation[];
};

export type PdfDataset = {
  generatedAt: Date;
  students: PdfStudent[];
};
