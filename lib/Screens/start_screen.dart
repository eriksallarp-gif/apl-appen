import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../main.dart' show WeeklyTimesheetScreen;
import 'apl_documents_screen.dart';

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
    final userDocStream =
        FirebaseFirestore.instance.collection('users').doc(user.uid).snapshots();

    return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      stream: userDocStream,
      builder: (context, userSnap) {
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
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return const Scaffold(
                body: Center(child: CircularProgressIndicator()),
              );
            }

            final docs = snap.data?.docs ?? [];

            // Beräkna denna veckas timmar
            final now = DateTime.now();
            final monday =
                now.subtract(Duration(days: now.weekday - DateTime.monday));
            final weekStart = _ymd(monday);

            int thisWeekHours = 0;
            int totalHours = 0;
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
              totalHours += sum;

              if ((data['approved'] ?? false) == true) approvedCount++;

              String ws = (data['weekStart'] ?? '').toString().trim();
              if (ws == weekStart) {
                thisWeekHours = sum;
                thisWeekExists = true;
                
                // Summera per dag
                for (final entry in entries.entries) {
                  final dayMap = (entry.value as Map?)?.cast<String, dynamic>() ?? {};
                  for (final day in dayHours.keys) {
                    final val = dayMap[day];
                    dayHours[day] = (dayHours[day] ?? 0) + (val is int ? val : int.tryParse(val.toString()) ?? 0);
                  }
                }
              }
            }

            final daysRemaining = 5 - (now.weekday - DateTime.monday);
            final emoji = _getGreeting().contains('morgon') ? '🌅' : 
                          _getGreeting().contains('eftermiddag') ? '☀️' : '🌙';

            // Hämta teacherUid för navigering
            final teacherUid = (userData['teacherUid'] ?? '').toString().trim();

            return Scaffold(
              body: SingleChildScrollView(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Välkomsthälsning
                      Text(
                        '${_getGreeting()} $emoji',
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
                      const SizedBox(height: 24),

                      // Denna veckas status — stor kort med circular progress (KLICKBAR)
                      GestureDetector(
                        onTap: thisWeekExists && teacherUid.isNotEmpty
                            ? () {
                                Navigator.of(context).push(
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
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [
                                Colors.orange.shade400,
                                Colors.orange.shade600,
                              ],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(16),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.orange.shade200,
                                blurRadius: 8,
                                offset: const Offset(0, 4),
                              )
                            ],
                          ),
                          child: Column(
                            children: [
                              const Text(
                                'Denna vecka',
                                style: TextStyle(
                                  color: Colors.white70,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w500,
                                  letterSpacing: 0.5,
                                ),
                              ),
                              const SizedBox(height: 12),
                              // Circular progress
                              Stack(
                                alignment: Alignment.center,
                                children: [
                                  SizedBox(
                                    width: 100,
                                    height: 100,
                                    child: CircularProgressIndicator(
                                      value: (thisWeekHours / 40).clamp(0.0, 1.0),
                                      strokeWidth: 6,
                                      backgroundColor: Colors.white.withValues(alpha: 0.2),
                                      valueColor: AlwaysStoppedAnimation<Color>(
                                        Colors.white,
                                      ),
                                    ),
                                  ),
                                  Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Text(
                                        '$thisWeekHours',
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 28,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                      const Text(
                                        'timmar',
                                        style: TextStyle(
                                          color: Colors.white70,
                                          fontSize: 10,
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              // Status text
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                  vertical: 8,
                                ),
                                decoration: BoxDecoration(
                                  color: thisWeekHours >= 40
                                      ? Colors.green.shade400
                                      : Colors.amber.shade400,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  thisWeekHours >= 40
                                      ? '✅ Målet nått! Bra jobbat!'
                                      : '${40 - thisWeekHours} timmar kvar',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 13,
                                  ),
                                ),
                              ),
                              const SizedBox(height: 12),
                              if (daysRemaining > 0)
                                Text(
                                  '$daysRemaining dagar kvar (Fredag kl 23:59)',
                                  style: const TextStyle(
                                    color: Colors.white70,
                                    fontSize: 12,
                                  ),
                                ),
                              const SizedBox(height: 12),
                              if (thisWeekExists && teacherUid.isNotEmpty)
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                    vertical: 4,
                                  ),
                                  decoration: BoxDecoration(
                                    color: Colors.white.withValues(alpha: 0.3),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: const Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(
                                        Icons.touch_app,
                                        color: Colors.white,
                                        size: 14,
                                      ),
                                      SizedBox(width: 6),
                                      Text(
                                        'Tryck för att redigera',
                                        style: TextStyle(
                                          color: Colors.white,
                                          fontSize: 11,
                                        ),
                                      ),
                                    ],
                                  ),
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
                              border: Border.all(color: Colors.blue.shade200, width: 2),
                              borderRadius: BorderRadius.circular(12),
                              color: Colors.white,
                            ),
                            child: Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: Colors.blue.shade50,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Icon(
                                    Icons.folder_open,
                                    color: Colors.blue.shade600,
                                    size: 28,
                                  ),
                                ),
                                const SizedBox(width: 16),
                                const Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
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
                                Icon(
                                  Icons.arrow_forward_ios,
                                  size: 16,
                                  color: Colors.grey,
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
                            color: Colors.green.shade50,
                            border: Border.all(color: Colors.green.shade300, width: 2),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                Icons.check_circle,
                                color: Colors.green.shade600,
                                size: 28,
                              ),
                              const SizedBox(width: 16),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Godkända tidkort',
                                      style: TextStyle(
                                        color: Colors.green.shade700,
                                        fontWeight: FontWeight.bold,
                                        fontSize: 14,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      '$approvedCount tidkort godkänd av läraren ✅',
                                      style: TextStyle(
                                        color: Colors.green.shade600,
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

  const _DayCard({
    required this.day,
    required this.hours,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      decoration: BoxDecoration(
        color: hours > 0 ? Colors.orange.shade50 : Colors.grey.shade100,
        border: Border.all(
          color: hours > 0 ? Colors.orange.shade300 : Colors.grey.shade300,
          width: 2,
        ),
        borderRadius: BorderRadius.circular(12),
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
              fontWeight: FontWeight.bold,
              color: hours > 0 ? Colors.orange.shade600 : Colors.grey.shade600,
            ),
          ),
        ],
      ),
    );
  }
}
