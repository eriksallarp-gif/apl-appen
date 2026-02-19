import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class ErsattningScreen extends StatefulWidget {
  const ErsattningScreen({super.key});

  @override
  State<ErsattningScreen> createState() => _ErsattningScreenState();
}

class _ErsattningScreenState extends State<ErsattningScreen> {
  bool _showActivityBreakdown = false;

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser!;

    return Scaffold(
      appBar: AppBar(title: const Text('Statistik'), elevation: 0),
      body: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
        stream: FirebaseFirestore.instance
            .collection('timesheets')
            .where('studentUid', isEqualTo: user.uid)
            .snapshots(),
        builder: (context, timesheetSnapshot) {
          if (timesheetSnapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          final timesheets = timesheetSnapshot.data?.docs ?? [];

          return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
            stream: FirebaseFirestore.instance
                .collection('assessmentRequests')
                .where('studentUid', isEqualTo: user.uid)
                .where('status', isEqualTo: 'submitted')
                .snapshots(),
            builder: (context, assessmentSnapshot) {
              final assessments = assessmentSnapshot.data?.docs ?? [];

              // Hämta godkända veckonummer från assessments
              final Set<int> approvedWeeks = {};
              for (final doc in assessments) {
                final data = doc.data();
                final weeks = (data['weeks'] as List?)?.cast<String>() ?? [];
                for (final week in weeks) {
                  // Extrahera veckonummer från format "V. 5"
                  final weekNum = int.tryParse(
                    week.replaceAll(RegExp(r'[^0-9]'), ''),
                  );
                  if (weekNum != null) {
                    approvedWeeks.add(weekNum);
                  }
                }
              }

              // Hjälpfunktion för att beräkna veckonummer från weekStart
              int getWeekNumber(String weekStart) {
                try {
                  final parts = weekStart.split('-');
                  if (parts.length == 3) {
                    final year = int.parse(parts[0]);
                    final month = int.parse(parts[1]);
                    final day = int.parse(parts[2]);
                    final startDate = DateTime(year, month, day);
                    final jan4 = DateTime(startDate.year, 1, 4);
                    final monday = jan4.subtract(
                      Duration(days: jan4.weekday - DateTime.monday),
                    );
                    return startDate.difference(monday).inDays ~/ 7 + 1;
                  }
                } catch (e) {
                  return 0;
                }
                return 0;
              }

              // Beräkna totalt antal timmar från GODKÄNDA tidkort
              // (godkända av lärare ELLER med godkänd handledarbedömning)
              int totalHours = 0;
              final Map<String, int> activityHours = {};

              for (final doc in timesheets) {
                final data = doc.data();
                final weekStart = (data['weekStart'] ?? '').toString();
                final approved = (data['approved'] ?? false) as bool;
                
                // Beräkna veckonummer från weekStart
                final weekNumber = getWeekNumber(weekStart);

                // Endast godkända tidkort: antingen lärare godkänt ELLER handledare bedömt veckan
                final isApproved = approved || (weekNumber > 0 && approvedWeeks.contains(weekNumber));
                
                if (!isApproved) {
                  continue;
                }

                final entries =
                    (data['entries'] as Map<String, dynamic>?) ?? {};

                for (var entry in entries.entries) {
                  final activity = entry.key;
                  if (entry.value is Map<String, dynamic>) {
                    for (var hours
                        in (entry.value as Map<String, dynamic>).values) {
                      final hourValue = (hours as num?)?.toInt() ?? 0;
                      totalHours += hourValue;
                      activityHours[activity] =
                          (activityHours[activity] ?? 0) + hourValue;
                    }
                  }
                }
              }

              // Beräkna total ersättning
              int totalLunch = 0;
              int totalTravel = 0;
              for (final doc in assessments) {
                final data = doc.data();
                totalLunch += (data['lunchApproved'] as int? ?? 0);
                totalTravel += (data['travelApproved'] as int? ?? 0);
              }

              return SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Total APL-tid
                    Card(
                      child: InkWell(
                        onTap: () {
                          setState(() {
                            _showActivityBreakdown = !_showActivityBreakdown;
                          });
                        },
                        borderRadius: BorderRadius.circular(12),
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Icon(
                                    Icons.access_time,
                                    color: Colors.orange.shade700,
                                  ),
                                  const SizedBox(width: 8),
                                  const Expanded(
                                    child: Text(
                                      'Total APL-tid',
                                      style: TextStyle(
                                        fontSize: 18,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                  Icon(
                                    _showActivityBreakdown
                                        ? Icons.keyboard_arrow_up
                                        : Icons.keyboard_arrow_down,
                                    color: Colors.grey,
                                  ),
                                ],
                              ),
                              const SizedBox(height: 16),
                              Text(
                                '$totalHours timmar',
                                style: TextStyle(
                                  fontSize: 32,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.orange.shade700,
                                ),
                              ),
                              if (_showActivityBreakdown) ...[
                                const SizedBox(height: 24),
                                if (activityHours.isNotEmpty) ...[
                                  const Text(
                                    'Arbetsmoment',
                                    style: TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  const SizedBox(height: 12),
                                  ...activityHours.entries.map((entry) {
                                    final percentage = totalHours > 0
                                        ? (entry.value / totalHours * 100)
                                              .toStringAsFixed(1)
                                        : '0.0';
                                    return Padding(
                                      padding: const EdgeInsets.only(
                                        bottom: 12,
                                      ),
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
                                                  entry.key,
                                                  style: const TextStyle(
                                                    fontSize: 14,
                                                  ),
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
                                            value: totalHours > 0
                                                ? entry.value / totalHours
                                                : 0,
                                            backgroundColor:
                                                Colors.grey.shade200,
                                            valueColor:
                                                AlwaysStoppedAnimation<Color>(
                                                  Colors.orange.shade400,
                                                ),
                                          ),
                                        ],
                                      ),
                                    );
                                  }),
                                ],
                              ] else ...[
                                const SizedBox(height: 8),
                                Text(
                                  'Tryck för att se detaljer',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Colors.grey.shade600,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                    ),

                    const SizedBox(height: 16),

                    // Godkänd ersättning
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Icon(
                                  Icons.restaurant,
                                  color: Colors.green.shade700,
                                ),
                                const SizedBox(width: 8),
                                const Text(
                                  'Godkänd ersättning',
                                  style: TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 16),
                            if (totalLunch > 0 || totalTravel > 0) ...[
                              Row(
                                children: [
                                  Icon(
                                    Icons.lunch_dining,
                                    size: 20,
                                    color: Colors.grey.shade600,
                                  ),
                                  const SizedBox(width: 8),
                                  const Text(
                                    'Luncher:',
                                    style: TextStyle(fontSize: 14),
                                  ),
                                  const Spacer(),
                                  Text(
                                    '$totalLunch st totalt',
                                    style: TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.green.shade700,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              Row(
                                children: [
                                  Icon(
                                    Icons.directions_car,
                                    size: 20,
                                    color: Colors.grey.shade600,
                                  ),
                                  const SizedBox(width: 8),
                                  const Text(
                                    'Resor:',
                                    style: TextStyle(fontSize: 14),
                                  ),
                                  const Spacer(),
                                  Text(
                                    '$totalTravel km totalt',
                                    style: TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.green.shade700,
                                    ),
                                  ),
                                ],
                              ),
                            ] else
                              const Text(
                                'Ingen ersättning godkänd än',
                                style: TextStyle(color: Colors.grey),
                              ),
                          ],
                        ),
                      ),
                    ),

                    const SizedBox(height: 16),

                    // Bedömningar från handledare
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Icon(Icons.star, color: Colors.amber.shade700),
                                const SizedBox(width: 8),
                                const Text(
                                  'Bedömningar från handledare',
                                  style: TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 16),
                            if (assessments.isEmpty)
                              const Text(
                                'Inga bedömningar än',
                                style: TextStyle(color: Colors.grey),
                              )
                            else
                              ...assessments.map((doc) {
                                final data = doc.data();
                                final averageRating =
                                    data['averageRating'] as String? ?? '0';
                                final supervisorName =
                                    data['supervisorName'] as String? ??
                                    'Okänd';
                                final supervisorCompany =
                                    data['supervisorCompany'] as String? ?? '';
                                final weeks =
                                    (data['weeks'] as List?)?.cast<String>() ??
                                    [];

                                Color ratingColor;
                                if (double.tryParse(averageRating) != null) {
                                  final rating = double.parse(averageRating);
                                  if (rating >= 4.5) {
                                    ratingColor = Colors.green;
                                  } else if (rating >= 3.5) {
                                    ratingColor = Colors.lightGreen;
                                  } else if (rating >= 2.5) {
                                    ratingColor = Colors.orange;
                                  } else {
                                    ratingColor = Colors.red;
                                  }
                                } else {
                                  ratingColor = Colors.grey;
                                }

                                return InkWell(
                                  onTap: () => _showAssessmentDetails(
                                    context,
                                    doc.id,
                                    data,
                                  ),
                                  borderRadius: BorderRadius.circular(12),
                                  child: Card(
                                    color: Colors.grey.shade50,
                                    margin: const EdgeInsets.only(bottom: 12),
                                    child: Padding(
                                      padding: const EdgeInsets.all(12),
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            mainAxisAlignment:
                                                MainAxisAlignment.spaceBetween,
                                            children: [
                                              Expanded(
                                                child: Column(
                                                  crossAxisAlignment:
                                                      CrossAxisAlignment.start,
                                                  children: [
                                                    Text(
                                                      supervisorName,
                                                      style: const TextStyle(
                                                        fontWeight:
                                                            FontWeight.bold,
                                                        fontSize: 14,
                                                      ),
                                                    ),
                                                    if (supervisorCompany
                                                        .isNotEmpty)
                                                      Text(
                                                        supervisorCompany,
                                                        style: TextStyle(
                                                          fontSize: 12,
                                                          color: Colors
                                                              .grey
                                                              .shade600,
                                                        ),
                                                      ),
                                                    const SizedBox(height: 4),
                                                    Text(
                                                      weeks.join(', '),
                                                      style: TextStyle(
                                                        fontSize: 12,
                                                        color: Colors
                                                            .grey
                                                            .shade600,
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                              Container(
                                                padding:
                                                    const EdgeInsets.symmetric(
                                                      horizontal: 12,
                                                      vertical: 8,
                                                    ),
                                                decoration: BoxDecoration(
                                                  color: ratingColor
                                                      .withOpacity(0.2),
                                                  borderRadius:
                                                      BorderRadius.circular(8),
                                                ),
                                                child: Text(
                                                  averageRating,
                                                  style: TextStyle(
                                                    fontSize: 20,
                                                    fontWeight: FontWeight.bold,
                                                    color: ratingColor,
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ),
                                          const SizedBox(height: 8),
                                          Row(
                                            children: [
                                              Icon(
                                                Icons.touch_app,
                                                size: 14,
                                                color: Colors.grey.shade600,
                                              ),
                                              const SizedBox(width: 4),
                                              Text(
                                                'Tryck för att se detaljer',
                                                style: TextStyle(
                                                  fontSize: 12,
                                                  color: Colors.grey.shade600,
                                                  fontStyle: FontStyle.italic,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ],
                                      ),
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
              );
            },
          );
        },
      ),
    );
  }

  void _showAssessmentDetails(
    BuildContext context,
    String requestId,
    Map<String, dynamic> data,
  ) {
    final weeks = (data['weeks'] as List?)?.cast<String>() ?? [];
    final assessmentData = data['assessmentData'] as Map<String, dynamic>?;
    final supervisorName = data['supervisorName'] as String? ?? 'Okänd';
    final supervisorCompany = data['supervisorCompany'] as String? ?? '';
    final supervisorPhone = data['supervisorPhone'] as String? ?? '';
    final lunchApproved = data['lunchApproved'] as int? ?? 0;
    final travelApproved = data['travelApproved'] as int? ?? 0;
    final averageRating = data['averageRating'] as String? ?? '0';
    final imageComments =
      (data['imageComments'] as Map?)?.cast<String, dynamic>() ?? {};

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Row(
          children: [
            const Icon(Icons.assessment, color: Colors.orange),
            const SizedBox(width: 8),
            const Expanded(child: Text('Bedömning')),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.orange.shade100,
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                averageRating,
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  color: Colors.orange.shade700,
                  fontSize: 16,
                ),
              ),
            ),
          ],
        ),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Veckor: ${weeks.join(', ')}',
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const Divider(height: 24),
              const Text(
                'Handledare',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text('Namn: $supervisorName'),
              if (supervisorCompany.isNotEmpty)
                Text('Företag: $supervisorCompany'),
              if (supervisorPhone.isNotEmpty) Text('Telefon: $supervisorPhone'),
              const Divider(height: 24),
              const Text(
                'Godkänd ersättning',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  const Icon(Icons.lunch_dining, size: 16, color: Colors.grey),
                  const SizedBox(width: 4),
                  Text('$lunchApproved luncher'),
                ],
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  const Icon(
                    Icons.directions_car,
                    size: 16,
                    color: Colors.grey,
                  ),
                  const SizedBox(width: 4),
                  Text('$travelApproved km'),
                ],
              ),
              // Bifogade bilder
              if (data['images'] != null &&
                  (data['images'] as List).isNotEmpty) ...[
                const Divider(height: 24),
                const Text(
                  'Bifogade bilder',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children:
                        (data['images'] as List).asMap().entries.map<Widget>((
                      entry,
                    ) {
                      final index = entry.key;
                      final image = entry.value as Map<String, dynamic>;
                      final imageUrl = image['url'] as String? ?? '';
                      final comment =
                          imageComments[index.toString()]?.toString() ?? '';
                      return Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: Image.network(
                                imageUrl,
                                width: 120,
                                height: 120,
                                fit: BoxFit.cover,
                                errorBuilder: (context, error, stackTrace) {
                                  return Container(
                                    width: 120,
                                    height: 120,
                                    color: Colors.grey[300],
                                    child: const Icon(Icons.error),
                                  );
                                },
                              ),
                            ),
                            if (comment.isNotEmpty) ...[
                              const SizedBox(height: 6),
                              SizedBox(
                                width: 120,
                                child: Text(
                                  'Handledarens kommentar: $comment',
                                  style: const TextStyle(
                                    fontSize: 11,
                                    color: Colors.grey,
                                  ),
                                  maxLines: 3,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ],
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ],
              if (assessmentData != null) ...[
                const Divider(height: 24),
                const Text(
                  'Bedömningskriterier',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                ...assessmentData.entries.map((entry) {
                  if (entry.value is Map) {
                    final assessment = entry.value as Map<String, dynamic>;
                    final rating = assessment['rating'] ?? 0;
                    final comment = assessment['comment'] ?? '';
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
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 4,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.orange.shade100,
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  '$rating/5',
                                  style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    color: Colors.orange.shade700,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          if (comment.toString().isNotEmpty) ...[
                            const SizedBox(height: 4),
                            Text(
                              comment.toString(),
                              style: const TextStyle(
                                color: Colors.grey,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ],
                      ),
                    );
                  } else {
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            entry.key,
                            style: const TextStyle(fontWeight: FontWeight.w600),
                          ),
                          Text(
                            entry.value.toString(),
                            style: const TextStyle(color: Colors.grey),
                          ),
                        ],
                      ),
                    );
                  }
                }),
              ],
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Stäng'),
          ),
        ],
      ),
    );
  }
}
