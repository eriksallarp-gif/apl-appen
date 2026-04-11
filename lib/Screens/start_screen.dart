import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'apl_documents_screen.dart';
import 'weekly_timesheet_screen.dart';

String _ymd(DateTime d) {
  String two(int n) => n.toString().padLeft(2, '0');
  return '${d.year}-${two(d.month)}-${two(d.day)}';
}

class StartScreen extends StatelessWidget {
  const StartScreen({super.key});

  int _sumEntries(Map<String, dynamic> entries) {
    int sum = 0;
    for (final row in entries.values) {
      if (row is Map) {
        for (final v in row.values) {
          sum += (v is int) ? v : int.tryParse(v.toString()) ?? 0;
        }
      }
    }
    return sum;
  }

  String _getGreeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) {
      return 'God morgon';
    } else if (hour < 18) {
      return 'God eftermiddag';
    } else {
      return 'God kväll';
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser!;
    final userDocStream = FirebaseFirestore.instance
        .collection('users')
        .doc(user.uid)
        .snapshots();

    return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      stream: userDocStream,
      builder: (outerContext, userSnap) {
        if (userSnap.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        final userData = userSnap.data?.data() ?? {};
        final displayName = (userData['displayName'] ?? '').toString().trim();

        final timesheetQuery = FirebaseFirestore.instance
            .collection('timesheets')
            .where('studentUid', isEqualTo: user.uid);

        return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
          stream: timesheetQuery.snapshots(),
          builder: (innerContext, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return const Scaffold(
                body: Center(child: CircularProgressIndicator()),
              );
            }

            final docs = snap.data?.docs ?? [];

            // Beräkna denna veckas timmar
            final now = DateTime.now();
            final monday = now.subtract(
              Duration(days: now.weekday - DateTime.monday),
            );
            final weekStart = _ymd(monday);

            int thisWeekHours = 0;
            int approvedCount = 0;
            bool thisWeekExists = false;
            Map<String, int> dayHours = {
              'mon': 0,
              'tue': 0,
              'wed': 0,
              'thu': 0,
              'fri': 0,
            };

            for (final d in docs) {
              final data = d.data();
              final entries =
                  (data['entries'] as Map?)?.cast<String, dynamic>() ?? {};
              final sum = _sumEntries(entries);

              if ((data['approved'] ?? false) == true) approvedCount++;

              String ws = (data['weekStart'] ?? '').toString().trim();
              if (ws == weekStart) {
                thisWeekHours = sum;
                thisWeekExists = true;

                // Summera per dag
                for (final entry in entries.entries) {
                  final dayMap =
                      (entry.value as Map?)?.cast<String, dynamic>() ?? {};
                  for (final day in dayHours.keys) {
                    final val = dayMap[day];
                    dayHours[day] =
                        (dayHours[day] ?? 0) +
                        (val is int ? val : int.tryParse(val.toString()) ?? 0);
                  }
                }
              }
            }

            final daysRemaining = 5 - (now.weekday - DateTime.monday);
            final weekProgress = (thisWeekHours / 40)
                .clamp(0.0, 1.0)
                .toDouble();
            final remainingHours = (40 - thisWeekHours).clamp(0, 40);

            // Hämta teacherUid för navigering
            final teacherUid = (userData['teacherUid'] ?? '').toString().trim();

            return Scaffold(
              body: SingleChildScrollView(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SafeArea(bottom: false, child: SizedBox(height: 8)),
                      // Välkomsthälsning
                      Text(
                        _getGreeting(),
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w500,
                          color: Colors.grey,
                        ),
                      ),
                      Text(
                        displayName.isEmpty ? 'Där' : displayName,
                        style: const TextStyle(
                          fontSize: 28,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 14),

                      // Denna veckas status — stor kort med circular progress (KLICKBAR)
                      GestureDetector(
                        onTap: thisWeekExists && teacherUid.isNotEmpty
                            ? () {
                                Navigator.of(innerContext).push(
                                  MaterialPageRoute(
                                    builder: (_) => WeeklyTimesheetScreen(
                                      studentUid: user.uid,
                                      teacherUid: teacherUid,
                                      weekStart: weekStart,
                                      readOnly: false,
                                    ),
                                  ),
                                );
                              }
                            : null,
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(24),
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [
                                Color(0xFFFF8A00),
                                Color(0xFFFF6A00),
                                Color(0xFFE65A00),
                              ],
                              stops: [0.0, 0.68, 1.0],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(26),
                            boxShadow: const [
                              BoxShadow(
                                color: Color(0x52FF8A00),
                                blurRadius: 30,
                                offset: Offset(0, 14),
                              ),
                            ],
                          ),
                          child: Stack(
                            children: [
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Denna vecka',
                                    style: TextStyle(
                                      color: Colors.white.withValues(
                                        alpha: 0.82,
                                      ),
                                      fontSize: 12,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                  const SizedBox(height: 12),
                                  Row(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              '$thisWeekHours timmar',
                                              style: const TextStyle(
                                                color: Colors.white,
                                                fontSize: 34,
                                                fontWeight: FontWeight.w800,
                                                height: 1.0,
                                              ),
                                            ),
                                            const SizedBox(height: 8),
                                            Text(
                                              thisWeekExists
                                                  ? 'Din pågående registrering'
                                                  : 'Ingen tid registrerad ännu',
                                              style: TextStyle(
                                                color: Colors.white.withValues(
                                                  alpha: 0.82,
                                                ),
                                                fontSize: 13,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      const SizedBox(width: 16),
                                      SizedBox(
                                        width: 72,
                                        height: 72,
                                        child: TweenAnimationBuilder<double>(
                                          tween: Tween<double>(
                                            begin: 0,
                                            end: weekProgress,
                                          ),
                                          duration: const Duration(
                                            milliseconds: 700,
                                          ),
                                          builder: (context, animatedValue, _) {
                                            return Stack(
                                              fit: StackFit.expand,
                                              children: [
                                                CircularProgressIndicator(
                                                  value: animatedValue,
                                                  strokeWidth: 6,
                                                  backgroundColor: Colors.white
                                                      .withValues(alpha: 0.22),
                                                  valueColor:
                                                      const AlwaysStoppedAnimation(
                                                        Colors.white,
                                                      ),
                                                ),
                                                Center(
                                                  child: Text(
                                                    '${(weekProgress * 100).round()}%',
                                                    style: const TextStyle(
                                                      color: Colors.white,
                                                      fontSize: 12,
                                                      fontWeight:
                                                          FontWeight.w700,
                                                    ),
                                                  ),
                                                ),
                                              ],
                                            );
                                          },
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 16),
                                  Text(
                                    remainingHours == 0
                                        ? 'Målet är uppnått denna vecka'
                                        : '$remainingHours timmar kvar till 40 h',
                                    style: TextStyle(
                                      color: Colors.white.withValues(
                                        alpha: 0.90,
                                      ),
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    daysRemaining > 0
                                        ? '$daysRemaining dagar kvar (fredag 23:59)'
                                        : 'Veckan är avslutad',
                                    style: TextStyle(
                                      color: Colors.white.withValues(
                                        alpha: 0.74,
                                      ),
                                      fontSize: 12,
                                    ),
                                  ),
                                  const SizedBox(height: 12),
                                  if (thisWeekExists && teacherUid.isNotEmpty)
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 12,
                                        vertical: 8,
                                      ),
                                      decoration: BoxDecoration(
                                        color: Colors.white.withValues(
                                          alpha: 0.18,
                                        ),
                                        borderRadius: BorderRadius.circular(
                                          999,
                                        ),
                                      ),
                                      child: const Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Icon(
                                            Icons.arrow_forward_rounded,
                                            color: Colors.white,
                                            size: 14,
                                          ),
                                          SizedBox(width: 6),
                                          Text(
                                            'Öppna tidkort',
                                            style: TextStyle(
                                              color: Colors.white,
                                              fontSize: 11,
                                              fontWeight: FontWeight.w600,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Daglig översikt
                      const Text(
                        'Denna veckans dagsvärde',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 12),
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Row(
                          children: [
                            _DayCard(day: 'Mån', hours: dayHours['mon'] ?? 0),
                            const SizedBox(width: 8),
                            _DayCard(day: 'Tis', hours: dayHours['tue'] ?? 0),
                            const SizedBox(width: 8),
                            _DayCard(day: 'Ons', hours: dayHours['wed'] ?? 0),
                            const SizedBox(width: 8),
                            _DayCard(day: 'Tor', hours: dayHours['thu'] ?? 0),
                            const SizedBox(width: 8),
                            _DayCard(day: 'Fre', hours: dayHours['fri'] ?? 0),
                          ],
                        ),
                      ),
                      const SizedBox(height: 28),

                      // Snabbåtkomst
                      const Text(
                        'Snabbåtkomst',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Material(
                        color: Colors.transparent,
                        child: InkWell(
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => const AplDocumentsScreen(),
                              ),
                            );
                          },
                          borderRadius: BorderRadius.circular(12),
                          child: Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              border: Border.all(
                                color: const Color(0xFFFFCBA8),
                                width: 1.6,
                              ),
                              borderRadius: BorderRadius.circular(16),
                              color: const Color(0xFFFFF8F2),
                              boxShadow: const [
                                BoxShadow(
                                  color: Color(0x1FFF8A00),
                                  blurRadius: 12,
                                  offset: Offset(0, 5),
                                ),
                              ],
                            ),
                            child: Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFFFE7D1),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: const Icon(
                                    Icons.folder_open,
                                    color: Color(0xFFE56A00),
                                    size: 28,
                                  ),
                                ),
                                const SizedBox(width: 16),
                                const Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        'APL-dokument',
                                        style: TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 16,
                                        ),
                                      ),
                                      SizedBox(height: 4),
                                      Text(
                                        'Viktiga dokument och information',
                                        style: TextStyle(
                                          fontSize: 13,
                                          color: Colors.grey,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const Icon(
                                  Icons.arrow_forward_ios,
                                  size: 16,
                                  color: Color(0xFFC27A35),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Status från läraren
                      if (approvedCount > 0) ...[
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFF1E5),
                            border: Border.all(
                              color: const Color(0xFFFFC38D),
                              width: 1.5,
                            ),
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Row(
                            children: [
                              const Icon(
                                Icons.check_circle,
                                color: Color(0xFFE56A00),
                                size: 28,
                              ),
                              const SizedBox(width: 16),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text(
                                      'Godkända tidkort',
                                      style: TextStyle(
                                        color: Color(0xFF9A4E00),
                                        fontWeight: FontWeight.bold,
                                        fontSize: 14,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      '$approvedCount tidkort godkänd av läraren ✅',
                                      style: const TextStyle(
                                        color: Color(0xFFB25C05),
                                        fontSize: 12,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }
}

class _DayCard extends StatelessWidget {
  final String day;
  final int hours;

  const _DayCard({required this.day, required this.hours});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      decoration: BoxDecoration(
        color: hours > 0 ? const Color(0xFFFFF1E7) : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: hours > 0 ? const Color(0xFFFFCBA8) : const Color(0xFFE5E0DB),
        ),
        boxShadow: [
          BoxShadow(
            color: hours > 0
                ? const Color(0x26FF8A00)
                : const Color(0x14000000),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          Text(
            day,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: Colors.grey.shade700,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '$hours h',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: hours > 0 ? const Color(0xFFE65A00) : Colors.grey.shade600,
            ),
          ),
        ],
      ),
    );
  }
}
