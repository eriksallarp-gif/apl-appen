import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class StudentDetailStatisticsScreen extends StatefulWidget {
  final String studentUid;
  final String studentName;
  final String classId;

  const StudentDetailStatisticsScreen({
    super.key,
    required this.studentUid,
    required this.studentName,
    required this.classId,
  });

  @override
  State<StudentDetailStatisticsScreen> createState() =>
      _StudentDetailStatisticsScreenState();
}

class _StudentDetailStatisticsScreenState
    extends State<StudentDetailStatisticsScreen> {
  bool _showActivityBreakdown = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.studentName)),
      body: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
        stream: FirebaseFirestore.instance
            .collection('timesheets')
            .where('studentUid', isEqualTo: widget.studentUid)
            .snapshots(),
        builder: (context, timesheetSnapshot) {
          if (timesheetSnapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          final timesheets = timesheetSnapshot.data?.docs ?? [];

          // Hämta även assessments för att få lunch/resor
          return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
            stream: FirebaseFirestore.instance
                .collection('assessmentRequests')
                .where('studentUid', isEqualTo: widget.studentUid)
                .where('status', isEqualTo: 'submitted')
                .snapshots(),
            builder: (context, assessmentSnapshot) {
              if (assessmentSnapshot.connectionState ==
                  ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              }

              final assessments = assessmentSnapshot.data?.docs ?? [];

              if (timesheets.isEmpty) {
                return Center(
                  child: Padding(
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(
                          Icons.analytics_outlined,
                          size: 64,
                          color: Colors.grey,
                        ),
                        const SizedBox(height: 16),
                        Text(
                          '${widget.studentName} har inte lämnat in några tidkort än',
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 16,
                            color: Colors.grey,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }

              // Beräkna statistik från både timesheets och assessments
              final stats = _calculateStats(timesheets, assessments);

              return SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Översiktskort
                    _buildOverviewCard(stats, assessments),
                    const SizedBox(height: 24),

                    if (_showActivityBreakdown) ...[
                      // Aktivitetsfördelning
                      const Text(
                        'Aktivitetsfördelning',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 16),
                      _buildActivityBreakdown(
                        stats['activityHours'] as Map<String, int>,
                      ),
                      const SizedBox(height: 24),
                    ],

                    // Alla tidkort
                    const Text(
                      'Alla tidkort',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 16),
                    _buildTimesheetList(context, timesheets),
                  ],
                ),
              );
            },
          );
        },
      ),
    );
  }

  Map<String, dynamic> _calculateStats(
    List<QueryDocumentSnapshot<Map<String, dynamic>>> timesheets,
    List<QueryDocumentSnapshot<Map<String, dynamic>>> assessments,
  ) {
    int totalHours = 0;
    int approvedCount = 0;
    int totalLunches = 0;
    int totalKilometers = 0;
    final Map<String, int> activityHours = {};

    int getWeekNumber(String weekStart) {
      try {
        final weekStartDate = DateTime.parse(weekStart);
        final jan4 = DateTime(weekStartDate.year, 1, 4);
        final monday = jan4.subtract(
          Duration(days: jan4.weekday - DateTime.monday),
        );
        return weekStartDate.difference(monday).inDays ~/ 7 + 1;
      } catch (e) {
        return 0;
      }
    }

    final Set<int> approvedWeeks = {};
    for (var doc in assessments) {
      final data = doc.data();
      final weeks = (data['weeks'] as List?)?.cast<String>() ?? [];
      for (final week in weeks) {
        final weekNum = int.tryParse(week.replaceAll(RegExp(r'[^0-9]'), ''));
        if (weekNum != null) {
          approvedWeeks.add(weekNum);
        }
      }
    }

    for (var doc in timesheets) {
      final data = doc.data();
      final weekStart = (data['weekStart'] ?? '').toString();
      final weekNumber = getWeekNumber(weekStart);
      final isApprovedBySupervisor =
          weekNumber > 0 && approvedWeeks.contains(weekNumber);

      if (!isApprovedBySupervisor) {
        continue;
      }

      final entries = (data['entries'] as Map?)?.cast<String, dynamic>() ?? {};

      int weekHours = 0;
      for (var entry in entries.entries) {
        final activity = entry.key;
        final days = entry.value as Map?;

        if (days != null) {
          int activityTotal = 0;
          for (var hours in days.values) {
            final h = (hours is int)
                ? hours
                : int.tryParse(hours.toString()) ?? 0;
            activityTotal += h;
            weekHours += h;
          }
          if (activityTotal > 0) {
            activityHours[activity] =
                (activityHours[activity] ?? 0) + activityTotal;
          }
        }
      }

      totalHours += weekHours;
      approvedCount++;
    }

    // Hämta luncher och kilometer från godkända assessments
    for (var doc in assessments) {
      final data = doc.data();
      final lunchApproved = data['lunchApproved'] as int? ?? 0;
      final travelApproved = data['travelApproved'] as int? ?? 0;

      totalLunches += lunchApproved;
      totalKilometers += travelApproved;
    }

    return {
      'totalHours': totalHours,
      'totalWeeks': timesheets.length,
      'approvedCount': approvedCount,
      'activityHours': activityHours,
      'totalLunches': totalLunches,
      'totalKilometers': totalKilometers,
      'assessmentCount': assessments.length,
      'averagePerWeek': timesheets.isEmpty
          ? 0
          : (totalHours / timesheets.length).round(),
    };
  }

  Widget _buildOverviewCard(
    Map<String, dynamic> stats,
    List<QueryDocumentSnapshot<Map<String, dynamic>>> assessments,
  ) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Sammanfattning',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const Divider(),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: _buildStatItem(
                    'Totalt timmar',
                    '${stats['totalHours']}h',
                    Icons.access_time,
                    Colors.orange,
                    onTap: () {
                      setState(() {
                        _showActivityBreakdown = !_showActivityBreakdown;
                      });
                    },
                    showChevron: true,
                  ),
                ),
                Expanded(
                  child: _buildStatItem(
                    'Inlämnade/Godkända',
                    '${stats['totalWeeks']} / ${stats['approvedCount']}',
                    Icons.calendar_today,
                    Colors.green,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _buildStatItem(
                    'Snitt per vecka',
                    '${stats['averagePerWeek']}h',
                    Icons.trending_up,
                    Colors.teal,
                  ),
                ),
                Expanded(
                  child: _buildStatItem(
                    'Bedömning',
                    '${stats['assessmentCount']} st',
                    Icons.assignment,
                    Colors.indigo,
                    onTap: () {
                      if (assessments.isEmpty) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Ingen bedömning inskickad ännu'),
                          ),
                        );
                        return;
                      }
                      _showAssessmentDetails(context, assessments);
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _buildStatItem(
                    'Antal luncher',
                    '${stats['totalLunches']}',
                    Icons.restaurant,
                    Colors.deepOrange,
                  ),
                ),
                Expanded(
                  child: _buildStatItem(
                    'Antal kilometer',
                    '${stats['totalKilometers']} km',
                    Icons.directions_car,
                    Colors.purple,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatItem(
    String label,
    String value,
    IconData icon,
    Color color, {
    VoidCallback? onTap,
    bool showChevron = false,
  }) {
    final content = Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: color, size: 24),
              if (showChevron) ...[
                const Spacer(),
                Icon(
                  _showActivityBreakdown
                      ? Icons.keyboard_arrow_up
                      : Icons.keyboard_arrow_down,
                  color: Colors.grey,
                ),
              ],
            ],
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
          Text(label, style: const TextStyle(fontSize: 12, color: Colors.grey)),
        ],
      ),
    );

    if (onTap == null) return content;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: content,
    );
  }

  void _showAssessmentDetails(
    BuildContext context,
    List<QueryDocumentSnapshot<Map<String, dynamic>>> assessments,
  ) {
    final sorted = assessments.toList()
      ..sort((a, b) {
        final aTime = (a.data()['submittedAt'] as Timestamp?)?.toDate();
        final bTime = (b.data()['submittedAt'] as Timestamp?)?.toDate();
        if (aTime == null || bTime == null) return 0;
        return bTime.compareTo(aTime);
      });

    showDialog(
      context: context,
      builder: (context) => Dialog(
        child: Container(
          constraints: const BoxConstraints(maxWidth: 700, maxHeight: 700),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.orange.shade700,
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(4),
                    topRight: Radius.circular(4),
                  ),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.assignment, color: Colors.white),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Text(
                        'Bedömningar - Välj vecka',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, color: Colors.white),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: sorted.length,
                  itemBuilder: (context, index) {
                    final doc = sorted[index];
                    final data = doc.data();
                    final weeks =
                        (data['weeks'] as List?)?.cast<String>() ?? [];
                    final submittedAt = (data['submittedAt'] as Timestamp?)
                        ?.toDate();
                    final supervisorName = (data['supervisorName'] ?? '')
                        .toString();
                    final averageRating = (data['averageRating'] ?? '0')
                        .toString();

                    return Card(
                      margin: const EdgeInsets.only(bottom: 12),
                      child: ListTile(
                        onTap: () {
                          Navigator.of(context).pop();
                          _showWeekAssessmentDetails(context, doc);
                        },
                        leading: Container(
                          width: 48,
                          height: 48,
                          decoration: BoxDecoration(
                            color: Colors.orange.shade100,
                            shape: BoxShape.circle,
                          ),
                          child: const Center(
                            child: Icon(Icons.assignment, color: Colors.orange),
                          ),
                        ),
                        title: Text(
                          weeks.join(', '),
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (supervisorName.isNotEmpty)
                              Text('Handledare: $supervisorName'),
                            if (submittedAt != null)
                              Text(
                                'Inskickad: ${submittedAt.day}/${submittedAt.month} ${submittedAt.year}',
                                style: const TextStyle(fontSize: 12),
                              ),
                          ],
                        ),
                        trailing: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(
                              Icons.star,
                              color: Colors.orange,
                              size: 20,
                            ),
                            Text(
                              '$averageRating/5',
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 14,
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showWeekAssessmentDetails(
    BuildContext context,
    QueryDocumentSnapshot<Map<String, dynamic>> assessment,
  ) async {
    final data = assessment.data();
    final weeks = (data['weeks'] as List?)?.cast<String>().join(', ') ?? '-';
    final timesheetIds = (data['timesheetIds'] as List?)?.cast<String>() ?? [];
    final self =
        (data['studentSelfAssessment'] as Map?)?.cast<String, dynamic>() ?? {};
    final assessmentData =
        (data['assessmentData'] as Map?)?.cast<String, dynamic>() ?? {};
    final averageRating = (data['averageRating'] ?? '0').toString();
    final supervisorName = (data['supervisorName'] ?? '').toString();
    final supervisorCompany = (data['supervisorCompany'] ?? '').toString();
    final lunchApproved = (data['lunchApproved'] ?? 0).toString();
    final travelApproved = (data['travelApproved'] ?? 0).toString();
    final images = (data['images'] as List?)?.cast<dynamic>() ?? [];
    final imageComments =
        (data['imageComments'] as Map?)?.cast<String, dynamic>() ?? {};

    // Hämta tidkort för dessa veckor
    final timesheetDocs = <Map<String, dynamic>>[];
    for (final id in timesheetIds) {
      try {
        final doc = await FirebaseFirestore.instance
            .collection('timesheets')
            .doc(id)
            .get();
        if (doc.exists) {
          timesheetDocs.add(doc.data()!);
        }
      } catch (e) {
        debugPrint('Kunde inte hämta tidkort $id: $e');
      }
    }

    if (!context.mounted) return;

    showDialog(
      context: context,
      builder: (context) => Dialog(
        child: Container(
          constraints: const BoxConstraints(maxWidth: 800, maxHeight: 800),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.orange.shade700,
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(4),
                    topRight: Radius.circular(4),
                  ),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.assignment, color: Colors.white),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Bedömning: $weeks',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          if (supervisorName.isNotEmpty)
                            Text(
                              supervisorCompany.isNotEmpty
                                  ? '$supervisorName, $supervisorCompany'
                                  : supervisorName,
                              style: const TextStyle(
                                color: Colors.white70,
                                fontSize: 14,
                              ),
                            ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, color: Colors.white),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Tidkort sektion
                      const Text(
                        'Tidkort',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 12),
                      if (timesheetDocs.isEmpty)
                        const Card(
                          child: Padding(
                            padding: EdgeInsets.all(16),
                            child: Text('Inga tidkort hittades'),
                          ),
                        )
                      else
                        ...timesheetDocs.map((timesheetData) {
                          final entries =
                              (timesheetData['entries'] as Map?)
                                  ?.cast<String, dynamic>() ??
                              {};
                          final weekStart = timesheetData['weekStart'] ?? '';
                          final comments =
                              (timesheetData['comments'] as Map?)
                                  ?.cast<String, dynamic>() ??
                              {};

                          int totalHours = 0;
                          for (var entry in entries.values) {
                            if (entry is Map) {
                              for (var hours in entry.values) {
                                totalHours += (hours is int)
                                    ? hours
                                    : int.tryParse(hours.toString()) ?? 0;
                              }
                            }
                          }

                          return Card(
                            margin: const EdgeInsets.only(bottom: 12),
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment:
                                        MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        'Vecka: $weekStart',
                                        style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 16,
                                        ),
                                      ),
                                      Text(
                                        'Totalt: ${totalHours}h',
                                        style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 16,
                                          color: Colors.orange,
                                        ),
                                      ),
                                    ],
                                  ),
                                  const Divider(),
                                  ...entries.entries.map((activityEntry) {
                                    final activity = activityEntry.key;
                                    final days =
                                        (activityEntry.value as Map?)
                                            ?.cast<String, dynamic>() ??
                                        {};

                                    int activityTotal = 0;
                                    for (var hours in days.values) {
                                      activityTotal += (hours is int)
                                          ? hours
                                          : int.tryParse(hours.toString()) ?? 0;
                                    }

                                    if (activityTotal == 0)
                                      return const SizedBox.shrink();

                                    final activityComment =
                                        comments[activity]?.toString() ?? '';

                                    return Padding(
                                      padding: const EdgeInsets.only(bottom: 8),
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            mainAxisAlignment:
                                                MainAxisAlignment.spaceBetween,
                                            children: [
                                              Expanded(
                                                child: Text(
                                                  activity,
                                                  style: const TextStyle(
                                                    fontWeight: FontWeight.w600,
                                                  ),
                                                ),
                                              ),
                                              Text('${activityTotal}h'),
                                            ],
                                          ),
                                          if (activityComment.isNotEmpty)
                                            Padding(
                                              padding: const EdgeInsets.only(
                                                left: 8,
                                                top: 4,
                                              ),
                                              child: Text(
                                                'Kommentar: $activityComment',
                                                style: TextStyle(
                                                  fontSize: 13,
                                                  color: Colors.grey.shade700,
                                                  fontStyle: FontStyle.italic,
                                                ),
                                              ),
                                            ),
                                        ],
                                      ),
                                    );
                                  }),
                                ],
                              ),
                            ),
                          );
                        }),

                      const SizedBox(height: 24),

                      // Ersättning
                      const Text(
                        'Ersättning',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  children: [
                                    const Icon(
                                      Icons.restaurant,
                                      color: Colors.deepOrange,
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      '$lunchApproved luncher',
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              Expanded(
                                child: Column(
                                  children: [
                                    const Icon(
                                      Icons.directions_car,
                                      color: Colors.purple,
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      '$travelApproved km',
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w600,
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

                      if (images.isNotEmpty) ...[
                        const Text(
                          'Bifogade bilder',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 12),
                        ...images.asMap().entries.map((entry) {
                          final index = entry.key;
                          final imageData = entry.value;
                          final imageUrl = imageData is Map
                              ? (imageData['url'] ?? '').toString()
                              : imageData.toString();
                          final comment =
                              imageComments[index.toString()]?.toString() ?? '';

                          if (imageUrl.isEmpty) {
                            return const SizedBox.shrink();
                          }

                          return Card(
                            margin: const EdgeInsets.only(bottom: 12),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                GestureDetector(
                                  onTap: () =>
                                      _showFullImage(context, imageUrl),
                                  child: ClipRRect(
                                    borderRadius: const BorderRadius.vertical(
                                      top: Radius.circular(12),
                                    ),
                                    child: Image.network(
                                      imageUrl,
                                      width: double.infinity,
                                      height: 220,
                                      fit: BoxFit.cover,
                                      loadingBuilder:
                                          (context, child, progress) {
                                            if (progress == null) return child;
                                            return const SizedBox(
                                              height: 220,
                                              child: Center(
                                                child:
                                                    CircularProgressIndicator(),
                                              ),
                                            );
                                          },
                                      errorBuilder:
                                          (context, error, stackTrace) {
                                            return const SizedBox(
                                              height: 220,
                                              child: Center(
                                                child: Icon(Icons.broken_image),
                                              ),
                                            );
                                          },
                                    ),
                                  ),
                                ),
                                Padding(
                                  padding: const EdgeInsets.all(12),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        'Bild ${index + 1}',
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                      if (comment.isNotEmpty) ...[
                                        const SizedBox(height: 6),
                                        Text(
                                          'Handledarens kommentar: $comment',
                                          style: TextStyle(
                                            color: Colors.grey.shade700,
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          );
                        }),
                        const SizedBox(height: 24),
                      ],

                      // Elevens självskattning
                      const Text(
                        'Elevens självskattning',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _buildSelfAssessmentRow(
                                '1. Vad har du fått göra?',
                                self['whatDidYouDo']?.toString() ?? '',
                              ),
                              _buildSelfAssessmentRow(
                                '2. Vad har varit positivt med APLen?',
                                self['whatWasPositive']?.toString() ?? '',
                              ),
                              _buildSelfAssessmentRow(
                                '3. Vad skulle kunnat vara bättre?',
                                self['whatCouldBeBetter']?.toString() ?? '',
                              ),
                              _buildSelfAssessmentRow(
                                '4. Vad kunde du som elev gjort annorlunda?',
                                self['whatCouldYouDoDifferently']?.toString() ??
                                    '',
                              ),
                              _buildSelfAssessmentRow(
                                '5. Betyg (1-10)',
                                self['overallRating']?.toString() ?? '',
                              ),
                              if (self.values.every(
                                (v) => v == null || v.toString().trim().isEmpty,
                              ))
                                const Text('Ingen självskattning ifylld'),
                            ],
                          ),
                        ),
                      ),

                      const SizedBox(height: 24),

                      // Handledarens bedömning
                      const Text(
                        'Handledarens bedömning',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (assessmentData.isEmpty)
                                const Text('Ingen bedömning tillgänglig')
                              else ...[
                                ...assessmentData.entries.map((entry) {
                                  final key = entry.key.toString();
                                  final value = entry.value;
                                  if (value is Map) {
                                    final rating =
                                        value['rating']?.toString() ?? '-';
                                    final comment =
                                        value['comment']?.toString() ?? '';
                                    return Padding(
                                      padding: const EdgeInsets.only(
                                        bottom: 12,
                                      ),
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            '$key: $rating/5',
                                            style: const TextStyle(
                                              fontWeight: FontWeight.w600,
                                              fontSize: 15,
                                            ),
                                          ),
                                          if (comment.isNotEmpty)
                                            Padding(
                                              padding: const EdgeInsets.only(
                                                top: 4,
                                              ),
                                              child: Text(
                                                comment,
                                                style: TextStyle(
                                                  color: Colors.grey.shade700,
                                                ),
                                              ),
                                            ),
                                        ],
                                      ),
                                    );
                                  }
                                  if (key == 'Övrigt') {
                                    return Padding(
                                      padding: const EdgeInsets.only(
                                        bottom: 12,
                                      ),
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          const Text(
                                            'Övrigt',
                                            style: TextStyle(
                                              fontWeight: FontWeight.w600,
                                              fontSize: 15,
                                            ),
                                          ),
                                          Padding(
                                            padding: const EdgeInsets.only(
                                              top: 4,
                                            ),
                                            child: Text(value.toString()),
                                          ),
                                        ],
                                      ),
                                    );
                                  }
                                  return const SizedBox.shrink();
                                }),
                                if (averageRating != '0') ...[
                                  const Divider(),
                                  const SizedBox(height: 8),
                                  Row(
                                    children: [
                                      const Icon(
                                        Icons.star,
                                        color: Colors.orange,
                                      ),
                                      const SizedBox(width: 8),
                                      Text(
                                        'Snittbetyg: $averageRating/5',
                                        style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 16,
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ],
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSelfAssessmentRow(String label, String value) {
    if (value.trim().isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Text(value),
        ],
      ),
    );
  }

  Widget _buildActivityBreakdown(Map<String, int> activityHours) {
    if (activityHours.isEmpty) {
      return const Text('Ingen aktivitetsdata');
    }

    final sortedActivities = activityHours.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    return Column(
      children: sortedActivities.take(10).map((entry) {
        final total = activityHours.values.reduce((a, b) => a + b);
        final percentage = (entry.value / total * 100).round();

        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      entry.key,
                      style: const TextStyle(fontSize: 14),
                    ),
                  ),
                  Text(
                    '${entry.value}h ($percentage%)',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              LinearProgressIndicator(
                value: entry.value / total,
                backgroundColor: Colors.grey.shade200,
                valueColor: const AlwaysStoppedAnimation(Colors.orange),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  void _showTimesheetDetails(
    BuildContext context,
    Map<String, dynamic> data,
    String weekDisplay,
  ) {
    final entries = (data['entries'] as Map?)?.cast<String, dynamic>() ?? {};
    final approved = data['approved'] ?? false;

    showDialog(
      context: context,
      builder: (context) => Dialog(
        child: Container(
          constraints: const BoxConstraints(maxWidth: 600, maxHeight: 700),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Header
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: approved ? Colors.green : Colors.orange,
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(4),
                    topRight: Radius.circular(4),
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      approved ? Icons.check_circle : Icons.pending,
                      color: Colors.white,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            weekDisplay,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Text(
                            approved ? 'Godkänd' : 'Väntar på godkännande',
                            style: const TextStyle(
                              color: Colors.white70,
                              fontSize: 14,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, color: Colors.white),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
              ),
              // Content
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (entries.isEmpty)
                        const Center(
                          child: Padding(
                            padding: EdgeInsets.all(32),
                            child: Text('Inga aktiviteter registrerade'),
                          ),
                        )
                      else
                        ...entries.entries.map((activityEntry) {
                          final activity = activityEntry.key;
                          final days =
                              (activityEntry.value as Map?)
                                  ?.cast<String, dynamic>() ??
                              {};

                          int activityTotal = 0;
                          for (var hours in days.values) {
                            activityTotal += (hours is int)
                                ? hours
                                : int.tryParse(hours.toString()) ?? 0;
                          }

                          // Visa bara aktiviteter med tid registrerad
                          if (activityTotal == 0) {
                            return const SizedBox.shrink();
                          }

                          return Card(
                            margin: const EdgeInsets.only(bottom: 12),
                            child: Padding(
                              padding: const EdgeInsets.all(12),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment:
                                        MainAxisAlignment.spaceBetween,
                                    children: [
                                      Expanded(
                                        child: Text(
                                          activity,
                                          style: const TextStyle(
                                            fontWeight: FontWeight.bold,
                                            fontSize: 16,
                                          ),
                                        ),
                                      ),
                                      Text(
                                        '${activityTotal}h',
                                        style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 16,
                                          color: Colors.orange,
                                        ),
                                      ),
                                    ],
                                  ),
                                  const Divider(),
                                  ...() {
                                    // Sortera dagar i rätt ordning: mån-fre
                                    const dayOrder = [
                                      'mon',
                                      'tue',
                                      'wed',
                                      'thu',
                                      'fri',
                                      'sat',
                                      'sun',
                                    ];
                                    final sortedDays = days.entries.toList()
                                      ..sort((a, b) {
                                        final aIndex = dayOrder.indexOf(
                                          a.key.toLowerCase(),
                                        );
                                        final bIndex = dayOrder.indexOf(
                                          b.key.toLowerCase(),
                                        );
                                        return aIndex.compareTo(bIndex);
                                      });

                                    return sortedDays.map((dayEntry) {
                                      final day = dayEntry.key;
                                      final hours = (dayEntry.value is int)
                                          ? dayEntry.value
                                          : int.tryParse(
                                                  dayEntry.value.toString(),
                                                ) ??
                                                0;

                                      if (hours == 0) {
                                        return const SizedBox.shrink();
                                      }

                                      return Padding(
                                        padding: const EdgeInsets.symmetric(
                                          vertical: 4,
                                        ),
                                        child: Row(
                                          mainAxisAlignment:
                                              MainAxisAlignment.spaceBetween,
                                          children: [
                                            Text(
                                              _getDayName(day),
                                              style: const TextStyle(
                                                fontSize: 14,
                                              ),
                                            ),
                                            Text(
                                              '${hours}h',
                                              style: const TextStyle(
                                                fontSize: 14,
                                                fontWeight: FontWeight.w500,
                                              ),
                                            ),
                                          ],
                                        ),
                                      );
                                    }).toList();
                                  }(),
                                ],
                              ),
                            ),
                          );
                        }),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _getDayName(String day) {
    switch (day.toLowerCase()) {
      case 'mon':
        return 'Måndag';
      case 'tue':
        return 'Tisdag';
      case 'wed':
        return 'Onsdag';
      case 'thu':
        return 'Torsdag';
      case 'fri':
        return 'Fredag';
      case 'sat':
        return 'Lördag';
      case 'sun':
        return 'Söndag';
      default:
        return day;
    }
  }

  Widget _buildTimesheetList(
    BuildContext context,
    List<QueryDocumentSnapshot<Map<String, dynamic>>> timesheets,
  ) {
    final sortedTimesheets = timesheets.toList()
      ..sort((a, b) {
        final aWeek = a.data()['weekStart'] ?? '';
        final bWeek = b.data()['weekStart'] ?? '';
        return bWeek.compareTo(aWeek); // Nyast först
      });

    return Column(
      children: sortedTimesheets.map((doc) {
        final data = doc.data();
        final weekStart = data['weekStart'] ?? '';
        final approved = data['approved'] ?? false;
        final entries =
            (data['entries'] as Map?)?.cast<String, dynamic>() ?? {};

        int totalHours = 0;
        for (var entry in entries.values) {
          if (entry is Map) {
            for (var hours in entry.values) {
              totalHours += (hours is int)
                  ? hours
                  : int.tryParse(hours.toString()) ?? 0;
            }
          }
        }

        // Formatera veckonummer
        String weekDisplay = 'Vecka $weekStart';
        try {
          final weekStartDate = DateTime.parse(weekStart);
          final jan4 = DateTime(weekStartDate.year, 1, 4);
          final monday = jan4.subtract(
            Duration(days: jan4.weekday - DateTime.monday),
          );
          final weekNum = weekStartDate.difference(monday).inDays ~/ 7 + 1;
          weekDisplay = 'V. $weekNum';
        } catch (e) {
          // Använd standard om parsing misslyckas
        }

        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          child: ListTile(
            onTap: () => _showTimesheetDetails(context, data, weekDisplay),
            leading: Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: approved
                    ? Colors.green.shade100
                    : Colors.orange.shade100,
                shape: BoxShape.circle,
              ),
              child: Center(
                child: Icon(
                  approved ? Icons.check_circle : Icons.pending,
                  color: approved ? Colors.green : Colors.orange,
                ),
              ),
            ),
            title: Text(weekDisplay),
            subtitle: Text(
              approved ? 'Godkänd' : 'Väntar på godkännande',
              style: TextStyle(color: approved ? Colors.green : Colors.orange),
            ),
            trailing: Text(
              '${totalHours}h',
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
          ),
        );
      }).toList(),
    );
  }

  void _showFullImage(BuildContext context, String imageUrl) {
    showDialog(
      context: context,
      builder: (context) => Dialog(
        backgroundColor: Colors.black,
        child: Stack(
          children: [
            Center(
              child: InteractiveViewer(
                child: Image.network(imageUrl, fit: BoxFit.contain),
              ),
            ),
            Positioned(
              top: 10,
              right: 10,
              child: IconButton(
                icon: const Icon(Icons.close, color: Colors.white, size: 32),
                onPressed: () => Navigator.pop(context),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
