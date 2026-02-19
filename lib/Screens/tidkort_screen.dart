import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../main.dart' show WeeklyTimesheetScreen;

String _ymd(DateTime d) {
  String two(int n) => n.toString().padLeft(2, '0');
  return '${d.year}-${two(d.month)}-${two(d.day)}';
}

// Beräkna måndagen för en given ISO-vecka
DateTime _getDateOfIsoWeek(int year, int week) {
  final jan4 = DateTime(year, 1, 4);
  final monday = jan4.subtract(Duration(days: jan4.weekday - DateTime.monday));
  return monday.add(Duration(days: (week - 1) * 7));
}

class TidkortScreen extends StatelessWidget {
  const TidkortScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser!;

    // Hämta användarens teacherUid och klassUid först
    final userDocStream = FirebaseFirestore.instance
        .collection('users')
        .doc(user.uid)
        .snapshots();

    return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      stream: userDocStream,
      builder: (context, userSnap) {
        if (userSnap.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }

        final userData = userSnap.data?.data() ?? {};
        final teacherUid = (userData['teacherUid'] ?? '').toString().trim();
        final classId = (userData['classId'] ?? '').toString().trim();

        if (teacherUid.isEmpty) {
          return const Center(child: Text('Ingen lärare kopplad.'));
        }

        // Hämta veckkonfiguration för klassen och eleven
        return _WeekEnabledLoader(
          classId: classId,
          studentUid: user.uid,
          teacherUid: teacherUid,
        );
      },
    );
  }
}

class _WeekEnabledLoader extends StatelessWidget {
  final String classId;
  final String studentUid;
  final String teacherUid;

  const _WeekEnabledLoader({
    required this.classId,
    required this.studentUid,
    required this.teacherUid,
  });

  @override
  Widget build(BuildContext context) {
    // Hämta klassens veckkonfiguration
    return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>?>(
      stream: classId.isNotEmpty
          ? FirebaseFirestore.instance
                .collection('classes')
                .doc(classId)
                .snapshots()
          : Stream.value(null),
      builder: (context, classSnap) {
        // Hämta elevens eventuella överskrivningar
        return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>?>(
          stream: classId.isNotEmpty
              ? FirebaseFirestore.instance
                    .collection('classes')
                    .doc(classId)
                    .collection('studentWeekOverrides')
                    .doc(studentUid)
                    .snapshots()
              : Stream.value(null),
          builder: (context, overrideSnap) {
            // Bestäm vilka veckor som är aktiverade
            Map<int, bool> weekEnabled = {};

            print('DEBUG TIDKORT: Checking override for student $studentUid');
            print(
              'DEBUG TIDKORT: Override exists: ${overrideSnap.data?.exists}',
            );
            print('DEBUG TIDKORT: Override data: ${overrideSnap.data?.data()}');

            if (overrideSnap.data?.exists == true) {
              // Använd elevens överskrivningar
              final rawData = overrideSnap.data?.data()?['weekEnabled'];
              print('DEBUG TIDKORT: Using OVERRIDE weekEnabled: $rawData');
              if (rawData is Map) {
                for (var entry in (rawData).entries) {
                  final key = int.tryParse(entry.key.toString());
                  final value = entry.value;
                  if (key != null && value is bool) {
                    weekEnabled[key] = value;
                  }
                }
              }
            } else if (classSnap.data?.exists == true) {
              // Använd klassens standard
              final rawData = classSnap.data?.data()?['weekEnabled'];
              print('DEBUG TIDKORT: Using CLASS weekEnabled: $rawData');
              if (rawData is Map) {
                for (var entry in (rawData).entries) {
                  final key = int.tryParse(entry.key.toString());
                  final value = entry.value;
                  if (key != null && value is bool) {
                    weekEnabled[key] = value;
                  }
                }
              }
            }

            print(
              'DEBUG TIDKORT: Final weekEnabled has ${weekEnabled.length} weeks enabled',
            );
            print(
              'DEBUG TIDKORT: Weeks: ${weekEnabled.keys.take(10).toList()}...',
            );

            // Om ingen konfiguration finns, visa alla veckor
            if (weekEnabled.isEmpty) {
              return _TimesheetList(
                studentUid: studentUid,
                teacherUid: teacherUid,
                classId: classId,
                weekEnabled: null,
              );
            }

            return _TimesheetList(
              studentUid: studentUid,
              teacherUid: teacherUid,
              classId: classId,
              weekEnabled: weekEnabled,
            );
          },
        );
      },
    );
  }
}

class _TimesheetList extends StatelessWidget {
  final String studentUid;
  final String teacherUid;
  final String classId;
  final Map<int, bool>? weekEnabled;

  const _TimesheetList({
    required this.studentUid,
    required this.teacherUid,
    required this.classId,
    this.weekEnabled,
  });

  @override
  Widget build(BuildContext context) {
    // Hämta alla tidkort för denna användare
    final timesheetQuery = FirebaseFirestore.instance
        .collection('timesheets')
        .where('studentUid', isEqualTo: studentUid)
        .orderBy('weekStart', descending: true);

    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: timesheetQuery.snapshots(),
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }

        final allDocs = snap.data?.docs ?? [];

        // Om weekEnabled är null, visa meddelande
        if (weekEnabled == null) {
          return const Center(
            child: Text(
              'Inga veckor aktiverade ännu',
              style: TextStyle(fontSize: 16),
            ),
          );
        }

        // Skapa lista med alla aktiverade veckor för innevarande läsår
        final now = DateTime.now();
        final currentYear = now.year;
        final List<Map<String, dynamic>> weekItems = [];

        // Lägg till alla aktiverade veckor
        for (var entry in weekEnabled!.entries) {
          if (entry.value == true) {
            final weekNum = entry.key;

            // Beräkna veckans startdatum (måndag)
            final weekStartDate = _getDateOfIsoWeek(currentYear, weekNum);
            final weekStartStr = _ymd(weekStartDate);

            // Kolla om tidkort finns för denna vecka
            QueryDocumentSnapshot<Map<String, dynamic>>? existingDoc;
            try {
              existingDoc = allDocs.firstWhere(
                (doc) => doc.data()['weekStart'] == weekStartStr,
              );
            } catch (e) {
              existingDoc = null;
            }

            weekItems.add({
              'weekNumber': weekNum,
              'weekStart': weekStartStr,
              'weekStartDate': weekStartDate,
              'doc': existingDoc,
              'approved': existingDoc?.data()['approved'] ?? false,
              'locked': existingDoc?.data()['locked'] ?? false,
            });
          }
        }

        // Sortera: denna vecka först, sedan i veckonummerordning 1-52
        final thisWeekMonday = now.subtract(
          Duration(days: now.weekday - DateTime.monday),
        );
        final thisWeekStart = _ymd(thisWeekMonday);

        weekItems.sort((a, b) {
          if (a['weekStart'] == thisWeekStart) return -1;
          if (b['weekStart'] == thisWeekStart) return 1;
          return (a['weekNumber'] as int).compareTo(b['weekNumber'] as int);
        });

        if (weekItems.isEmpty) {
          return const Center(
            child: Text(
              'Inga veckor aktiverade',
              style: TextStyle(fontSize: 16),
            ),
          );
        }

        return ListView.builder(
          padding: const EdgeInsets.all(12),
          itemCount: weekItems.length,
          itemBuilder: (context, index) {
            final item = weekItems[index];
            final weekNumber = item['weekNumber'] as int;
            final weekStartStr = item['weekStart'] as String;
            final weekStartDate = item['weekStartDate'] as DateTime;
            final approved = item['approved'] as bool;
            final locked = item['locked'] as bool;
            final doc =
                item['doc'] as QueryDocumentSnapshot<Map<String, dynamic>>?;

            // Beräkna datum-range
            final weekEndDate = weekStartDate.add(
              const Duration(days: 4),
            ); // fredag
            final dateRange =
                '${weekStartDate.day}/${weekStartDate.month} - ${weekEndDate.day}/${weekEndDate.month}';

            final isThisWeek = weekStartStr == thisWeekStart;

            // Beräkna totalt timmar för veckan
            int totalHours = 0;
            if (doc != null) {
              final data = doc.data();
              final entries =
                  (data['entries'] as Map?)?.cast<String, dynamic>() ?? {};
              for (final row in entries.values) {
                if (row is Map) {
                  for (final v in row.values) {
                    totalHours += (v is int)
                        ? v
                        : int.tryParse(v.toString()) ?? 0;
                  }
                }
              }
            }

            return Card(
              margin: const EdgeInsets.only(bottom: 12),
              elevation: isThisWeek ? 4 : 1,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: isThisWeek
                    ? BorderSide(color: Colors.orange.shade500, width: 2)
                    : BorderSide(color: Colors.grey.shade200, width: 1),
              ),
              child: ListTile(
                contentPadding: const EdgeInsets.all(16),
                title: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Vecka $weekNumber',
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          dateRange,
                          style: TextStyle(
                            fontSize: 11,
                            color: Colors.grey.shade500,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '$totalHours timmar',
                          style: TextStyle(
                            fontSize: 13,
                            color: Colors.grey.shade600,
                          ),
                        ),
                      ],
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        if (locked)
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.red.shade100,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  Icons.lock,
                                  size: 12,
                                  color: Colors.red.shade700,
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  'Låst',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Colors.red.shade700,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          )
                        else if (approved)
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.green.shade100,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              'Godkänd ✅',
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.green.shade700,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          )
                        else if (isThisWeek)
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.orange.shade100,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              'Pågående',
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.orange.shade700,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        const SizedBox(height: 4),
                        Icon(
                          Icons.arrow_forward_ios,
                          size: 14,
                          color: Colors.grey.shade400,
                        ),
                      ],
                    ),
                  ],
                ),
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => _TimesheetDetailScreen(
                        studentUid: studentUid,
                        teacherUid: teacherUid,
                        classId: classId,
                        weekStart: weekStartStr,
                      ),
                    ),
                  );
                },
              ),
            );
          },
        );
      },
    );
  }
}

// Widget för att visa tidkortsdetaljer
class _TimesheetDetailScreen extends StatefulWidget {
  final String studentUid;
  final String teacherUid;
  final String classId;
  final String weekStart;

  const _TimesheetDetailScreen({
    required this.studentUid,
    required this.teacherUid,
    required this.classId,
    required this.weekStart,
  });

  @override
  State<_TimesheetDetailScreen> createState() => _TimesheetDetailScreenState();
}

class _TimesheetDetailScreenState extends State<_TimesheetDetailScreen> {
  @override
  Widget build(BuildContext context) {
    // Kolla om tidkortet är låst innan vi tillåter redigering
    return StreamBuilder<DocumentSnapshot>(
      stream: FirebaseFirestore.instance
          .collection('timesheets')
          .doc('${widget.studentUid}_${widget.weekStart}')
          .snapshots(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        final data = snapshot.data?.data() as Map<String, dynamic>?;
        final isLocked = data?['locked'] as bool? ?? false;
        final isApproved = data?['approved'] as bool? ?? false;

        return WeeklyTimesheetScreen(
          studentUid: widget.studentUid,
          teacherUid: widget.teacherUid,
          classId: widget.classId,
          weekStart: widget.weekStart,
          readOnly: isLocked, // Låsta tidkort är read-only
          lockedMessage: isLocked
              ? (isApproved
                    ? 'Detta tidkort är godkänt och låst av handledare'
                    : 'Detta tidkort är låst')
              : null,
        );
      },
    );
  }
}
