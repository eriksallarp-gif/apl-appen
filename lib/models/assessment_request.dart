import 'package:cloud_firestore/cloud_firestore.dart';

class AssessmentRequest {
  final String id;
  final String studentUid;
  final int? weekNumber;
  final String status;
  final Timestamp? createdAt;

  AssessmentRequest({
    required this.id,
    required this.studentUid,
    required this.status,
    this.weekNumber,
    this.createdAt,
  });

  factory AssessmentRequest.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    final w = data['weekNumber'] ?? data['week'];
    int? weekNum;
    if (w is int) weekNum = w;
    else if (w is String) weekNum = int.tryParse(w.replaceAll(RegExp(r'[^0-9]'), ''));

    return AssessmentRequest(
      id: doc.id,
      studentUid: data['studentUid'] as String? ?? '',
      status: data['status'] as String? ?? '',
      weekNumber: weekNum,
      createdAt: data['createdAt'] as Timestamp?,
    );
  }
}
