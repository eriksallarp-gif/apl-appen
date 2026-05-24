'use client';

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { PdfDataset, PdfStudent } from './types';
import {
  shared,
  NAVY,
  GREEN,
  GREEN_BG,
  AMBER,
  AMBER_BG,
  PURPLE,
  PURPLE_BG,
  TEAL,
  TEAL_BG,
  ORANGE,
  ORANGE_BG,
  TEXT_MUTED,
  GRAY_BORDER,
  GRAY_BG,
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
  statCard: { ...shared.statCard, borderColor: GRAY_BORDER },
  badge: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
  },
});

type StatCardProps = { icon: string; label: string; value: string | number; color: string; bg: string };

function StatCard({ icon, label, value, color, bg }: StatCardProps) {
  return (
    <View style={[s.statCard, { backgroundColor: bg, borderColor: color + '55' }]}>
      <Text style={shared.statCardIcon}>{icon}</Text>
      <Text style={[shared.statCardValue, { color }]}>{String(value)}</Text>
      <Text style={shared.statCardLabel}>{label}</Text>
    </View>
  );
}

// ─── Student row in class table ───────────────────────────────────────────────

function StudentRow({ student, index }: { student: PdfStudent; index: number }) {
  const isEven = index % 2 === 0;

  return (
    <View style={[shared.tableRow, isEven ? shared.tableRowAlt : shared.tableRowEven]}>
      <Text style={[shared.tableCell, { width: '20%', fontFamily: 'Helvetica-Bold' }]}>{student.name}</Text>
      <Text style={[shared.tableCell, { width: '10%' }]}>{student.className || '-'}</Text>
      <Text style={[shared.tableCell, { width: '10%' }]}>{student.totalHours.toFixed(1)}</Text>
      <Text style={[shared.tableCell, { width: '12%' }]}>{student.approvedTimesheets}/{student.timesheetCount}</Text>
      <Text style={[shared.tableCell, { width: '10%' }]}>{approvalRate(student.approvedTimesheets, student.timesheetCount)}</Text>
      <Text style={[shared.tableCell, { width: '8%' }]}>{student.assessmentCount}</Text>
      <Text style={[shared.tableCell, { width: '8%' }]}>{student.approvedLunches}</Text>
      <Text style={[shared.tableCell, { width: '8%' }]}>{student.approvedKilometers}</Text>
      <Text style={[shared.tableCell, { width: '14%' }]}>{translateStatus(student.status)}</Text>
    </View>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────────────

function PageFooter({ generatedAt }: { generatedAt: Date }) {
  return (
    <View style={shared.footer} fixed>
      <Text style={shared.footerText}>APL-appen | Klassrapport</Text>
      <Text style={shared.footerText}>Genererad: {formatDateTime(generatedAt)}</Text>
      <Text
        style={shared.footerText}
        render={({ pageNumber, totalPages }) => `Sida ${pageNumber} / ${totalPages}`}
      />
    </View>
  );
}

// ─── Summary section (totals) ─────────────────────────────────────────────────

function SummarySection({ dataset }: { dataset: PdfDataset }) {
  const total = dataset.students;
  const totalHours = total.reduce((s, st) => s + st.totalHours, 0);
  const totalApproved = total.reduce((s, st) => s + st.approvedTimesheets, 0);
  const totalTimesheets = total.reduce((s, st) => s + st.timesheetCount, 0);
  const totalAssessments = total.reduce((s, st) => s + st.assessmentCount, 0);
  const totalLunches = total.reduce((s, st) => s + st.approvedLunches, 0);
  const totalKilometers = total.reduce((s, st) => s + st.approvedKilometers, 0);

  return (
    <View style={shared.statsRow}>
      <StatCard icon="👥" label="Elever" value={total.length} color={NAVY} bg="#EFF6FF" />
      <StatCard icon="⏱" label="Totala timmar" value={totalHours.toFixed(1)} color={AMBER} bg={AMBER_BG} />
      <StatCard icon="✅" label="Godkända tidkort" value={`${totalApproved}/${totalTimesheets}`} color={GREEN} bg={GREEN_BG} />
      <StatCard icon="📈" label="Godk.grad" value={approvalRate(totalApproved, totalTimesheets)} color={TEAL} bg={TEAL_BG} />
      <StatCard icon="📝" label="Bedömningar" value={totalAssessments} color={PURPLE} bg={PURPLE_BG} />
      <StatCard icon="🍽" label="Luncher" value={totalLunches} color={GREEN} bg={GREEN_BG} />
      <StatCard icon="🚗" label="Kilometer" value={totalKilometers} color={ORANGE} bg={ORANGE_BG} />
    </View>
  );
}

// ─── Per-class breakdown ──────────────────────────────────────────────────────

function ClassBreakdown({ students }: { students: PdfStudent[] }) {
  const byClass = students.reduce<Record<string, PdfStudent[]>>((acc, s) => {
    const key = s.className || 'Okänd klass';
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  return (
    <>
      {Object.entries(byClass).map(([className, classStudents]) => {
        const classHours = classStudents.reduce((s, st) => s + st.totalHours, 0);
        return (
          <View key={className} style={{ marginBottom: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
              <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: NAVY }}>{className}</Text>
              <Text style={{ fontSize: 9, color: TEXT_MUTED }}>
                {classStudents.length} elever · {classHours.toFixed(1)} tim totalt
              </Text>
            </View>
            <View
              style={{
                height: 3,
                width: `${Math.min((classHours / (students.reduce((s, st) => s + st.totalHours, 0) || 1)) * 100, 100)}%`,
                backgroundColor: NAVY,
                borderRadius: 2,
                marginBottom: 4,
              }}
            />
          </View>
        );
      })}
    </>
  );
}

// ─── Main document ────────────────────────────────────────────────────────────

export type ClassReportProps = {
  dataset: PdfDataset;
  className?: string;
};

export function ClassReport({ dataset, className }: ClassReportProps) {
  const title = className ? `Klass ${className}` : 'Alla klasser';
  const students = className
    ? dataset.students.filter((s) => s.className === className)
    : dataset.students;

  return (
    <Document title={`APL-rapport – ${title}`} author="APL-appen">
      <Page size="A4" orientation="landscape" style={shared.page}>
        {/* Header */}
        <View style={shared.header}>
          <View style={shared.headerText}>
            <Text style={shared.reportTitle}>APL-appen | {title}</Text>
            <Text style={shared.reportSubtitle}>
              Sammanställning av APL-data · {students.length} elever
            </Text>
          </View>
        </View>

        {/* Summary cards */}
        <SummarySection dataset={{ ...dataset, students }} />

        {/* Class breakdown bars (only shown when viewing all classes) */}
        {!className && students.length > 0 && (
          <View style={{ marginBottom: 12 }}>
            <Text style={shared.sectionTitle}>Timmar per klass</Text>
            <ClassBreakdown students={students} />
          </View>
        )}

        {/* Student table */}
        <Text style={shared.sectionTitle}>Sammanställning per elev</Text>
        <View style={shared.table}>
          <View style={shared.tableHeaderRow}>
            <Text style={[shared.tableHeaderCell, { width: '20%' }]}>Elev</Text>
            <Text style={[shared.tableHeaderCell, { width: '10%' }]}>Klass</Text>
            <Text style={[shared.tableHeaderCell, { width: '10%' }]}>Timmar</Text>
            <Text style={[shared.tableHeaderCell, { width: '12%' }]}>Tidkort</Text>
            <Text style={[shared.tableHeaderCell, { width: '10%' }]}>Godk.grad</Text>
            <Text style={[shared.tableHeaderCell, { width: '8%' }]}>Betyg</Text>
            <Text style={[shared.tableHeaderCell, { width: '8%' }]}>Lunch</Text>
            <Text style={[shared.tableHeaderCell, { width: '8%' }]}>Km</Text>
            <Text style={[shared.tableHeaderCell, { width: '14%' }]}>Status</Text>
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
