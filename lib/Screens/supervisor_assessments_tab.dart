import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class SupervisorAssessmentsTab extends StatelessWidget {
  final String classId;
  const SupervisorAssessmentsTab({super.key, required this.classId});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance
          .collection('assessmentRequests')
          .where('status', isEqualTo: 'submitted')
          .snapshots(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }

        if (snapshot.hasError) {
          return Center(child: Text('Fel: ${snapshot.error}'));
        }

        final allRequests = snapshot.data?.docs ?? [];

        return FutureBuilder<List<DocumentSnapshot<Map<String, dynamic>>>>(
          future: _filterAssessmentsByClass(allRequests, classId),
          builder: (context, filteredSnap) {
            if (filteredSnap.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }

            var assessments = filteredSnap.data ?? [];

            // Sortera efter submittedAt i kod istället
            assessments.sort((a, b) {
              final aTime = (a.data()?['submittedAt'] as Timestamp?)?.toDate();
              final bTime = (b.data()?['submittedAt'] as Timestamp?)?.toDate();
              if (aTime == null || bTime == null) return 0;
              return bTime.compareTo(aTime); // Descending order
            });

            if (assessments.isEmpty) {
              return Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.assignment_outlined,
                      size: 64,
                      color: Colors.grey.shade300,
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'Inga bedömningar från handledare än',
                      style: TextStyle(fontSize: 16, color: Colors.grey),
                    ),
                  ],
                ),
              );
            }

            return ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: assessments.length,
              itemBuilder: (context, index) {
                final doc = assessments[index];
                final data = doc.data() ?? {};
                final studentName = data['studentName'] as String? ?? 'Okänd';
                final weeks = (data['weeks'] as List?)?.cast<String>() ?? [];
                final totalHours = data['totalHours'] as int? ?? 0;
                final submittedAt = (data['submittedAt'] as Timestamp?)
                    ?.toDate();
                final supervisorName =
                    data['supervisorName'] as String? ?? 'Okänd';
                final supervisorCompany =
                    data['supervisorCompany'] as String? ?? '';
                final averageRating = data['averageRating'] as String? ?? '0';
                final lunchApproved = data['lunchApproved'] as int? ?? 0;
                final travelApproved = data['travelApproved'] as int? ?? 0;

                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: InkWell(
                    onTap: () => _showAssessmentDetails(context, doc.id, data),
                    borderRadius: BorderRadius.circular(12),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      studentName,
                                      style: const TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      weeks.join(', '),
                                      style: const TextStyle(
                                        fontSize: 14,
                                        color: Colors.grey,
                                      ),
                                    ),
                                    if (submittedAt != null)
                                      Text(
                                        'Bedömd: ${submittedAt.day}/${submittedAt.month} ${submittedAt.year}',
                                        style: const TextStyle(
                                          fontSize: 12,
                                          color: Colors.grey,
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: _getRatingColor(
                                    double.tryParse(averageRating) ?? 0,
                                  ),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Column(
                                  children: [
                                    Text(
                                      averageRating,
                                      style: const TextStyle(
                                        fontSize: 20,
                                        fontWeight: FontWeight.bold,
                                        color: Colors.white,
                                      ),
                                    ),
                                    const Text(
                                      'av 5',
                                      style: TextStyle(
                                        fontSize: 10,
                                        color: Colors.white70,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          const Divider(),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              const Icon(
                                Icons.person,
                                size: 16,
                                color: Colors.orange,
                              ),
                              const SizedBox(width: 4),
                              Expanded(
                                child: Text(
                                  'Handledare: $supervisorName${supervisorCompany.isNotEmpty ? ' ($supervisorCompany)' : ''}',
                                  style: const TextStyle(fontSize: 13),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              const Icon(
                                Icons.access_time,
                                size: 16,
                                color: Colors.grey,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                '$totalHours h',
                                style: const TextStyle(fontSize: 12),
                              ),
                              const SizedBox(width: 16),
                              const Icon(
                                Icons.lunch_dining,
                                size: 16,
                                color: Colors.grey,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                '$lunchApproved luncher',
                                style: const TextStyle(fontSize: 12),
                              ),
                              const SizedBox(width: 16),
                              const Icon(
                                Icons.directions_car,
                                size: 16,
                                color: Colors.grey,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                '$travelApproved km',
                                style: const TextStyle(fontSize: 12),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            );
          },
        );
      },
    );
  }

  Color _getRatingColor(double rating) {
    if (rating >= 4.5) return Colors.green;
    if (rating >= 3.5) return Colors.lightGreen;
    if (rating >= 2.5) return Colors.orange;
    return Colors.red;
  }

  Future<List<DocumentSnapshot<Map<String, dynamic>>>>
  _filterAssessmentsByClass(
    List<DocumentSnapshot<Map<String, dynamic>>> assessments,
    String classId,
  ) async {
    if (classId == 'ALL') {
      final user = FirebaseAuth.instance.currentUser;
      if (user != null) {
        final classesSnap = await FirebaseFirestore.instance
            .collection('classes')
            .where('teacherUid', isEqualTo: user.uid)
            .get();
        final teacherClassIds = classesSnap.docs.map((doc) => doc.id).toSet();

        final filtered = <DocumentSnapshot<Map<String, dynamic>>>[];
        for (var doc in assessments) {
          final data = doc.data() ?? {};
          final studentUid = data['studentUid'] as String?;
          if (studentUid != null) {
            final userDoc = await FirebaseFirestore.instance
                .collection('users')
                .doc(studentUid)
                .get();
            final studentClassId = userDoc.data()?['classId'] as String?;
            if (studentClassId != null &&
                teacherClassIds.contains(studentClassId)) {
              filtered.add(doc);
            }
          }
        }
        return filtered;
      }
      return [];
    } else {
      final filtered = <DocumentSnapshot<Map<String, dynamic>>>[];
      for (var doc in assessments) {
        final data = doc.data() ?? {};
        final studentUid = data['studentUid'] as String?;
        if (studentUid != null) {
          final userDoc = await FirebaseFirestore.instance
              .collection('users')
              .doc(studentUid)
              .get();
          final studentClassId = userDoc.data()?['classId'] as String?;
          if (studentClassId == classId) {
            filtered.add(doc);
          }
        }
      }
      return filtered;
    }
  }

  void _showAssessmentDetails(
    BuildContext context,
    String requestId,
    Map<String, dynamic> data,
  ) {
    final studentName = data['studentName'] as String? ?? 'Okänd';
    final weeks = (data['weeks'] as List?)?.cast<String>() ?? [];
    final assessmentData = data['assessmentData'] as Map<String, dynamic>?;
    final supervisorName = data['supervisorName'] as String? ?? 'Okänd';
    final supervisorCompany = data['supervisorCompany'] as String? ?? '';
    final supervisorPhone = data['supervisorPhone'] as String? ?? '';
    final lunchApproved = data['lunchApproved'] as int? ?? 0;
    final travelApproved = data['travelApproved'] as int? ?? 0;

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Bedömning - $studentName'),
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
              const SizedBox(height: 16),
              const Text(
                'Handledare',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text('Namn: $supervisorName'),
              if (supervisorCompany.isNotEmpty)
                Text('Företag: $supervisorCompany'),
              if (supervisorPhone.isNotEmpty) Text('Telefon: $supervisorPhone'),
              const SizedBox(height: 16),
              const Text(
                'Godkänd ersättning',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text('Luncher: $lunchApproved'),
              Text('Kilometer: $travelApproved'),
              const SizedBox(height: 16),
              // Bifogade bilder
              if (data['images'] != null && (data['images'] as List).isNotEmpty) ...[
                const Text(
                  'Bifogade bilder',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: (data['images'] as List).map<Widget>((image) {
                      final imageUrl = image['url'] as String? ?? '';
                      return Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: ClipRRect(
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
                      );
                    }).toList(),
                  ),
                ),
                const SizedBox(height: 16),
              ],
              if (assessmentData != null) ...[
                const Text(
                  'Bedömning',
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
                              Text(
                                entry.key,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w600,
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
