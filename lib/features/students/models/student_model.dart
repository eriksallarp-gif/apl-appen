class StudentModel {
  final String uid;
  final String displayName;
  final String email;
  final String classId;
  final String teacherUid;
  final String? roleType;

  const StudentModel({
    required this.uid,
    required this.displayName,
    required this.email,
    required this.classId,
    required this.teacherUid,
    this.roleType,
  });

  factory StudentModel.fromMap(String uid, Map<String, dynamic> data) {
    return StudentModel(
      uid: uid,
      displayName: (data['displayName'] ?? '').toString(),
      email: (data['email'] ?? '').toString(),
      classId: (data['classId'] ?? '').toString(),
      teacherUid: (data['teacherUid'] ?? '').toString(),
      roleType: data['role_type']?.toString(),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'displayName': displayName,
      'email': email,
      'classId': classId,
      'teacherUid': teacherUid,
      'role_type': roleType,
    };
  }
}
