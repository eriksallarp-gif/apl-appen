export type ExcelEntrySource = 'Tidkort' | 'Bedömning';

export type ExcelExportEntry = {
  registeredAt: Date | null;
  weekStart: string;
  dayLabel: string;
  source: ExcelEntrySource;
  activity: string;
  hours: number;
  approved: boolean;
  comment: string;
};

export type ExcelExportAssessment = {
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

export type ExcelExportCompensation = {
  id: string;
  weekStart: string;
  lunches: number;
  kilometers: number;
  source: 'Bedomning' | 'Compensation';
  comment: string;
};

export type ExcelExportStudent = {
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
  entries: ExcelExportEntry[];
  assessments: ExcelExportAssessment[];
  compensations: ExcelExportCompensation[];
};

export type ExcelExportDataset = {
  generatedAt: Date;
  students: ExcelExportStudent[];
};

export type PieChartSeries = {
  title: string;
  labels: string[];
  values: number[];
};
