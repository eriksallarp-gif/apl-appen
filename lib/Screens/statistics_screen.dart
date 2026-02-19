import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:fl_chart/fl_chart.dart';
import 'dart:io';
import 'package:csv/csv.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'student_detail_statistics_screen.dart';

class StatisticsScreen extends StatefulWidget {
  const StatisticsScreen({super.key});

  @override
  State<StatisticsScreen> createState() => _StatisticsScreenState();
}

class _StatisticsScreenState extends State<StatisticsScreen> {
  String? _selectedClassId;

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
                  builder: (context, snapshot) {
                    if (snapshot.connectionState == ConnectionState.waiting) {
                      return const Center(child: CircularProgressIndicator());
                    }

                    final classes = snapshot.data?.docs ?? [];
                    if (classes.isEmpty) {
                      return const Text('Inga klasser hittades');
                    }

                    return DropdownButtonFormField<String>(
                      initialValue: _selectedClassId,
                      decoration: InputDecoration(
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 8,
                        ),
                      ),
                      hint: const Text('Välj en klass'),
                      items: classes.map((doc) {
                        final data = doc.data();
                        return DropdownMenuItem(
                          value: doc.id,
                          child: Text(data['name'] ?? doc.id),
                        );
                      }).toList(),
                      onChanged: (value) {
                        setState(() {
                          _selectedClassId = value;
                        });
                      },
                    );
                  },
                ),
              ],
            ),
          ),
          const Divider(),
          // Statistik innehåll
          Expanded(
            child: _selectedClassId == null
                ? const Center(
                    child: Text(
                      'Välj en klass för att se statistik',
                      style: TextStyle(fontSize: 16, color: Colors.grey),
                    ),
                  )
                : _StatisticsContent(
                    classId: _selectedClassId!,
                    onExport: _exportToCSV,
                  ),
          ),
        ],
      ),
    );
  }

  Future<void> _exportToCSV() async {
    if (_selectedClassId == null) return;

    try {
      // Hämta alla tidkort
      final allTimesheets = await FirebaseFirestore.instance
          .collection('timesheets')
          .get();

      // Filtrera för denna klass (inklusive att hämta classId från student-profil om det saknas)
      final timesheetDocs = <QueryDocumentSnapshot<Map<String, dynamic>>>[];
      
      for (var doc in allTimesheets.docs) {
        final data = doc.data();
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
        
        if (tsClassId == _selectedClassId) {
          timesheetDocs.add(doc);
        }
      }

      // Skapa CSV-data
      List<List<dynamic>> rows = [
        ['Student', 'Vecka', 'Aktivitet', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Totalt', 'Godkänd']
      ];

      for (var doc in timesheetDocs) {
        final data = doc.data();
        final studentUid = data['studentUid'] ?? '';
        final weekStart = data['weekStart'] ?? '';
        final approved = data['approved'] ?? false;
        final entries = (data['entries'] as Map?)?.cast<String, dynamic>() ?? {};

        // Hämta studentnamn
        String studentName = 'Okänd';
        try {
          final userDoc = await FirebaseFirestore.instance
              .collection('users')
              .doc(studentUid)
              .get();
          studentName = userDoc.data()?['displayName'] ?? 'Okänd';
        } catch (e) {
          // Ignorera
        }

        // Lägg till varje aktivitet som en rad
        for (var activityEntry in entries.entries) {
          final activity = activityEntry.key;
          final days = activityEntry.value as Map?;
          
          if (days != null) {
            final mon = days['mon']?.toString() ?? '0';
            final tue = days['tue']?.toString() ?? '0';
            final wed = days['wed']?.toString() ?? '0';
            final thu = days['thu']?.toString() ?? '0';
            final fri = days['fri']?.toString() ?? '0';
            
            final total = (int.tryParse(mon) ?? 0) +
                         (int.tryParse(tue) ?? 0) +
                         (int.tryParse(wed) ?? 0) +
                         (int.tryParse(thu) ?? 0) +
                         (int.tryParse(fri) ?? 0);

            if (total > 0) {
              rows.add([
                studentName,
                weekStart,
                activity,
                mon,
                tue,
                wed,
                thu,
                fri,
                total,
                approved ? 'Ja' : 'Nej',
              ]);
            }
          }
        }
      }

      // Konvertera till CSV
      String csv = const ListToCsvConverter().convert(rows);

      // Spara till temporär fil
      final directory = await getTemporaryDirectory();
      final path = '${directory.path}/tidkort_export_${DateTime.now().millisecondsSinceEpoch}.csv';
      final file = File(path);
      await file.writeAsString(csv);

      // Dela filen
      await Share.shareXFiles(
        [XFile(path)],
        subject: 'Tidkort Export',
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('CSV-export klar!')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Export misslyckades: $e')),
        );
      }
    }
  }
}

class _StatisticsContent extends StatefulWidget {
  final String classId;
  final VoidCallback onExport;

  const _StatisticsContent({
    required this.classId,
    required this.onExport,
  });

  @override
  State<_StatisticsContent> createState() => _StatisticsContentState();
}

class _StatisticsContentState extends State<_StatisticsContent> {
  bool _showActivityBreakdown = false;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance
          .collection('timesheets')
          .snapshots(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }

        final allTimesheets = snapshot.data?.docs ?? [];

        // Filtrera tidkort för denna klass
        return FutureBuilder<List<DocumentSnapshot<Map<String, dynamic>>>>(
          future: _filterTimesheetsByClass(allTimesheets, widget.classId),
          builder: (context, filteredSnapshot) {
            if (filteredSnapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }

            final timesheets = filteredSnapshot.data ?? [];

            // Debug: visa antal hittade tidkort
            if (timesheets.isEmpty) {
              return Center(
                child: Padding(
                  padding: const EdgeInsets.all(32),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(
                        Icons.insights_outlined,
                        size: 64,
                        color: Colors.grey,
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        'Ingen data tillgänglig',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Det finns inga inlämnade tidkort för denna klass än.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Colors.grey),
                      ),
                    ],
                  ),
                ),
              );
            }

            final studentUids = timesheets
                .map((doc) => doc.data()?['studentUid']?.toString() ?? '')
                .where((uid) => uid.isNotEmpty)
                .toSet();

            return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
              stream: FirebaseFirestore.instance
                  .collection('assessmentRequests')
                  .where('status', isEqualTo: 'submitted')
                  .snapshots(),
              builder: (context, assessmentSnapshot) {
                final allAssessments = assessmentSnapshot.data?.docs ?? [];
                final assessments = allAssessments.where((doc) {
                  final studentUid =
                      doc.data()['studentUid']?.toString() ?? '';
                  return studentUids.contains(studentUid);
                }).toList();

                // Beräkna statistik
                final stats = _calculateStatistics(timesheets, assessments);

                return SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Översikt-kort
                      _buildOverviewCard(stats),
                      const SizedBox(height: 16),

                      if (_showActivityBreakdown) ...[
                        const Text(
                          'Aktivitetsfördelning',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 12),
                        _buildActivityBreakdown(
                          (stats['activityHours'] as Map<String, int>?) ??
                              {},
                        ),
                        const SizedBox(height: 16),
                      ],

                      // Export-knapp
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          onPressed: widget.onExport,
                          icon: const Icon(Icons.download),
                          label: const Text('Exportera till CSV'),
                          style: ElevatedButton.styleFrom(
                            padding: const EdgeInsets.all(16),
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Elevlista
                      const Text(
                        'Elever i klassen',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 16),
                      _buildStudentList(
                        context,
                        widget.classId,
                        timesheets,
                        stats,
                      ),
                    ],
                  ),
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
  Future<List<DocumentSnapshot<Map<String, dynamic>>>> _filterTimesheetsByClass(
    List<DocumentSnapshot<Map<String, dynamic>>> timesheets,
    String classId,
  ) async {
    final filtered = <DocumentSnapshot<Map<String, dynamic>>>[];
    
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
      
      if (tsClassId == classId) {
        filtered.add(doc);
      }
    }
    
    return filtered;
  }

  Map<String, dynamic> _calculateStatistics(
    List<DocumentSnapshot<Map<String, dynamic>>> timesheets,
    List<DocumentSnapshot<Map<String, dynamic>>> assessments,
  ) {
    final Map<String, int> studentHours = {};
    final Map<String, String> studentNames = {};
    final Map<String, int> weeklyHours = {};
    final Map<String, int> activityHours = {};
    int totalHours = 0;
    int approvedCount = 0;
    int totalLunches = 0;
    int totalKilometers = 0;

    for (var doc in timesheets) {
      final data = doc.data();
      if (data == null) continue;
      
      final studentUid = data['studentUid'] ?? '';
      final weekStart = data['weekStart'] ?? '';
      final approved = data['approved'] ?? false;
      final entries = (data['entries'] as Map?)?.cast<String, dynamic>() ?? {};

      int docHours = 0;
      for (var entry in entries.entries) {
        final activity = entry.key;
        final days = entry.value;
        if (days is Map) {
          int activityTotal = 0;
          for (var hours in days.values) {
            final h = (hours is int)
                ? hours
                : int.tryParse(hours.toString()) ?? 0;
            docHours += h;
            activityTotal += h;
          }
          if (activityTotal > 0) {
            activityHours[activity] =
                (activityHours[activity] ?? 0) + activityTotal;
          }
        }
      }

      totalHours += docHours;
      studentHours[studentUid] = (studentHours[studentUid] ?? 0) + docHours;
      weeklyHours[weekStart] = (weeklyHours[weekStart] ?? 0) + docHours;

      if (approved) approvedCount++;
    }

    for (var doc in assessments) {
      final data = doc.data();
      totalLunches += (data?['lunchApproved'] as int? ?? 0);
      totalKilometers += (data?['travelApproved'] as int? ?? 0);
    }

    return {
      'studentHours': studentHours,
      'studentNames': studentNames,
      'weeklyHours': weeklyHours,
      'activityHours': activityHours,
      'totalHours': totalHours,
      'totalTimesheets': timesheets.length,
      'approvedCount': approvedCount,
      'studentCount': studentHours.length,
      'totalLunches': totalLunches,
      'totalKilometers': totalKilometers,
    };
  }

  Widget _buildOverviewCard(Map<String, dynamic> stats) {
    final studentCount = stats['studentCount'] as int? ?? 0;
    final totalHours = stats['totalHours'] as int? ?? 0;
    final totalTimesheets = stats['totalTimesheets'] as int? ?? 0;
    final approvedCount = stats['approvedCount'] as int? ?? 0;
    final totalLunches = stats['totalLunches'] as int? ?? 0;
    final totalKilometers = stats['totalKilometers'] as int? ?? 0;
    final averagePerStudent = studentCount > 0
        ? (totalHours / studentCount).round()
        : 0;

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
                    '${totalHours}h',
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
                    '$totalTimesheets / $approvedCount',
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
                    'Snitt per elev',
                    '${averagePerStudent}h',
                    Icons.trending_up,
                    Colors.teal,
                  ),
                ),
                Expanded(
                  child: _buildStatItem(
                    'Elever',
                    '$studentCount st',
                    Icons.people,
                    Colors.indigo,
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
                    '$totalLunches',
                    Icons.restaurant,
                    Colors.deepOrange,
                  ),
                ),
                Expanded(
                  child: _buildStatItem(
                    'Antal kilometer',
                    '$totalKilometers km',
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

  Widget _buildActivityBreakdown(Map<String, int> activityHours) {
    if (activityHours.isEmpty) {
      return const Text('Ingen aktivitetsdata');
    }

    final sortedActivities = activityHours.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    final total = activityHours.values.reduce((a, b) => a + b);

    return Column(
      children: sortedActivities.take(10).map((entry) {
        final percentage = total > 0
            ? (entry.value / total * 100).toStringAsFixed(1)
            : '0.0';

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
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: Colors.orange.shade700,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              LinearProgressIndicator(
                value: total > 0 ? entry.value / total : 0,
                backgroundColor: Colors.grey.shade200,
                valueColor: AlwaysStoppedAnimation<Color>(
                  Colors.orange.shade400,
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  Widget _buildStatRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 14)),
          Text(
            value,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  // ignore: unused_element
  Widget _buildStudentHoursChart(Map<String, int> studentHours) {
    if (studentHours.isEmpty) {
      return const Center(
        child: Text('Ingen data tillgänglig'),
      );
    }

    final sortedEntries = studentHours.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    return BarChart(
      BarChartData(
        alignment: BarChartAlignment.spaceAround,
        maxY: (sortedEntries.first.value * 1.2).ceilToDouble(),
        barTouchData: BarTouchData(
          enabled: true,
          touchTooltipData: BarTouchTooltipData(
            getTooltipItem: (group, groupIndex, rod, rodIndex) {
              return BarTooltipItem(
                '${rod.toY.toInt()} h',
                const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                ),
              );
            },
          ),
        ),
        titlesData: FlTitlesData(
          show: true,
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              getTitlesWidget: (value, meta) {
                if (value.toInt() >= sortedEntries.length) {
                  return const Text('');
                }
                return Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    'Elev ${value.toInt() + 1}',
                    style: const TextStyle(fontSize: 10),
                  ),
                );
              },
            ),
          ),
          leftTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 40,
              getTitlesWidget: (value, meta) {
                return Text(
                  '${value.toInt()}h',
                  style: const TextStyle(fontSize: 10),
                );
              },
            ),
          ),
          topTitles: const AxisTitles(
            sideTitles: SideTitles(showTitles: false),
          ),
          rightTitles: const AxisTitles(
            sideTitles: SideTitles(showTitles: false),
          ),
        ),
        gridData: FlGridData(
          show: true,
          drawVerticalLine: false,
        ),
        borderData: FlBorderData(show: false),
        barGroups: List.generate(
          sortedEntries.length,
          (index) => BarChartGroupData(
            x: index,
            barRods: [
              BarChartRodData(
                toY: sortedEntries[index].value.toDouble(),
                color: Colors.orange,
                width: 20,
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(4),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ignore: unused_element
  Widget _buildWeeklyHoursChart(Map<String, int> weeklyHours) {
    if (weeklyHours.isEmpty) {
      return const Center(
        child: Text('Ingen data tillgänglig'),
      );
    }

    final sortedEntries = weeklyHours.entries.toList()
      ..sort((a, b) => a.key.compareTo(b.key));

    final spots = List.generate(
      sortedEntries.length,
      (index) => FlSpot(
        index.toDouble(),
        sortedEntries[index].value.toDouble(),
      ),
    );

    return LineChart(
      LineChartData(
        gridData: FlGridData(
          show: true,
          drawVerticalLine: false,
        ),
        titlesData: FlTitlesData(
          show: true,
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 30,
              getTitlesWidget: (value, meta) {
                if (value.toInt() >= sortedEntries.length) {
                  return const Text('');
                }
                final weekStart = sortedEntries[value.toInt()].key;
                // Visa bara MM-DD
                final parts = weekStart.split('-');
                if (parts.length == 3) {
                  return Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(
                      '${parts[1]}-${parts[2]}',
                      style: const TextStyle(fontSize: 10),
                    ),
                  );
                }
                return const Text('');
              },
            ),
          ),
          leftTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 40,
              getTitlesWidget: (value, meta) {
                return Text(
                  '${value.toInt()}h',
                  style: const TextStyle(fontSize: 10),
                );
              },
            ),
          ),
          topTitles: const AxisTitles(
            sideTitles: SideTitles(showTitles: false),
          ),
          rightTitles: const AxisTitles(
            sideTitles: SideTitles(showTitles: false),
          ),
        ),
        borderData: FlBorderData(show: false),
        minX: 0,
        maxX: (sortedEntries.length - 1).toDouble(),
        minY: 0,
        maxY: (sortedEntries.map((e) => e.value).reduce((a, b) => a > b ? a : b) * 1.2).ceilToDouble(),
        lineBarsData: [
          LineChartBarData(
            spots: spots,
            isCurved: true,
            color: Colors.orange,
            barWidth: 3,
            isStrokeCapRound: true,
            dotData: const FlDotData(show: true),
            belowBarData: BarAreaData(
              show: true,
              color: Colors.orange.withOpacity(0.1),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStudentList(
    BuildContext context,
    String classId,
    List<DocumentSnapshot<Map<String, dynamic>>> timesheets,
    Map<String, dynamic> stats,
  ) {
    final studentHours = stats['studentHours'] as Map<String, int>;
    
    // Gruppera tidkort per student
    final Map<String, List<DocumentSnapshot<Map<String, dynamic>>>> studentTimesheets = {};
    for (var timesheet in timesheets) {
      final studentUid = timesheet.data()?['studentUid'] as String? ?? '';
      if (studentUid.isNotEmpty) {
        studentTimesheets.putIfAbsent(studentUid, () => []).add(timesheet);
      }
    }

    final sortedStudents = studentHours.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    return Column(
      children: sortedStudents.map((entry) {
        final studentUid = entry.key;
        final totalHours = entry.value;
        final studentDocs = studentTimesheets[studentUid] ?? [];
        final timesheetCount = studentDocs.length;
        final approvedCount = studentDocs.where((doc) => doc.data()?['approved'] == true).length;

        return FutureBuilder<DocumentSnapshot<Map<String, dynamic>>>(
          future: FirebaseFirestore.instance.collection('users').doc(studentUid).get(),
          builder: (context, userSnapshot) {
            final userName = userSnapshot.data?.data()?['displayName'] ?? 'Okänd student';

            return Card(
              margin: const EdgeInsets.only(bottom: 8),
              child: InkWell(
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (context) => StudentDetailStatisticsScreen(
                        studentUid: studentUid,
                        studentName: userName,
                        classId: classId,
                      ),
                    ),
                  );
                },
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          userName,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      const Icon(Icons.chevron_right, color: Colors.grey),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      }).toList(),
    );
  }
}
