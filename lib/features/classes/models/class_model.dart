class ClassModel {
  final String id;
  final String name;
  final String teacherUid;

  const ClassModel({
    required this.id,
    required this.name,
    required this.teacherUid,
  });

  factory ClassModel.fromMap(String id, Map<String, dynamic> data) {
    return ClassModel(
      id: id,
      name: (data['name'] ?? '').toString(),
      teacherUid: (data['teacherUid'] ?? '').toString(),
    );
  }
}
