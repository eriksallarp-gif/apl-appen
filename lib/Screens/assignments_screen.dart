import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import 'assignment_detail_screen.dart';

class AssignmentsScreen extends StatefulWidget {
  const AssignmentsScreen({super.key});

  @override
  State<AssignmentsScreen> createState() => _AssignmentsScreenState();
}

class _AssignmentsScreenState extends State<AssignmentsScreen> {
  String? _uid;

  @override
  void initState() {
    super.initState();
    _uid = FirebaseAuth.instance.currentUser?.uid;
  }

  Future<void> _markSeen(String assignmentId) async {
    final uid = _uid;
    if (uid == null) return;

    await FirebaseFirestore.instance
        .collection('assignments')
        .doc(assignmentId)
        .collection('assignees')
        .doc(uid)
        .set({
      'isNew': false,
      'seenAt': Timestamp.now(),
      'studentId': uid,
    }, SetOptions(merge: true));
  }

  @override
  Widget build(BuildContext context) {
    final uid = _uid;
    if (uid == null) {
      return const Center(child: Text('Du måste vara inloggad.'));
    }

    final assignmentsStream = FirebaseFirestore.instance
        .collection('assignments')
        .where('assignedTo', arrayContains: uid)
        .snapshots();

    return Scaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SafeArea(
            bottom: false,
            child: Padding(
              padding: EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Text(
                'Uppgifter',
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: Text(
              'Här ser du uppgifter som din lärare har tilldelat.',
              style: TextStyle(fontSize: 14, color: Colors.grey.shade600),
            ),
          ),
          const SizedBox(height: 16),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
                stream: assignmentsStream,
                builder: (context, assignmentSnap) {
                  if (assignmentSnap.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator());
                  }

                  if (assignmentSnap.hasError) {
                    return Center(child: Text('Fel vid hämtning: ${assignmentSnap.error}'));
                  }

                  final assignmentDocs = assignmentSnap.data?.docs ?? [];

                  final assignments = assignmentDocs
                      .where((doc) => (doc.data()['assignmentStatus'] ?? 'active').toString() == 'active')
                      .toList()
                    ..sort((a, b) {
                      final aTs = a.data()['createdAt'] as Timestamp?;
                      final bTs = b.data()['createdAt'] as Timestamp?;
                      return (bTs?.millisecondsSinceEpoch ?? 0) - (aTs?.millisecondsSinceEpoch ?? 0);
                    });

                  if (assignments.isEmpty) {
                    return Center(
                      child: Text(
                        'Inga uppgifter just nu.',
                        style: TextStyle(fontSize: 15, color: Colors.grey.shade600),
                      ),
                    );
                  }

                  return ListView.separated(
                    itemCount: assignments.length,
                    padding: EdgeInsets.zero,
                    separatorBuilder: (context, index) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      final assignment = assignments[index];
                      final data = assignment.data();
                      final title = (data['title'] ?? 'Uppgift').toString();
                      final description = (data['description'] ?? '').toString();
                      final dueDate = data['dueDate'] as Timestamp?;
                      final createdAt = data['createdAt'] as Timestamp?;
                      final submissionStream = FirebaseFirestore.instance
                          .collection('assignments')
                          .doc(assignment.id)
                          .collection('submissions')
                          .doc(uid)
                          .snapshots();

                      return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
                        stream: submissionStream,
                        builder: (context, submissionSnap) {
                          final hasSubmitted = submissionSnap.data?.exists == true;
                          final isNew = !hasSubmitted &&
                              createdAt != null &&
                              DateTime.now().difference(createdAt.toDate()).inDays <= 7;

                          return InkWell(
                            borderRadius: BorderRadius.circular(16),
                            onTap: () async {
                              await _markSeen(assignment.id);
                              if (!context.mounted) return;
                              await Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) => AssignmentDetailScreen(assignmentId: assignment.id),
                                ),
                              );
                            },
                            child: Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: Colors.orange.shade200),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.orange.shade100.withValues(alpha: 0.35),
                                    blurRadius: 8,
                                    offset: const Offset(0, 2),
                                  ),
                                ],
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Expanded(
                                        child: Text(
                                          title,
                                          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                                        ),
                                      ),
                                      if (isNew)
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                          decoration: BoxDecoration(
                                            color: Colors.orange.shade600,
                                            borderRadius: BorderRadius.circular(999),
                                          ),
                                          child: const Text(
                                            'Ny',
                                            style: TextStyle(
                                              color: Colors.white,
                                              fontSize: 11,
                                              fontWeight: FontWeight.w700,
                                            ),
                                          ),
                                        ),
                                    ],
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    description,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(color: Colors.grey.shade700),
                                  ),
                                  const SizedBox(height: 12),
                                  Wrap(
                                    spacing: 8,
                                    runSpacing: 8,
                                    children: [
                                      _Tag(
                                        text: hasSubmitted ? 'Inlämnad' : 'Ej inlämnad',
                                        color: hasSubmitted ? Colors.green : Colors.orange,
                                      ),
                                      _Tag(
                                        text: dueDate == null
                                            ? 'Ingen deadline'
                                            : 'Deadline ${_dateText(dueDate.toDate())}',
                                        color: Colors.blueGrey,
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
              ),
            ),
          ),
        ],
      ),
    );
  }
}

String _dateText(DateTime d) {
  final y = d.year.toString().padLeft(4, '0');
  final m = d.month.toString().padLeft(2, '0');
  final day = d.day.toString().padLeft(2, '0');
  return '$y-$m-$day';
}

class _Tag extends StatelessWidget {
  final String text;
  final MaterialColor color;

  const _Tag({required this.text, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        text,
        style: TextStyle(color: color.shade700, fontSize: 12, fontWeight: FontWeight.w600),
      ),
    );
  }
}
