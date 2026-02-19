import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class StudentOverviewScreen extends StatefulWidget {
  const StudentOverviewScreen({super.key});

  @override
  State<StudentOverviewScreen> createState() => _StudentOverviewScreenState();
}

class _StudentOverviewScreenState extends State<StudentOverviewScreen> {
  String? _selectedClassId;

  Future<int> _getTotalApprovedHours(String studentUid) async {
    try {
      final snap = await FirebaseFirestore.instance
          .collection('timesheets')
          .where('studentUid', isEqualTo: studentUid)
          .where('approved', isEqualTo: true)
          .get();

      int total = 0;
      for (var doc in snap.docs) {
        final data = doc.data();
        final entries = data['entries'] as Map<String, dynamic>? ?? {};
        for (var entry in entries.values) {
          if (entry is Map<String, dynamic>) {
            for (var hours in entry.values) {
              total += (hours as num).toInt();
            }
          }
        }
      }
      return total;
    } catch (e) {
      return 0;
    }
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

                    return DropdownButton<String>(
                      hint: const Text('Välj klass'),
                      isExpanded: true,
                      value: _selectedClassId,
                      items: classes
                          .map((doc) => DropdownMenuItem(
                                value: doc.id,
                                child: Text(doc.data()['name'] ?? 'Okänd klass'),
                              ))
                          .toList(),
                      onChanged: (classId) {
                        setState(() => _selectedClassId = classId);
                      },
                    );
                  },
                ),
              ],
            ),
          ),

          // Elevöversikt
          if (_selectedClassId != null)
            Expanded(
              child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
                stream: FirebaseFirestore.instance
                    .collection('classes')
                    .doc(_selectedClassId)
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
                          Icon(
                            Icons.group,
                            size: 64,
                            color: Colors.grey.shade300,
                          ),
                          const SizedBox(height: 16),
                          const Text(
                            'Inga elever i denna klass ännu',
                            style: TextStyle(
                              fontSize: 16,
                              color: Colors.grey,
                            ),
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
                      final studentName = student.data()['displayName'] ?? 'Okänd';

                      return FutureBuilder<int>(
                        future: _getTotalApprovedHours(studentUid),
                        builder: (context, hoursSnap) {
                          final approvedHours = hoursSnap.data ?? 0;

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
                                        studentName,
                                        style: const TextStyle(
                                          fontSize: 16,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 12,
                                          vertical: 6,
                                        ),
                                        decoration: BoxDecoration(
                                          color: Colors.orange.shade100,
                                          borderRadius:
                                              BorderRadius.circular(20),
                                        ),
                                        child: Text(
                                          '$approvedHours h',
                                          style: TextStyle(
                                            fontSize: 14,
                                            fontWeight: FontWeight.bold,
                                            color: Colors.orange.shade700,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 12),
                                  Text(
                                    'Godkända timmar totalt',
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: Colors.grey.shade600,
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(4),
                                    child: LinearProgressIndicator(
                                      value: (approvedHours / 160).clamp(0, 1)
                                          .toDouble(),
                                      minHeight: 8,
                                      color: Colors.orange,
                                      backgroundColor:
                                          Colors.grey.shade300,
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    '$approvedHours/160 timmar (ett arbetsprogram)',
                                    style: TextStyle(
                                      fontSize: 11,
                                      color: Colors.grey.shade700,
                                    ),
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
        ],
      ),
    );
  }
}
