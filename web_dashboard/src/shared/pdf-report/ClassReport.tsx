'use client';

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { PdfDataset, PdfStudent } from './types';
import {
  shared,
  ORANGE,
  GRAY_BORDER,
} from './styles';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateTime(date: Date | null): string {
  if (!date) return '-';
  return new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(date);
}

function translateStatus(status: string): string {
  const map: Record<string, string> = {
    active: 'Aktiv', inactive: 'Inaktiv', completed: 'Avslutad', pending: 'Väntande',
  };
  return map[status] ?? status;
}

function approvalRate(approved: number, total: number): string {
  if (total === 0) return '–';
  return `${Math.round((approved / total) * 100)} %`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const s = StyleSheet.create({
  header: {
    ...shared.header,
    borderBottomColor: ORANGE,
    marginBottom: 16,
  },
  tableHeaderRow: {
    backgroundColor: ORANGE,
  },
  footer: {
    ...shared.footer,
    borderTopColor: '#FDBA74',
  },
  summaryWrap: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: GRAY_BORDER,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    padding: 10,
    flexDirection: 'row',
    gap: 16,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  summaryLabel: {
    fontSize: 9,
    color: '#64748B',
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
  },
});

// ─── Student row in class table ───────────────────────────────────────────────

function StudentRow({ student, index }: { student: PdfStudent; index: number }) {
  const isEven = index % 2 === 0;

  return (
    <View style={[shared.tableRow, isEven ? shared.tableRowAlt : shared.tableRowEven]}>
      <Text style={[shared.tableCell, { width: '22%', fontFamily: 'Helvetica-Bold' }]}>{student.name}</Text>
      <Text style={[shared.tableCell, { width: '14%' }]}>{student.specialization || '-'}</Text>
      <Text style={[shared.tableCell, { width: '10%' }]}>{student.className || '-'}</Text>
      <Text style={[shared.tableCell, { width: '10%' }]}>{student.totalHours.toFixed(1)}</Text>
      <Text style={[shared.tableCell, { width: '12%' }]}>{student.approvedTimesheets}/{student.timesheetCount}</Text>
      <Text style={[shared.tableCell, { width: '10%' }]}>{approvalRate(student.approvedTimesheets, student.timesheetCount)}</Text>
      <Text style={[shared.tableCell, { width: '8%' }]}>{student.approvedLunches}</Text>
      <Text style={[shared.tableCell, { width: '6%' }]}>{student.approvedKilometers}</Text>
      <Text style={[shared.tableCell, { width: '8%' }]}>{translateStatus(student.status)}</Text>
    </View>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────────────

function PageFooter({ generatedAt }: { generatedAt: Date }) {
  return (
    <View style={s.footer} fixed>
      <Text style={shared.footerText}>APL-appen | Klassrapport</Text>
      <Text style={shared.footerText}>Genererad: {formatDateTime(generatedAt)}</Text>
      <Text
        style={shared.footerText}
        render={({ pageNumber, totalPages }) => `Sida ${pageNumber} / ${totalPages}`}
      />
    </View>
  );
}

function SummarySection({ students }: { students: PdfStudent[] }) {
  const totalHours = students.reduce((sum, student) => sum + student.totalHours, 0);

  return (
    <View style={s.summaryWrap}>
      <View style={s.summaryItem}>
        <Text style={s.summaryLabel}>Elever:</Text>
        <Text style={s.summaryValue}>{students.length}</Text>
      </View>
      <View style={s.summaryItem}>
        <Text style={s.summaryLabel}>Totala timmar:</Text>
        <Text style={s.summaryValue}>{totalHours.toFixed(1)}</Text>
      </View>
    </View>
  );
}

// ─── Main document ────────────────────────────────────────────────────────────

export type ClassReportProps = {
  dataset: PdfDataset;
  className?: string;
};

export function ClassReport({ dataset, className }: ClassReportProps) {
  const title = className ? `Klass ${className}` : 'Alla klasser';
  const students = (className
    ? dataset.students.filter((s) => s.className === className)
    : dataset.students)
    .slice()
    .sort((a, b) => {
      const specializationSort = (a.specialization || '').localeCompare(b.specialization || '', 'sv');
      if (specializationSort !== 0) return specializationSort;
      return a.name.localeCompare(b.name, 'sv');
    });

  return (
    <Document title={`APL-rapport – ${title}`} author="APL-appen">
      <Page size="A4" orientation="landscape" style={shared.page}>
        {/* Header */}
        <View style={s.header}>
          <View style={shared.headerText}>
            <Text style={shared.reportTitle}>APL-appen | {title}</Text>
            <Text style={shared.reportSubtitle}>
              Sammanställning av APL-data · {students.length} elever
            </Text>
          </View>
        </View>

        <SummarySection students={students} />

        {/* Student table */}
        <Text style={shared.sectionTitle}>Sammanställning per elev</Text>
        <View style={shared.table}>
          <View style={[shared.tableHeaderRow, s.tableHeaderRow]}>
            <Text style={[shared.tableHeaderCell, { width: '22%' }]}>Elev</Text>
            <Text style={[shared.tableHeaderCell, { width: '14%' }]}>Yrkesutgång</Text>
            <Text style={[shared.tableHeaderCell, { width: '10%' }]}>Klass</Text>
            <Text style={[shared.tableHeaderCell, { width: '10%' }]}>Timmar</Text>
            <Text style={[shared.tableHeaderCell, { width: '12%' }]}>Tidkort</Text>
            <Text style={[shared.tableHeaderCell, { width: '10%' }]}>Godk.grad</Text>
            <Text style={[shared.tableHeaderCell, { width: '8%' }]}>Lunch</Text>
            <Text style={[shared.tableHeaderCell, { width: '6%' }]}>Km</Text>
            <Text style={[shared.tableHeaderCell, { width: '8%' }]}>Status</Text>
          </View>

          {students.map((student, i) => (
            <StudentRow key={student.id} student={student} index={i} />
          ))}
        </View>

        <PageFooter generatedAt={dataset.generatedAt} />
      </Page>
    </Document>
  );
}
