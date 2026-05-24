import { StyleSheet } from '@react-pdf/renderer';

export const NAVY = '#1E3A8A';
export const NAVY_LIGHT = '#EFF6FF';
export const GRAY_BG = '#F8FAFC';
export const GRAY_BORDER = '#E2E8F0';
export const TEXT_DARK = '#0F172A';
export const TEXT_MUTED = '#64748B';
export const GREEN = '#15803D';
export const GREEN_BG = '#F0FDF4';
export const AMBER = '#B45309';
export const AMBER_BG = '#FFFBEB';
export const PURPLE = '#7E22CE';
export const PURPLE_BG = '#FAF5FF';
export const TEAL = '#0F766E';
export const TEAL_BG = '#F0FDFA';
export const ORANGE = '#C2410C';
export const ORANGE_BG = '#FFF7ED';

export const shared = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    backgroundColor: GRAY_BG,
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 36,
    fontSize: 10,
    color: TEXT_DARK,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: NAVY,
  },
  headerText: {
    flex: 1,
  },
  reportTitle: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: TEXT_DARK,
    marginBottom: 3,
  },
  reportSubtitle: {
    fontSize: 10,
    color: TEXT_MUTED,
  },

  // Stat cards row
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
  },
  statCardIcon: {
    fontSize: 14,
    marginBottom: 4,
  },
  statCardValue: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  statCardLabel: {
    fontSize: 8,
    color: TEXT_MUTED,
  },

  // Info block
  infoGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  infoBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: GRAY_BORDER,
  },
  infoLabel: {
    fontSize: 8,
    color: TEXT_MUTED,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: TEXT_DARK,
  },

  // Section title
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: TEXT_DARK,
    marginBottom: 6,
    marginTop: 14,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: GRAY_BORDER,
  },

  // Table
  table: {
    width: '100%',
    marginBottom: 4,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: NAVY,
    borderRadius: 4,
    marginBottom: 1,
  },
  tableHeaderCell: {
    color: '#FFFFFF',
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    padding: 5,
    paddingVertical: 6,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: GRAY_BORDER,
    minHeight: 20,
  },
  tableRowAlt: {
    backgroundColor: '#FFFFFF',
  },
  tableRowEven: {
    backgroundColor: GRAY_BG,
  },
  tableCell: {
    fontSize: 9,
    padding: 4,
    paddingVertical: 5,
    color: TEXT_DARK,
  },
  tableCellMuted: {
    fontSize: 9,
    padding: 4,
    paddingVertical: 5,
    color: TEXT_MUTED,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 36,
    right: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: GRAY_BORDER,
    paddingTop: 6,
  },
  footerText: {
    fontSize: 8,
    color: TEXT_MUTED,
  },

  // Empty state
  emptyState: {
    fontSize: 9,
    color: TEXT_MUTED,
    fontStyle: 'italic',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
});
