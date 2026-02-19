import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'supervisor_assessments_tab.dart';

// Helper för att beräkna veckonummer
int _getWeekNumber(DateTime date) {
  final jan4 = DateTime(date.year, 1, 4);
  final monday = jan4.subtract(Duration(days: jan4.weekday - DateTime.monday));
  final weekNum = date.difference(monday).inDays ~/ 7 + 1;
  return weekNum;
}

// Helper för att formatera kort datum
String _formatShortDate(DateTime date) {
  return '${date.day}/${date.month}';
}

class ApprovalAndAssessmentScreen extends StatefulWidget {
  final bool showAllClasses;

  const ApprovalAndAssessmentScreen({super.key, this.showAllClasses = false});

  @override
  State<ApprovalAndAssessmentScreen> createState() =>
      _ApprovalAndAssessmentScreenState();
}

class _ApprovalAndAssessmentScreenState
    extends State<ApprovalAndAssessmentScreen>
    with SingleTickerProviderStateMixin {
  String? _selectedClassId;
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);

    // Om showAllClasses är true, sätt till 'ALL'
    if (widget.showAllClasses) {
      _selectedClassId = 'ALL';
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser!;

    return Scaffold(
      body: Column(
        children: [
          // Klassväljare
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Välj klass',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: Colors.grey,
                  ),
                ),
                const SizedBox(height: 8),
                StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
                  stream: FirebaseFirestore.instance
                      .collection('classes')
                      .where('teacherUid', isEqualTo: user.uid)
                      .snapshots(),
                  builder: (context, snap) {
                    if (snap.connectionState == ConnectionState.waiting) {
                      return const CircularProgressIndicator();
                    }

                    final classes = snap.data?.docs ?? [];

                    // Lägg till "Alla klasser" som första alternativ
                    final items = [
                      const DropdownMenuItem(
                        value: 'ALL',
                        child: Text('Alla klasser'),
                      ),
                      ...classes.map(
                        (doc) => DropdownMenuItem(
                          value: doc.id,
                          child: Text(doc.data()['name'] ?? 'Okänd klass'),
                        ),
                      ),
                    ];

                    return DropdownButton<String>(
                      hint: const Text('Välj klass'),
                      isExpanded: true,
                      value: _selectedClassId,
                      items: items,
                      onChanged: (classId) {
                        setState(() => _selectedClassId = classId);
                      },
                    );
                  },
                ),
              ],
            ),
          ),

          // Tabbar
          if (_selectedClassId != null)
            TabBar(
              controller: _tabController,
              labelColor: Colors.orange,
              unselectedLabelColor: Colors.grey,
              isScrollable: true,
              tabs: const [
                Tab(text: 'Godkännande'),
                Tab(text: 'Redan godkända'),
                Tab(text: 'Handledarbedömningar'),
              ],
            ),

          // Tab views
          if (_selectedClassId != null)
            Expanded(
              child: TabBarView(
                controller: _tabController,
                children: [
                  _ApprovalTab(classId: _selectedClassId!),
                  _ApprovedTimesheetsTab(classId: _selectedClassId!),
                  SupervisorAssessmentsTab(classId: _selectedClassId!),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

// ==================== GODKÄNNANDE FLIK ====================
class _ApprovalTab extends StatefulWidget {
  final String classId;
  const _ApprovalTab({required this.classId});

  @override
  State<_ApprovalTab> createState() => _ApprovalTabState();
}

class _ApprovalTabState extends State<_ApprovalTab> {
  @override
  Widget build(BuildContext context) {
    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance
          .collection('timesheets')
          .orderBy('weekStart', descending: true)
          .snapshots(),
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }

        final allTimesheets = snap.data?.docs ?? [];

        print(
          'DEBUG APPROVAL: Total timesheets in DB: ${allTimesheets.length}',
        );
        print('DEBUG APPROVAL: Selected classId: ${widget.classId}');

        // Filtrera för denna klass på klientsidan
        // Om classId saknas, hämta det från studentens profil
        return FutureBuilder<List<DocumentSnapshot<Map<String, dynamic>>>>(
          future: _filterTimesheetsByClass(
            allTimesheets,
            widget.classId,
            false,
          ),
          builder: (context, filteredSnap) {
            if (filteredSnap.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }

            final timesheets = filteredSnap.data ?? [];

            print('DEBUG APPROVAL: Filtered timesheets: ${timesheets.length}');

            if (timesheets.isEmpty) {
              return Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.check_circle,
                      size: 64,
                      color: Colors.green.shade300,
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'Alla tidkort är godkända ✅',
                      style: TextStyle(fontSize: 16, color: Colors.grey),
                    ),
                  ],
                ),
              );
            }

            return ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: timesheets.length,
              itemBuilder: (context, index) {
                final doc = timesheets[index];
                final data = doc.data() ?? {};
                final studentUid = data['studentUid'] as String? ?? 'Okänd';
                final weekStart = data['weekStart'] as String? ?? 'Okänd vecka';
                final isApproved = data['approved'] as bool? ?? false;
                final isLocked = data['locked'] as bool? ?? false;
                final tsClassId = data['classId'] as String?;

                return FutureBuilder<DocumentSnapshot<Map<String, dynamic>>>(
                  future: FirebaseFirestore.instance
                      .collection('users')
                      .doc(studentUid)
                      .get(),
                  builder: (context, userSnap) {
                    if (!userSnap.hasData) {
                      return const SizedBox.shrink();
                    }

                    final studentName =
                        userSnap.data?.data()?['displayName'] ?? 'Okänd';

                    // Beräkna veckonummer och datumintervall
                    int weekNumber = 1;
                    String dateRange = '';
                    try {
                      final weekStartDate = DateTime.parse(weekStart);
                      weekNumber = _getWeekNumber(weekStartDate);
                      final weekEndDate = weekStartDate.add(
                        const Duration(days: 4),
                      ); // Fredag
                      dateRange =
                          '${_formatShortDate(weekStartDate)} - ${_formatShortDate(weekEndDate)}';
                    } catch (e) {
                      dateRange = weekStart;
                    }

                    // Räkna timmar
                    int totalHours = 0;
                    final entries =
                        (data['entries'] as Map<String, dynamic>?) ?? {};
                    for (var entry in entries.values) {
                      if (entry is Map<String, dynamic>) {
                        for (var hours in entry.values) {
                          totalHours += (hours as num).toInt();
                        }
                      }
                    }

                    return Card(
                      margin: const EdgeInsets.only(bottom: 12),
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        studentName,
                                        style: const TextStyle(
                                          fontSize: 16,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      // Visa klassnamn om 'ALL' är valt
                                      if (widget.classId == 'ALL' &&
                                          tsClassId != null)
                                        FutureBuilder<
                                          DocumentSnapshot<Map<String, dynamic>>
                                        >(
                                          future: FirebaseFirestore.instance
                                              .collection('classes')
                                              .doc(tsClassId)
                                              .get(),
                                          builder: (context, classSnap) {
                                            final className =
                                                classSnap.data
                                                    ?.data()?['name'] ??
                                                'Okänd klass';
                                            return Padding(
                                              padding: const EdgeInsets.only(
                                                bottom: 4,
                                              ),
                                              child: Text(
                                                className,
                                                style: const TextStyle(
                                                  fontSize: 13,
                                                  color: Colors.orange,
                                                  fontWeight: FontWeight.w500,
                                                ),
                                              ),
                                            );
                                          },
                                        ),
                                      Text(
                                        'V. $weekNumber',
                                        style: const TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w600,
                                          color: Colors.black87,
                                        ),
                                      ),
                                      Text(
                                        dateRange,
                                        style: const TextStyle(
                                          fontSize: 11,
                                          color: Colors.grey,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        'Timmar: ${totalHours}h',
                                        style: const TextStyle(
                                          fontSize: 12,
                                          color: Colors.grey,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                Column(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 8,
                                        vertical: 4,
                                      ),
                                      decoration: BoxDecoration(
                                        color: isApproved
                                            ? Colors.green.shade100
                                            : Colors.orange.shade100,
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: Text(
                                        isApproved ? 'Godkänd' : 'Väntar',
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.bold,
                                          color: isApproved
                                              ? Colors.green.shade700
                                              : Colors.orange.shade700,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    if (isLocked)
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 8,
                                          vertical: 4,
                                        ),
                                        decoration: BoxDecoration(
                                          color: Colors.red.shade100,
                                          borderRadius: BorderRadius.circular(
                                            4,
                                          ),
                                        ),
                                        child: const Text(
                                          'Låst',
                                          style: TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.bold,
                                            color: Colors.red,
                                          ),
                                        ),
                                      ),
                                  ],
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.end,
                              children: [
                                if (!isApproved)
                                  ElevatedButton.icon(
                                    onPressed: () async {
                                      await FirebaseFirestore.instance
                                          .collection('timesheets')
                                          .doc(doc.id)
                                          .update({'approved': true});
                                    },
                                    icon: const Icon(Icons.check),
                                    label: const Text('Godkänn'),
                                  ),
                                const SizedBox(width: 8),
                                if (!isApproved)
                                  ElevatedButton.icon(
                                    onPressed: () async {
                                      await FirebaseFirestore.instance
                                          .collection('timesheets')
                                          .doc(doc.id)
                                          .update({'approved': false});
                                    },
                                    icon: const Icon(Icons.close),
                                    label: const Text('Avslå'),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: Colors.red,
                                    ),
                                  ),
                                if (isApproved && !isLocked)
                                  ElevatedButton.icon(
                                    onPressed: () async {
                                      await FirebaseFirestore.instance
                                          .collection('timesheets')
                                          .doc(doc.id)
                                          .update({'locked': true});
                                    },
                                    icon: const Icon(Icons.lock),
                                    label: const Text('Låsa'),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: Colors.purple,
                                    ),
                                  ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                );
              },
            );
          },
        );
      },
    );
  }

  // Filtrera tidkort för en specifik klass
  // Om classId saknas i tidkortet, hämta det från studentens profil
  // Om classId är 'ALL', visa tidkort från alla lärarens klasser
  // showApproved = true: visa godkända, false: visa icke godkända
  Future<List<DocumentSnapshot<Map<String, dynamic>>>> _filterTimesheetsByClass(
    List<DocumentSnapshot<Map<String, dynamic>>> timesheets,
    String classId,
    bool showApproved,
  ) async {
    final filtered = <DocumentSnapshot<Map<String, dynamic>>>[];

    // Om 'ALL' är valt, hämta alla klasser som tillhör läraren
    Set<String> teacherClassIds = {};
    if (classId == 'ALL') {
      final user = FirebaseAuth.instance.currentUser;
      if (user != null) {
        final classesSnap = await FirebaseFirestore.instance
            .collection('classes')
            .where('teacherUid', isEqualTo: user.uid)
            .get();
        teacherClassIds = classesSnap.docs.map((doc) => doc.id).toSet();
        print('DEBUG APPROVAL: Teacher has ${teacherClassIds.length} classes');
      }
    }

    for (var doc in timesheets) {
      final data = doc.data() ?? {};
      var tsClassId = data['classId'] as String?;
      final studentUid = data['studentUid'] as String?;
      final weekStart = data['weekStart'] as String?;

      // Om classId saknas, hämta det från studentens profil
      if (tsClassId == null || tsClassId.isEmpty) {
        if (studentUid != null && studentUid.isNotEmpty) {
          try {
            final userDoc = await FirebaseFirestore.instance
                .collection('users')
                .doc(studentUid)
                .get();
            tsClassId = userDoc.data()?['classId'] as String?;
            print(
              'DEBUG APPROVAL: Fetched classId from student profile: $tsClassId',
            );
          } catch (e) {
            print(
              'DEBUG APPROVAL: Error fetching classId for student $studentUid: $e',
            );
          }
        }
      }

      print(
        'DEBUG APPROVAL: Timesheet - classId=$tsClassId, studentUid=$studentUid, weekStart=$weekStart',
      );

      // Om 'ALL', kontrollera om tidkortet tillhör någon av lärarens klasser
      final match = classId == 'ALL'
          ? (tsClassId != null && teacherClassIds.contains(tsClassId))
          : tsClassId == classId;

      print('DEBUG APPROVAL: Match with selected class: $match');

      // Kontrollera även godkännandestatus
      final isApproved = data['approved'] as bool? ?? false;
      final matchApprovalStatus = showApproved ? isApproved : !isApproved;

      if (match && matchApprovalStatus) {
        filtered.add(doc);
      }
    }

    return filtered;
  }
}

// ==================== REDAN GODKÄNDA TIDKORT FLIK ====================
class _ApprovedTimesheetsTab extends StatefulWidget {
  final String classId;
  const _ApprovedTimesheetsTab({required this.classId});

  @override
  State<_ApprovedTimesheetsTab> createState() => _ApprovedTimesheetsTabState();
}

class _ApprovedTimesheetsTabState extends State<_ApprovedTimesheetsTab> {
  @override
  Widget build(BuildContext context) {
    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance
          .collection('timesheets')
          .orderBy('weekStart', descending: true)
          .snapshots(),
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }

        final allTimesheets = snap.data?.docs ?? [];

        // Filtrera för godkända tidkort i denna klass
        return FutureBuilder<List<DocumentSnapshot<Map<String, dynamic>>>>(
          future: _filterTimesheetsByClass(allTimesheets, widget.classId, true),
          builder: (context, filteredSnap) {
            if (filteredSnap.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }

            final timesheets = filteredSnap.data ?? [];

            if (timesheets.isEmpty) {
              return Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.inbox, size: 64, color: Colors.grey.shade300),
                    const SizedBox(height: 16),
                    const Text(
                      'Inga godkända tidkort än',
                      style: TextStyle(fontSize: 16, color: Colors.grey),
                    ),
                  ],
                ),
              );
            }

            return ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: timesheets.length,
              itemBuilder: (context, index) {
                final doc = timesheets[index];
                final data = doc.data() ?? {};
                final studentUid = data['studentUid'] as String? ?? 'Okänd';
                final weekStart = data['weekStart'] as String? ?? 'Okänd vecka';
                final isLocked = data['locked'] as bool? ?? false;
                final tsClassId = data['classId'] as String?;

                return FutureBuilder<DocumentSnapshot<Map<String, dynamic>>>(
                  future: FirebaseFirestore.instance
                      .collection('users')
                      .doc(studentUid)
                      .get(),
                  builder: (context, userSnap) {
                    if (!userSnap.hasData) {
                      return const SizedBox.shrink();
                    }

                    final studentName =
                        userSnap.data?.data()?['displayName'] ?? 'Okänd';

                    // Beräkna veckonummer och datumintervall
                    int weekNumber = 1;
                    String dateRange = '';
                    try {
                      final weekStartDate = DateTime.parse(weekStart);
                      weekNumber = _getWeekNumber(weekStartDate);
                      final weekEndDate = weekStartDate.add(
                        const Duration(days: 4),
                      );
                      dateRange =
                          '${_formatShortDate(weekStartDate)} - ${_formatShortDate(weekEndDate)}';
                    } catch (e) {
                      dateRange = weekStart;
                    }

                    // Räkna timmar
                    int totalHours = 0;
                    final entries =
                        (data['entries'] as Map<String, dynamic>?) ?? {};
                    for (var entry in entries.values) {
                      if (entry is Map<String, dynamic>) {
                        for (var hours in entry.values) {
                          totalHours += (hours as num).toInt();
                        }
                      }
                    }

                    return Card(
                      margin: const EdgeInsets.only(bottom: 12),
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        studentName,
                                        style: const TextStyle(
                                          fontSize: 16,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      // Visa klassnamn om 'ALL' är valt
                                      if (widget.classId == 'ALL' &&
                                          tsClassId != null)
                                        FutureBuilder<
                                          DocumentSnapshot<Map<String, dynamic>>
                                        >(
                                          future: FirebaseFirestore.instance
                                              .collection('classes')
                                              .doc(tsClassId)
                                              .get(),
                                          builder: (context, classSnap) {
                                            final className =
                                                classSnap.data
                                                    ?.data()?['name'] ??
                                                'Okänd klass';
                                            return Padding(
                                              padding: const EdgeInsets.only(
                                                bottom: 4,
                                              ),
                                              child: Text(
                                                className,
                                                style: const TextStyle(
                                                  fontSize: 13,
                                                  color: Colors.orange,
                                                  fontWeight: FontWeight.w500,
                                                ),
                                              ),
                                            );
                                          },
                                        ),
                                      Text(
                                        'V. $weekNumber',
                                        style: const TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w600,
                                          color: Colors.black87,
                                        ),
                                      ),
                                      Text(
                                        dateRange,
                                        style: const TextStyle(
                                          fontSize: 11,
                                          color: Colors.grey,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        'Timmar: ${totalHours}h',
                                        style: const TextStyle(
                                          fontSize: 12,
                                          color: Colors.grey,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                Column(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 8,
                                        vertical: 4,
                                      ),
                                      decoration: BoxDecoration(
                                        color: Colors.green.shade100,
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: Text(
                                        'Godkänd',
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.bold,
                                          color: Colors.green.shade700,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    if (isLocked)
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 8,
                                          vertical: 4,
                                        ),
                                        decoration: BoxDecoration(
                                          color: Colors.red.shade100,
                                          borderRadius: BorderRadius.circular(
                                            4,
                                          ),
                                        ),
                                        child: const Text(
                                          'Låst',
                                          style: TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.bold,
                                            color: Colors.red,
                                          ),
                                        ),
                                      ),
                                  ],
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.end,
                              children: [
                                if (!isLocked)
                                  ElevatedButton.icon(
                                    onPressed: () async {
                                      await FirebaseFirestore.instance
                                          .collection('timesheets')
                                          .doc(doc.id)
                                          .update({'locked': true});
                                    },
                                    icon: const Icon(Icons.lock),
                                    label: const Text('Låsa'),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: Colors.purple,
                                    ),
                                  ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                );
              },
            );
          },
        );
      },
    );
  }

  // Filtrera tidkort för en specifik klass
  // Om classId saknas i tidkortet, hämta det från studentens profil
  // Om classId är 'ALL', visa tidkort från alla lärarens klasser
  // showApproved = true: visa godkända, false: visa icke godkända
  Future<List<DocumentSnapshot<Map<String, dynamic>>>> _filterTimesheetsByClass(
    List<DocumentSnapshot<Map<String, dynamic>>> timesheets,
    String classId,
    bool showApproved,
  ) async {
    final filtered = <DocumentSnapshot<Map<String, dynamic>>>[];

    // Om 'ALL' är valt, hämta alla klasser som tillhör läraren
    Set<String> teacherClassIds = {};
    if (classId == 'ALL') {
      final user = FirebaseAuth.instance.currentUser;
      if (user != null) {
        final classesSnap = await FirebaseFirestore.instance
            .collection('classes')
            .where('teacherUid', isEqualTo: user.uid)
            .get();
        teacherClassIds = classesSnap.docs.map((doc) => doc.id).toSet();
      }
    }

    for (var doc in timesheets) {
      final data = doc.data() ?? {};
      var tsClassId = data['classId'] as String?;
      final studentUid = data['studentUid'] as String?;

      // Om classId saknas, hämta det från studentens profil
      if (tsClassId == null || tsClassId.isEmpty) {
        if (studentUid != null && studentUid.isNotEmpty) {
          try {
            final userDoc = await FirebaseFirestore.instance
                .collection('users')
                .doc(studentUid)
                .get();
            tsClassId = userDoc.data()?['classId'] as String?;
          } catch (e) {
            // Ignorera fel
          }
        }
      }

      // Om 'ALL', kontrollera om tidkortet tillhör någon av lärarens klasser
      final match = classId == 'ALL'
          ? (tsClassId != null && teacherClassIds.contains(tsClassId))
          : tsClassId == classId;

      // Kontrollera även godkännandestatus
      final isApproved = data['approved'] as bool? ?? false;
      final matchApprovalStatus = showApproved ? isApproved : !isApproved;

      if (match && matchApprovalStatus) {
        filtered.add(doc);
      }
    }

    return filtered;
  }
}

// ==================== BEDÖMNING FLIK ====================
class _AssessmentTab extends StatefulWidget {
  final String classId;
  const _AssessmentTab({required this.classId});

  @override
  State<_AssessmentTab> createState() => _AssessmentTabState();
}

class _AssessmentTabState extends State<_AssessmentTab> {
  @override
  Widget build(BuildContext context) {
    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance
          .collection('classes')
          .doc(widget.classId)
          .collection('students')
          .snapshots(),
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }

        final students = snap.data?.docs ?? [];

        if (students.isEmpty) {
          return Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.group, size: 64, color: Colors.grey.shade300),
                const SizedBox(height: 16),
                const Text(
                  'Inga elever i denna klass',
                  style: TextStyle(fontSize: 16, color: Colors.grey),
                ),
              ],
            ),
          );
        }

        return ListView.builder(
          padding: const EdgeInsets.all(12),
          itemCount: students.length,
          itemBuilder: (context, index) {
            final student = students[index];
            final studentUid = student.id;
            final displayName = student.data()['displayName'] ?? 'Okänd';

            return Card(
              margin: const EdgeInsets.only(bottom: 12),
              child: ListTile(
                title: Text(displayName),
                subtitle: const Text('Klicka för att göra bedömning'),
                trailing: const Icon(Icons.arrow_forward),
                onTap: () {
                  _showAssessmentDialog(context, studentUid, displayName);
                },
              ),
            );
          },
        );
      },
    );
  }

  void _showAssessmentDialog(
    BuildContext context,
    String studentUid,
    String displayName,
  ) {
    final assessmentController = TextEditingController();

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Bedömning - $displayName'),
        content: TextField(
          controller: assessmentController,
          maxLines: 5,
          decoration: const InputDecoration(
            labelText: 'Bedömning',
            border: OutlineInputBorder(),
            hintText: 'Skriv bedömningen här...',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Avbryt'),
          ),
          ElevatedButton(
            onPressed: () async {
              try {
                await FirebaseFirestore.instance
                    .collection('assessments')
                    .doc(studentUid)
                    .set({
                      'studentUid': studentUid,
                      'assessment': assessmentController.text,
                      'updatedAt': FieldValue.serverTimestamp(),
                    });

                if (context.mounted) {
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Bedömning sparad ✅')),
                  );
                }
              } catch (e) {
                if (context.mounted) {
                  ScaffoldMessenger.of(
                    context,
                  ).showSnackBar(SnackBar(content: Text('Fel: $e')));
                }
              }
            },
            child: const Text('Spara'),
          ),
        ],
      ),
    );
  }
}

// ==================== ERSÄTTNING FLIK ====================
class _CompensationTab extends StatefulWidget {
  final String classId;
  const _CompensationTab({required this.classId});

  @override
  State<_CompensationTab> createState() => _CompensationTabState();
}

class _CompensationTabState extends State<_CompensationTab> {
  @override
  Widget build(BuildContext context) {
    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance
          .collection('classes')
          .doc(widget.classId)
          .collection('students')
          .snapshots(),
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }

        final students = snap.data?.docs ?? [];

        if (students.isEmpty) {
          return Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.group, size: 64, color: Colors.grey.shade300),
                const SizedBox(height: 16),
                const Text(
                  'Inga elever i denna klass',
                  style: TextStyle(fontSize: 16, color: Colors.grey),
                ),
              ],
            ),
          );
        }

        return ListView.builder(
          padding: const EdgeInsets.all(12),
          itemCount: students.length,
          itemBuilder: (context, index) {
            final student = students[index];
            final studentUid = student.id;
            final displayName = student.data()['displayName'] ?? 'Okänd';

            return Card(
              margin: const EdgeInsets.only(bottom: 12),
              child: ListTile(
                title: Text(displayName),
                subtitle: const Text('Hantera ersättning'),
                trailing: const Icon(Icons.arrow_forward),
                onTap: () {
                  _showCompensationDialog(context, studentUid, displayName);
                },
              ),
            );
          },
        );
      },
    );
  }

  void _showCompensationDialog(
    BuildContext context,
    String studentUid,
    String displayName,
  ) {
    final lunchController = TextEditingController();
    final travelController = TextEditingController();

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Ersättning - $displayName'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: lunchController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Lunchersättning (kr)',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: travelController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Reseersättning (kr)',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Avbryt'),
          ),
          ElevatedButton(
            onPressed: () async {
              try {
                await FirebaseFirestore.instance
                    .collection('compensation')
                    .doc(studentUid)
                    .set({
                      'studentUid': studentUid,
                      'lunch': double.tryParse(lunchController.text) ?? 0,
                      'travel': double.tryParse(travelController.text) ?? 0,
                      'updatedAt': FieldValue.serverTimestamp(),
                    });

                if (context.mounted) {
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Ersättning sparad ✅')),
                  );
                }
              } catch (e) {
                if (context.mounted) {
                  ScaffoldMessenger.of(
                    context,
                  ).showSnackBar(SnackBar(content: Text('Fel: $e')));
                }
              }
            },
            child: const Text('Spara'),
          ),
        ],
      ),
    );
  }
}
