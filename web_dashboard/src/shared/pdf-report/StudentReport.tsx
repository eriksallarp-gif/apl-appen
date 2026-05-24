'use client';

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Svg,
  Path,
  Circle,
} from '@react-pdf/renderer';
import type { PdfStudent } from './types';
import {
  shared,
  ORANGE,
  GRAY_BORDER,
} from './styles';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(date: Date | null): string {
  if (!date) return '-';
  return new Intl.DateTimeFormat('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

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

function translateAssessmentStatus(status: string): string {
  const map: Record<string, string> = {
    approved: 'Godkänd', pending: 'Väntar', rejected: 'Ej godkänd', submitted: 'Godkänd',
  };
  return map[status] ?? status;
}

function toIsoWeekNumber(date: Date): number {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function parseDateLike(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatWeekLabel(weekStart?: string | null, fallbackDate?: Date | null): string {
  const source = String(weekStart || '').trim();

  const swedishWeek = source.match(/^v\.?\s*(\d{1,2})$/i);
  if (swedishWeek?.[1]) {
    return `v.${Number(swedishWeek[1])}`;
  }

  const isoWeek = source.match(/^\d{4}\s*-?\s*W(\d{1,2})$/i);
  if (isoWeek?.[1]) {
    return `v.${Number(isoWeek[1])}`;
  }

  if (/^\d{1,2}$/.test(source)) {
    return `v.${Number(source)}`;
  }

  const fromDate = parseDateLike(source) || fallbackDate || null;
  if (!fromDate) return '-';
  return `v.${toIsoWeekNumber(fromDate)}`;
}

function translateDayLabel(dayLabel: string | null | undefined): string {
  const normalized = String(dayLabel || '').trim().toLowerCase();
  const map: Record<string, string> = {
    mon: 'mån', monday: 'mån', mån: 'mån',
    tue: 'tis', tues: 'tis', tuesday: 'tis', tis: 'tis',
    wed: 'ons', wednesday: 'ons', ons: 'ons',
    thu: 'tors', thur: 'tors', thurs: 'tors', thursday: 'tors', tor: 'tors', tors: 'tors',
    fri: 'fre', friday: 'fre', fre: 'fre',
    sat: 'lör', saturday: 'lör', lör: 'lör', lor: 'lör',
    sun: 'sön', sunday: 'sön', sön: 'sön', son: 'sön',
  };
  return map[normalized] || (dayLabel || '-');
}

function getWeekSortValue(weekStart?: string | null, fallbackDate?: Date | null): number {
  const label = formatWeekLabel(weekStart, fallbackDate);
  const match = label.match(/v\.(\d{1,2})/i);
  if (match?.[1]) {
    return Number(match[1]);
  }
  return 99;
}

function getDaySortValue(dayLabel: string | null | undefined): number {
  const normalized = String(dayLabel || '').trim().toLowerCase();
  const order: Record<string, number> = {
    mon: 1, monday: 1, mån: 1,
    tue: 2, tues: 2, tuesday: 2, tis: 2,
    wed: 3, wednesday: 3, ons: 3,
    thu: 4, thur: 4, thurs: 4, thursday: 4, tor: 4, tors: 4,
    fri: 5, friday: 5, fre: 5,
    sat: 6, saturday: 6, lör: 6, lor: 6,
    sun: 7, sunday: 7, sön: 7, son: 7,
  };
  return order[normalized] ?? 99;
}

function formatOneDecimal(value: number): string {
  return new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
}

const CHART_COLORS = ['#D97706', '#F97316', '#FB923C', '#FDBA74', '#F59E0B', '#FBBF24', '#FED7AA', '#EA580C'];

type ActivityDistributionItem = {
  activity: string;
  hours: number;
  percent: number;
  color: string;
};

function getActivityDistribution(student: PdfStudent): ActivityDistributionItem[] {
  const hourByActivity = new Map<string, number>();

  for (const entry of student.entries) {
    if (entry.source !== 'Tidkort') continue;
    const activity = (entry.activity || '-').trim() || '-';
    hourByActivity.set(activity, (hourByActivity.get(activity) ?? 0) + entry.hours);
  }

  const sorted = Array.from(hourByActivity.entries())
    .filter(([, hours]) => hours > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const totalHours = sorted.reduce((sum, [, hours]) => sum + hours, 0);
  if (totalHours <= 0) return [];

  return sorted.map(([activity, hours], index) => ({
    activity,
    hours,
    percent: (hours / totalHours) * 100,
    color: CHART_COLORS[index % CHART_COLORS.length],
  }));
}

function describeSlicePath(cx: number, cy: number, radius: number, startAngle: number, endAngle: number): string {
  const startRad = (Math.PI / 180) * startAngle;
  const endRad = (Math.PI / 180) * endAngle;

  const startX = cx + radius * Math.cos(startRad);
  const startY = cy + radius * Math.sin(startRad);
  const endX = cx + radius * Math.cos(endRad);
  const endY = cy + radius * Math.sin(endRad);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

  return `M ${cx} ${cy} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;
}

// ─── Sub-components ─────────────────────────────────────────────────────────

const s = StyleSheet.create({
  header: {
    ...shared.header,
    borderBottomColor: ORANGE,
    marginBottom: 16,
  },
  headerLogo: {
    width: 58,
    height: 58,
    marginRight: 12,
  },
  tableHeaderRow: {
    backgroundColor: ORANGE,
  },
  statCard: { ...shared.statCard, borderColor: GRAY_BORDER },
  footer: {
    ...shared.footer,
    borderTopColor: '#FDBA74',
  },
  chartSectionWrap: {
    marginTop: 4,
    marginBottom: 6,
  },
  chartLayout: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: GRAY_BORDER,
    borderRadius: 6,
    padding: 8,
  },
  chartLeft: {
    width: '43%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartRight: {
    width: '57%',
  },
  chartRightHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: GRAY_BORDER,
    paddingBottom: 4,
    marginBottom: 2,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    minHeight: 22,
    paddingVertical: 2,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginRight: 6,
    flexShrink: 0,
  },
  legendActivity: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '58%',
    fontSize: 9,
    color: '#0F172A',
    paddingRight: 4,
  },
  legendHours: {
    width: '24%',
    fontSize: 9,
    color: '#0F172A',
    textAlign: 'right',
    paddingRight: 6,
  },
  legendPercent: {
    width: '18%',
    fontSize: 9,
    color: '#0F172A',
    textAlign: 'right',
  },
  legendHeaderText: {
    fontSize: 8,
    color: '#64748B',
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
  },
  legendTotalRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#CBD5E1',
    marginTop: 3,
    paddingTop: 5,
  },
  legendTotalText: {
    width: '58%',
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
  },
  legendTotalHours: {
    width: '24%',
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#C2410C',
    textAlign: 'right',
    paddingRight: 6,
  },
  legendTotalPercent: {
    width: '18%',
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
    textAlign: 'right',
  },
  chartSlicePercent: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    fill: '#0F172A',
    textAnchor: 'middle',
    dominantBaseline: 'middle',
  },
});

type StatCardProps = { label: string; value: string | number; color: string; bg: string };

function StatCard({ label, value, color, bg }: StatCardProps) {
  return (
    <View style={[s.statCard, { backgroundColor: bg, borderColor: color + '55' }]}>
      <Text style={[shared.statCardValue, { color }]}>{String(value)}</Text>
      <Text style={shared.statCardLabel}>{label}</Text>
    </View>
  );
}

// ─── Activity table ──────────────────────────────────────────────────────────

function ActivityTable({ student }: { student: PdfStudent }) {
  const entries = student.entries
    .filter((e) => e.source === 'Tidkort')
    .sort((a, b) => {
      const weekDiff = getWeekSortValue(a.weekStart, a.registeredAt) - getWeekSortValue(b.weekStart, b.registeredAt);
      if (weekDiff !== 0) return weekDiff;

      const dayDiff = getDaySortValue(a.dayLabel) - getDaySortValue(b.dayLabel);
      if (dayDiff !== 0) return dayDiff;

      return (a.registeredAt?.getTime() ?? 0) - (b.registeredAt?.getTime() ?? 0);
    });

  return (
    <View>
      <Text style={shared.sectionTitle}>Aktiviteter</Text>
      <View style={shared.table}>
        <View style={[shared.tableHeaderRow, s.tableHeaderRow]}>
          <Text style={[shared.tableHeaderCell, { width: '12%' }]}>Datum</Text>
          <Text style={[shared.tableHeaderCell, { width: '8%' }]}>Vecka</Text>
          <Text style={[shared.tableHeaderCell, { width: '10%' }]}>Dag</Text>
          <Text style={[shared.tableHeaderCell, { width: '28%' }]}>Arbetsmoment</Text>
          <Text style={[shared.tableHeaderCell, { width: '8%' }]}>Timmar</Text>
          <Text style={[shared.tableHeaderCell, { width: '10%' }]}>Godkänd</Text>
          <Text style={[shared.tableHeaderCell, { flex: 1 }]}>Kommentar</Text>
        </View>

        {entries.length === 0 ? (
          <Text style={shared.emptyState}>Ingen aktivitetsdata registrerad.</Text>
        ) : (
          entries.map((entry, i) => (
            <View key={i} style={[shared.tableRow, i % 2 === 0 ? shared.tableRowAlt : shared.tableRowEven]}>
              <Text style={[shared.tableCell, { width: '12%' }]}>{formatDate(entry.registeredAt)}</Text>
              <Text style={[shared.tableCell, { width: '8%' }]}>{formatWeekLabel(entry.weekStart, entry.registeredAt)}</Text>
              <Text style={[shared.tableCell, { width: '10%' }]}>{translateDayLabel(entry.dayLabel)}</Text>
              <Text style={[shared.tableCell, { width: '28%' }]}>{entry.activity || '-'}</Text>
              <Text style={[shared.tableCell, { width: '8%' }]}>{entry.hours.toFixed(1)}</Text>
              <Text style={[shared.tableCell, { width: '10%' }]}>{entry.approved ? 'Ja' : 'Nej'}</Text>
              <Text style={[shared.tableCellMuted, { flex: 1 }]}>{entry.comment || '-'}</Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

function ActivityDistributionChart({ student }: { student: PdfStudent }) {
  const distribution = getActivityDistribution(student);
  const totalHours = distribution.reduce((sum, item) => sum + item.hours, 0);

  return (
    <View style={s.chartSectionWrap} wrap={false}>
      <Text style={shared.sectionTitle}>Timmar per arbetsmoment</Text>
      {distribution.length === 0 ? (
        <Text style={shared.emptyState}>Ingen aktivitetsdata tillgänglig för diagram.</Text>
      ) : (
        <View style={s.chartLayout}>
          <View style={s.chartLeft}>
            <Svg width={170} height={170} viewBox="0 0 180 180">
              {distribution.length === 1 ? (
                <>
                  <Circle cx={90} cy={90} r={74} fill={distribution[0].color} />
                  <Text x={90} y={90} style={s.chartSlicePercent}>100%</Text>
                </>
              ) : (
                (() => {
                  let angle = -90;
                  return distribution.map((item, index) => {
                    const start = angle;
                    const sweep = (item.percent / 100) * 360;
                    const end = start + sweep;
                    const path = describeSlicePath(90, 90, 74, start, end);
                    const midAngle = ((start + end) / 2) * (Math.PI / 180);
                    const labelRadius = 50;
                    const labelX = 90 + labelRadius * Math.cos(midAngle);
                    const labelY = 90 + labelRadius * Math.sin(midAngle);
                    angle += sweep;

                    return (
                      <React.Fragment key={index}>
                        <Path d={path} fill={item.color} stroke="#FFFFFF" strokeWidth={1.2} />
                        {item.percent >= 6 ? (
                          <Text x={labelX} y={labelY} style={s.chartSlicePercent}>
                            {`${Math.round(item.percent)}%`}
                          </Text>
                        ) : null}
                      </React.Fragment>
                    );
                  });
                })()
              )}
            </Svg>
          </View>

          <View style={s.chartRight}>
            <View style={s.chartRightHeader}>
              <Text style={[s.legendHeaderText, { width: '58%' }]}>Arbetsmoment</Text>
              <Text style={[s.legendHeaderText, { width: '24%', textAlign: 'right', paddingRight: 6 }]}>Timmar</Text>
              <Text style={[s.legendHeaderText, { width: '18%', textAlign: 'right' }]}>%</Text>
            </View>

            {distribution.map((item, index) => (
              <View key={index} style={s.legendRow}>
                <View style={s.legendActivity}>
                  <View style={[s.legendDot, { backgroundColor: item.color }]} />
                  <Text>{item.activity}</Text>
                </View>
                <Text style={s.legendHours}>{formatOneDecimal(item.hours)} h</Text>
                <Text style={s.legendPercent}>{formatOneDecimal(item.percent)}%</Text>
              </View>
            ))}

            <View style={s.legendTotalRow}>
              <Text style={s.legendTotalText}>Totalt</Text>
              <Text style={s.legendTotalHours}>{formatOneDecimal(totalHours)} h</Text>
              <Text style={s.legendTotalPercent}>100%</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Assessments table ───────────────────────────────────────────────────────

function AssessmentsTable({ student }: { student: PdfStudent }) {
  return (
    <View>
      <Text style={shared.sectionTitle}>Bedömningar</Text>
      <View style={shared.table}>
        <View style={[shared.tableHeaderRow, s.tableHeaderRow]}>
          <Text style={[shared.tableHeaderCell, { width: '12%' }]}>Vecka</Text>
          <Text style={[shared.tableHeaderCell, { width: '20%' }]}>Företag</Text>
          <Text style={[shared.tableHeaderCell, { width: '14%' }]}>Handledare</Text>
          <Text style={[shared.tableHeaderCell, { width: '16%' }]}>Telefonnummer</Text>
          <Text style={[shared.tableHeaderCell, { width: '12%' }]}>Omdöme</Text>
          <Text style={[shared.tableHeaderCell, { width: '10%' }]}>Status</Text>
        </View>

        {student.assessments.length === 0 ? (
          <Text style={shared.emptyState}>Ingen bedömning registrerad för eleven.</Text>
        ) : (
          student.assessments.map((a, i) => (
            <View key={i} style={[shared.tableRow, i % 2 === 0 ? shared.tableRowAlt : shared.tableRowEven]}>
              <Text style={[shared.tableCell, { width: '12%' }]}>{formatWeekLabel(a.weekStart, a.submittedAt)}</Text>
              <Text style={[shared.tableCell, { width: '20%' }]}>{a.assessorCompany || '-'}</Text>
              <Text style={[shared.tableCell, { width: '14%' }]}>{a.assessorName || '-'}</Text>
              <Text style={[shared.tableCellMuted, { width: '16%' }]}>{a.assessorPhone || '-'}</Text>
              <Text style={[shared.tableCell, { width: '12%' }]}>{a.rating || '-'}</Text>
              <Text style={[shared.tableCell, { width: '10%' }]}>{translateAssessmentStatus(a.status)}</Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

// ─── Compensation table ──────────────────────────────────────────────────────

function CompensationTable({ student }: { student: PdfStudent }) {
  const assessmentWeekById = new Map(
    student.assessments.map((assessment) => [
      assessment.id,
      formatWeekLabel(assessment.weekStart, assessment.submittedAt),
    ]),
  );

  return (
    <View>
      <Text style={shared.sectionTitle}>Luncher & Kilometer</Text>
      <View style={shared.table}>
        <View style={[shared.tableHeaderRow, s.tableHeaderRow]}>
          <Text style={[shared.tableHeaderCell, { width: '20%' }]}>Vecka</Text>
          <Text style={[shared.tableHeaderCell, { width: '20%' }]}>Luncher</Text>
          <Text style={[shared.tableHeaderCell, { width: '20%' }]}>Kilometer</Text>
          <Text style={[shared.tableHeaderCell, { width: '20%' }]}>Källa</Text>
          <Text style={[shared.tableHeaderCell, { flex: 1 }]}>Kommentar</Text>
        </View>

        {student.compensations.length === 0 ? (
          <Text style={shared.emptyState}>Ingen ersättningsdata registrerad.</Text>
        ) : (
          student.compensations.map((c, i) => (
            <View key={i} style={[shared.tableRow, i % 2 === 0 ? shared.tableRowAlt : shared.tableRowEven]}>
              <Text style={[shared.tableCell, { width: '20%' }]}>
                {(() => {
                  const directWeek = formatWeekLabel(c.weekStart);
                  if (directWeek !== '-') return directWeek;

                  if (c.source === 'Bedomning' && c.id.startsWith('assessment_')) {
                    const linkedAssessmentId = c.id.slice('assessment_'.length);
                    return assessmentWeekById.get(linkedAssessmentId) || '-';
                  }

                  return '-';
                })()}
              </Text>
              <Text style={[shared.tableCell, { width: '20%' }]}>{c.lunches}</Text>
              <Text style={[shared.tableCell, { width: '20%' }]}>{c.kilometers}</Text>
              <Text style={[shared.tableCell, { width: '20%' }]}>{c.source === 'Bedomning' ? 'Bedömning' : 'Ersättning'}</Text>
              <Text style={[shared.tableCellMuted, { flex: 1 }]}>{c.comment || '-'}</Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────────────

function PageFooter({ generatedAt }: { generatedAt: Date }) {
  return (
    <View style={s.footer} fixed>
      <Text style={shared.footerText}>APL-appen | Elevrapport</Text>
      <Text style={shared.footerText}>Genererad: {formatDateTime(generatedAt)}</Text>
      <Text style={shared.footerText} render={({ pageNumber, totalPages }) => `Sida ${pageNumber} / ${totalPages}`} />
    </View>
  );
}

// ─── Main document ───────────────────────────────────────────────────────────

export type StudentReportProps = {
  student: PdfStudent;
  generatedAt: Date;
};

export function StudentReport({ student, generatedAt }: StudentReportProps) {
  return (
    <Document title={`APL-rapport – ${student.name}`} author="APL-appen">
      <Page size="A4" style={shared.page}>
        {/* Header */}
        <View style={s.header}>
          <Image src="/apl_logo_512.png" style={s.headerLogo} />
          <View style={shared.headerText}>
            <Text style={shared.reportTitle}>{student.name}</Text>
            <Text style={shared.reportSubtitle}>
              Klass: {student.className || 'Ingen klass'} · Inriktning: {student.specialization || '-'}
            </Text>
            <Text style={[shared.reportSubtitle, { marginTop: 2 }]}>
              E-post: {student.email || '-'} · Status: {translateStatus(student.status)}
            </Text>
          </View>
        </View>

        {/* Stat cards */}
        <View style={shared.statsRow}>
          <StatCard label="Totala timmar" value={student.totalHours.toFixed(1)} color="#9A3412" bg="#FFF7ED" />
          <StatCard label="Godkända tidkort" value={`${student.approvedTimesheets}/${student.timesheetCount}`} color="#C2410C" bg="#FFEDD5" />
          <StatCard label="Bedömningar" value={student.assessmentCount} color="#EA580C" bg="#FFF7ED" />
          <StatCard label="Arbetsmoment" value={new Set(student.entries.map((e) => e.activity)).size} color="#D97706" bg="#FFEDD5" />
          <StatCard label="Luncher" value={student.approvedLunches} color="#B45309" bg="#FFF7ED" />
          <StatCard label="Kilometer" value={student.approvedKilometers} color="#C2410C" bg="#FFEDD5" />
        </View>

        {/* Tables */}
        <ActivityTable student={student} />
        <ActivityDistributionChart student={student} />
        <AssessmentsTable student={student} />
        <CompensationTable student={student} />

        <PageFooter generatedAt={generatedAt} />
      </Page>
    </Document>
  );
}
