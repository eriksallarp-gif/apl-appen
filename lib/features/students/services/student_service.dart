import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

class EditStudentPayload {
  final String displayName;
  final String email;
  final String? roleType;
  final String? selectedClass;

  const EditStudentPayload({
    required this.displayName,
    required this.email,
    this.roleType,
    this.selectedClass,
  });
}

class StudentService {
  final FirebaseFirestore _firestore;

  StudentService({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  Future<void> addStudentToClass({
    required String classId,
    required String displayName,
    required String email,
  }) async {
    final classDoc = await _firestore.collection('classes').doc(classId).get();
    final teacherUid = classDoc.data()?['teacherUid'] as String?;

    if (teacherUid == null) {
      throw Exception('Kunde inte hitta lärare för denna klass');
    }

    final newStudentUid = _firestore.collection('users').doc().id;

    await _firestore.collection('users').doc(newStudentUid).set({
      'displayName': displayName,
      'email': email,
      'classId': classId,
      'teacherUid': teacherUid,
      'role': 'student',
      'createdAt': FieldValue.serverTimestamp(),
    });

    await _firestore
        .collection('classes')
        .doc(classId)
        .collection('students')
        .doc(newStudentUid)
        .set({
      'displayName': displayName,
      'email': email,
      'uid': newStudentUid,
    });
  }

  Future<void> removeStudentFromClass({
    required String classId,
    required String studentUid,
  }) async {
    await _firestore
        .collection('classes')
        .doc(classId)
        .collection('students')
        .doc(studentUid)
        .delete();

    await _firestore.collection('users').doc(studentUid).update({
      'classId': FieldValue.delete(),
    });
  }

  Future<void> disconnectStudent({
    required String classId,
    required String studentUid,
  }) async {
    await _firestore.collection('users').doc(studentUid).update({
      'teacherUid': '',
      'classId': '',
    });

    await _firestore
        .collection('classes')
        .doc(classId)
        .collection('students')
        .doc(studentUid)
        .delete();
  }

  Future<void> updateStudent({
    required String studentUid,
    required String? currentClassId,
    required EditStudentPayload payload,
  }) async {
    final updates = <String, dynamic>{
      'displayName': payload.displayName,
      'email': payload.email,
    };
    if (payload.roleType != null) {
      updates['role_type'] = payload.roleType;
    }

    await _firestore.collection('users').doc(studentUid).update(updates);

    if (payload.selectedClass != null) {
      final newClassDoc =
          await _firestore.collection('classes').doc(payload.selectedClass).get();
      final teacherUid = newClassDoc.data()?['teacherUid'] as String?;

      if (currentClassId != null && currentClassId != 'UNASSIGNED') {
        await _firestore
            .collection('classes')
            .doc(currentClassId)
            .collection('students')
            .doc(studentUid)
            .delete();
      }

      await _firestore
          .collection('classes')
          .doc(payload.selectedClass)
          .collection('students')
          .doc(studentUid)
          .set({
        'displayName': payload.displayName,
        'email': payload.email,
        'role_type': payload.roleType,
      });

      final userUpdates = <String, dynamic>{'classId': payload.selectedClass};
      if (teacherUid != null) {
        userUpdates['teacherUid'] = teacherUid;
      }

      await _firestore.collection('users').doc(studentUid).update(userUpdates);
      return;
    }

    await _firestore
        .collection('classes')
        .doc(currentClassId)
        .collection('students')
        .doc(studentUid)
        .update({
      'displayName': payload.displayName,
      'email': payload.email,
      'role_type': payload.roleType,
    });
  }

  Future<void> bulkDisconnectStudents({
    required String classId,
    required Set<String> studentUids,
  }) async {
    final batch = _firestore.batch();
    for (final uid in studentUids) {
      batch.update(_firestore.collection('users').doc(uid), {
        'teacherUid': '',
        'classId': '',
      });
      batch.delete(
        _firestore.collection('classes').doc(classId).collection('students').doc(uid),
      );
    }
    await batch.commit();
  }

  Future<void> sendBulkMessage({
    required Set<String> studentUids,
    required String message,
  }) async {
    final now = FieldValue.serverTimestamp();
    for (final uid in studentUids) {
      await _firestore.collection('messages').add({
        'to': uid,
        'from': FirebaseAuth.instance.currentUser?.uid,
        'message': message,
        'createdAt': now,
      });
    }
  }

  Future<void> setWeeksForStudents({
    required String classId,
    required Set<String> studentUids,
    required List<int> weeks,
  }) async {
    final weekMap = <String, bool>{for (var i = 1; i <= 52; i++) i.toString(): false};
    for (final week in weeks) {
      if (week >= 1 && week <= 52) {
        weekMap[week.toString()] = true;
      }
    }

    final batch = _firestore.batch();
    for (final uid in studentUids) {
      final ref = _firestore
          .collection('classes')
          .doc(classId)
          .collection('studentWeekOverrides')
          .doc(uid);
      batch.set(ref, {'weekEnabled': weekMap}, SetOptions(merge: true));
    }
    await batch.commit();
  }

  Future<List<String>> getFilteredStudentIds({
    required String classId,
    required String query,
  }) async {
    final snap = await _firestore
        .collection('classes')
        .doc(classId)
        .collection('students')
        .get();

    final docs = snap.docs;
    final q = query.toLowerCase().trim();
    if (q.isEmpty) {
      return docs.map((d) => d.id).toList();
    }

    return docs
        .where((d) {
          final data = d.data();
          final name = (data['displayName'] ?? '').toString().toLowerCase();
          final email = (data['email'] ?? '').toString().toLowerCase();
          return name.contains(q) || email.contains(q);
        })
        .map((d) => d.id)
        .toList();
  }

  Future<List<QueryDocumentSnapshot<Map<String, dynamic>>>> fetchAllStudents() async {
    final snap = await _firestore.collection('users').where('role', isEqualTo: 'student').get();
    return snap.docs;
  }

  Future<void> assignStudentToClass({
    required String classId,
    required String studentUid,
    required String displayName,
    required String email,
  }) async {
    await _firestore.collection('users').doc(studentUid).set(
      {'classId': classId},
      SetOptions(merge: true),
    );

    await _firestore
        .collection('classes')
        .doc(classId)
        .collection('students')
        .doc(studentUid)
        .set(
      {
        'displayName': displayName,
        'email': email,
        'role': 'student',
      },
      SetOptions(merge: true),
    );
  }
}
