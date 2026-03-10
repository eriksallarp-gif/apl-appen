import 'package:cloud_firestore/cloud_firestore.dart';

class ClassService {
  final FirebaseFirestore _firestore;

  ClassService({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  Stream<QuerySnapshot<Map<String, dynamic>>> classesForTeacher(String teacherUid) {
    return _firestore
        .collection('classes')
        .where('teacherUid', isEqualTo: teacherUid)
        .snapshots();
  }

  Future<void> createClass({
    required String teacherUid,
    required String className,
  }) async {
    final classId = '${teacherUid}_$className';
    await _firestore.collection('classes').doc(classId).set({
      'name': className,
      'teacherUid': teacherUid,
      'createdAt': FieldValue.serverTimestamp(),
      'weekEnabled': <String, bool>{},
    });
  }
}
