import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../classes/dialogs/create_class_dialog.dart';
import '../../classes/services/class_service.dart';
import '../../../core/widgets/processing_overlay.dart';
import '../dialogs/add_student_dialog.dart';
import '../dialogs/bulk_message_dialog.dart';
import '../dialogs/bulk_weeks_dialog.dart';
import '../dialogs/edit_student_dialog.dart';
import '../dialogs/search_student_dialog.dart';
import '../services/student_service.dart';
import '../widgets/selection_toolbar.dart';
import '../widgets/student_list.dart';

class StudentRegistrationScreen extends StatefulWidget {
  const StudentRegistrationScreen({super.key});

  @override
  State<StudentRegistrationScreen> createState() => _StudentRegistrationScreenState();
}

class _StudentRegistrationScreenState extends State<StudentRegistrationScreen> {
  final TextEditingController _searchController = TextEditingController();
  final StudentService _studentService = StudentService();
  final ClassService _classService = ClassService();

  String? _selectedClassId;
  String _searchQuery = '';
  final Set<String> _selectedStudentUids = {};
  bool _selectionMode = false;
  bool _isProcessing = false;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser!;

    return Scaffold(
      body: Stack(
        children: [
          Column(
            children: [
              if (_selectionMode)
                SelectionToolbar(
                  selectedCount: _selectedStudentUids.length,
                  canAct: _selectedStudentUids.isNotEmpty,
                  onSelectAll: _selectAllFiltered,
                  onMessage: _bulkMessage,
                  onSetWeeks: _bulkSetWeeks,
                  onDelete: _bulkDelete,
                  onClose: () => setState(() {
                    _selectionMode = false;
                    _selectedStudentUids.clear();
                  }),
                ),
              const SafeArea(
                bottom: false,
                child: Padding(
                  padding: EdgeInsets.fromLTRB(16, 12, 16, 8),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'Klasshanteraren',
                      style: TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
              ),
              _buildClassSelector(user.uid),
              Expanded(child: _buildStudentBody(user.uid)),
            ],
          ),
          ProcessingOverlay(isVisible: _isProcessing),
        ],
      ),
      floatingActionButton: _selectedClassId != null && _selectedClassId != 'UNASSIGNED'
          ? FloatingActionButton(
              onPressed: () => _showAddStudentDialog(context),
              tooltip: 'Lägg till elev',
              child: const Icon(Icons.person_add),
            )
          : null,
      bottomNavigationBar: Container(
        padding: const EdgeInsets.all(8),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            ElevatedButton.icon(
              onPressed: () => _showCreateClassDialog(context),
              icon: const Icon(Icons.class_),
              label: const Text('Skapa klass'),
            ),
            ElevatedButton.icon(
              onPressed: () => _showGenerateClassCodeDialog(context),
              icon: const Icon(Icons.qr_code),
              label: const Text('Klasskoder'),
            ),
          ],
        ),
      ),
    );
  }

  void _copyToClipboard(String value, String label) {
    Clipboard.setData(ClipboardData(text: value));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('$label kopierad')),
    );
  }

  Widget _buildClassSelector(String teacherUid) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Välj klass eller visa elever utan klass',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: Colors.grey,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
                  stream: _classService.classesForTeacher(teacherUid),
                  builder: (context, snap) {
                    if (snap.connectionState == ConnectionState.waiting) {
                      return const CircularProgressIndicator();
                    }

                    final classes = snap.data?.docs ?? [];
                    return DropdownButton<String?>(
                      hint: const Text('Välj klass'),
                      isExpanded: true,
                      value: _selectedClassId == 'UNASSIGNED' ? null : _selectedClassId,
                      items: [
                        const DropdownMenuItem(value: null, child: Text('Alla klasser')),
                        ...classes.map(
                          (doc) => DropdownMenuItem(
                            value: doc.id,
                            child: Text(doc.data()['name'] ?? 'Okänd klass'),
                          ),
                        ),
                      ],
                      onChanged: (classId) => setState(() {
                        _selectedClassId = classId;
                        _searchQuery = '';
                        _searchController.clear();
                      }),
                    );
                  },
                ),
              ),
              const SizedBox(width: 8),
              ElevatedButton.icon(
                onPressed: () => setState(() {
                  _selectedClassId = 'UNASSIGNED';
                  _searchQuery = '';
                  _searchController.clear();
                }),
                icon: const Icon(Icons.person_add),
                label: const Text('Utan klass'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStudentBody(String teacherUid) {
    if (_selectedClassId != null && _selectedClassId != 'UNASSIGNED') {
      return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
        stream: FirebaseFirestore.instance.collection('users').where('role', isEqualTo: 'student').snapshots(),
        builder: (outerContext, usersSnap) {
          if (usersSnap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
            stream: FirebaseFirestore.instance.collection('classes').doc(_selectedClassId).collection('students').snapshots(),
            builder: (innerContext, classStudentsSnap) {
              if (classStudentsSnap.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              }

              final usersFromUsersCollection = (usersSnap.data?.docs ?? []).where((doc) {
                final data = doc.data();
                final classId = (data['classId'] ?? '').toString().trim();
                final teacher = (data['teacherUid'] ?? '').toString().trim();
                return teacher == teacherUid && classId == _selectedClassId;
              }).toList();
              final usersFromClassCollection = classStudentsSnap.data?.docs ?? [];

              final combined = <String, Map<String, dynamic>>{};
              for (final doc in usersFromUsersCollection) {
                combined[doc.id] = doc.data();
              }
              for (final doc in usersFromClassCollection) {
                combined.putIfAbsent(doc.id, () => doc.data());
              }

              final allStudents = combined.entries.map((e) => MapEntry(e.key, e.value)).toList();
              final filtered = _filterStudents(allStudents);

              if (filtered.isEmpty) {
                return Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.person_add, size: 64, color: Colors.grey.shade300),
                      const SizedBox(height: 16),
                      const Text('Inga elever i denna klass ännu', style: TextStyle(fontSize: 16, color: Colors.grey)),
                      const SizedBox(height: 16),
                      ElevatedButton.icon(
                        onPressed: () => _showSearchAllStudentsDialog(innerContext),
                        icon: const Icon(Icons.search),
                        label: const Text('Sök och lägg till elever'),
                      ),
                    ],
                  ),
                );
              }

              return _buildStudentList(filtered);
            },
          );
        },
      );
    }

    if (_selectedClassId == 'UNASSIGNED') {
      return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
        stream: FirebaseFirestore.instance.collection('users').where('role', isEqualTo: 'student').snapshots(),
        builder: (unassignedContext, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          final allUsers = snap.data?.docs ?? [];
          final unassigned = allUsers.where((doc) {
            final data = doc.data();
            final classId = (data['classId'] ?? '').toString().trim();
            final teacher = (data['teacherUid'] ?? '').toString().trim();
            return teacher == teacherUid && classId.isEmpty;
          }).toList();

          final filtered = _searchQuery.trim().isEmpty
              ? unassigned
              : unassigned.where((doc) {
                  final data = doc.data();
                  final name = (data['displayName'] ?? '').toString().toLowerCase();
                  final email = (data['email'] ?? '').toString().toLowerCase();
                  final q = _searchQuery.toLowerCase();
                  return name.contains(q) || email.contains(q);
                }).toList();

          if (filtered.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.person_add_disabled, size: 64, color: Colors.grey.shade300),
                  const SizedBox(height: 16),
                  const Text('Inga elever utan klassilldelning', style: TextStyle(fontSize: 16, color: Colors.grey)),
                ],
              ),
            );
          }

          final entries = filtered.map((doc) => MapEntry(doc.id, doc.data())).toList();
          return _buildStudentList(entries);
        },
      );
    }

    return const SizedBox.shrink();
  }

  List<MapEntry<String, Map<String, dynamic>>> _filterStudents(
    List<MapEntry<String, Map<String, dynamic>>> students,
  ) {
    if (_searchQuery.trim().isEmpty) {
      return students;
    }
    final q = _searchQuery.toLowerCase();
    return students.where((entry) {
      final data = entry.value;
      final name = (data['displayName'] ?? '').toString().toLowerCase();
      final email = (data['email'] ?? '').toString().toLowerCase();
      return name.contains(q) || email.contains(q);
    }).toList();
  }

  Widget _buildStudentList(List<MapEntry<String, Map<String, dynamic>>> students) {
    return StudentList(
      searchController: _searchController,
      onSearchChanged: (value) => setState(() => _searchQuery = value),
      students: students,
      selectionMode: _selectionMode,
      selectedUids: _selectedStudentUids,
      canDelete: _selectedClassId != 'UNASSIGNED',
      onEdit: (uid, name, email) => _showEditStudentDialog(context, uid, name, email),
      onDelete: (uid) => _showDeleteConfirmation(context, uid),
      onStartSelection: (uid) => setState(() {
        _selectionMode = true;
        _selectedStudentUids.add(uid);
      }),
      onToggleSelection: (uid) => setState(() {
        if (_selectedStudentUids.contains(uid)) {
          _selectedStudentUids.remove(uid);
        } else {
          _selectedStudentUids.add(uid);
        }
      }),
    );
  }

  Future<void> _showAddStudentDialog(BuildContext context) async {
    String? name;
    String? email;

    await showDialog<void>(
      context: context,
      builder: (_) => AddStudentDialog(onSave: (n, e) {
        name = n;
        email = e;
      }),
    );

    if (name == null || email == null || _selectedClassId == null) {
      return;
    }

    try {
      await _studentService.addStudentToClass(
        classId: _selectedClassId!,
        displayName: name!,
        email: email!,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Elev tillagd ✅')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Fel: $e')));
    }
  }

  Future<void> _showEditStudentDialog(
    BuildContext context,
    String studentUid,
    String currentName,
    String currentEmail,
  ) async {
    EditStudentDialogResult? result;
    bool removeRequested = false;
    String removeName = currentName;

    await showDialog<void>(
      context: context,
      builder: (_) => EditStudentDialog(
        initialName: currentName,
        initialEmail: currentEmail,
        initialSelectedClass: _selectedClassId == 'UNASSIGNED' ? null : _selectedClassId,
        teacherUid: FirebaseAuth.instance.currentUser!.uid,
        showRemoveFromClass: _selectedClassId != null && _selectedClassId != 'UNASSIGNED',
        onRemove: (name) {
          removeRequested = true;
          removeName = name;
        },
        onSave: (value) => result = value,
      ),
    );

    if (removeRequested && _selectedClassId != null) {
      final confirm = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Ta bort från klass'),
          content: Text('Ta bort $removeName från denna klass?'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Avbryt')),
            ElevatedButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
              child: const Text('Ta bort'),
            ),
          ],
        ),
      );

      if (confirm == true) {
        await _studentService.removeStudentFromClass(classId: _selectedClassId!, studentUid: studentUid);
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$removeName borttagen från klassen')),
        );
      }
      return;
    }

    if (result == null) return;

    try {
      await _studentService.updateStudent(
        studentUid: studentUid,
        currentClassId: _selectedClassId,
        payload: EditStudentPayload(
          displayName: result!.displayName,
          email: result!.email,
          roleType: result!.roleType,
          selectedClass: result!.selectedClass,
        ),
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Elev uppdaterad ✅')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Fel: $e')));
    }
  }

  void _showDeleteConfirmation(BuildContext context, String studentUid) {
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Koppla bort elev?'),
        content: const Text(
          'Detta tar bort eleven från din klass. Eleven behåller sitt konto och kan kopplas till en annan lärare.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('Avbryt')),
          ElevatedButton(
            onPressed: () async {
              if (_selectedClassId == null) return;
              await _studentService.disconnectStudent(classId: _selectedClassId!, studentUid: studentUid);
              Navigator.pop(dialogContext);
              if (!mounted) return;
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Elev bortkopplad från klassen ✅')),
              );
            },
            child: const Text('Koppla bort'),
          ),
        ],
      ),
    );
  }

  Future<void> _bulkDelete() async {
    if (_selectedClassId == null || _selectedStudentUids.isEmpty) return;
    setState(() => _isProcessing = true);

    final confirm = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Koppla bort markerade elever?'),
        content: const Text('Detta tar bort eleverna från klassen men de behåller sina konton.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Avbryt')),
          ElevatedButton(onPressed: () => Navigator.pop(dialogContext, true), child: const Text('Koppla bort')),
        ],
      ),
    );

    if (confirm != true) {
      if (!mounted) return;
      setState(() => _isProcessing = false);
      return;
    }

    try {
      await _studentService.bulkDisconnectStudents(classId: _selectedClassId!, studentUids: _selectedStudentUids);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Markerade elever bortkopplade från klassen')));
      setState(() {
        _selectionMode = false;
        _selectedStudentUids.clear();
        _isProcessing = false;
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Fel: $e')));
      setState(() => _isProcessing = false);
    }
  }

  Future<void> _bulkMessage() async {
    if (_selectedStudentUids.isEmpty) return;
    setState(() => _isProcessing = true);

    String? message;
    await showDialog<void>(
      context: context,
      builder: (_) => BulkMessageDialog(onSend: (value) => message = value),
    );

    if (message == null) {
      if (!mounted) return;
      setState(() => _isProcessing = false);
      return;
    }

    try {
      await _studentService.sendBulkMessage(studentUids: _selectedStudentUids, message: message!);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Meddelanden skickade')));
      setState(() {
        _selectionMode = false;
        _selectedStudentUids.clear();
        _isProcessing = false;
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Fel: $e')));
      setState(() => _isProcessing = false);
    }
  }

  Future<void> _bulkSetWeeks() async {
    if (_selectedClassId == null || _selectedStudentUids.isEmpty) return;
    setState(() => _isProcessing = true);

    List<int>? selectedWeeks;
    await showDialog<void>(
      context: context,
      builder: (_) => BulkWeeksDialog(onSave: (weeks) => selectedWeeks = weeks),
    );

    if (selectedWeeks == null) {
      if (!mounted) return;
      setState(() => _isProcessing = false);
      return;
    }

    try {
      await _studentService.setWeeksForStudents(
        classId: _selectedClassId!,
        studentUids: _selectedStudentUids,
        weeks: selectedWeeks!,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Veckor uppdaterade för markerade elever')));
      setState(() {
        _selectionMode = false;
        _selectedStudentUids.clear();
        _isProcessing = false;
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Fel: $e')));
      setState(() => _isProcessing = false);
    }
  }

  Future<void> _selectAllFiltered() async {
    if (_selectedClassId == null) return;
    setState(() => _isProcessing = true);

    try {
      final ids = await _studentService.getFilteredStudentIds(classId: _selectedClassId!, query: _searchQuery);
      if (!mounted) return;
      setState(() {
        _selectedStudentUids
          ..clear()
          ..addAll(ids);
        _selectionMode = true;
        _isProcessing = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _isProcessing = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Fel vid markera alla: $e')));
    }
  }

  Future<void> _showSearchAllStudentsDialog(BuildContext context) async {
    await showDialog<void>(
      context: context,
      builder: (_) => SearchStudentDialog(
        selectedClassId: _selectedClassId,
        loadStudents: _studentService.fetchAllStudents,
        onAssign: (uid, name, email) async {
          if (_selectedClassId == null) return;
          await _studentService.assignStudentToClass(
            classId: _selectedClassId!,
            studentUid: uid,
            displayName: name,
            email: email,
          );
        },
      ),
    );
  }

  Future<void> _showCreateClassDialog(BuildContext context) async {
    final user = FirebaseAuth.instance.currentUser!;
    String? className;

    await showDialog<void>(
      context: context,
      builder: (_) => CreateClassDialog(onSave: (value) => className = value),
    );

    if (className == null) return;

    try {
      await _classService.createClass(teacherUid: user.uid, className: className!);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Klass "$className" skapad!')));
      setState(() => _selectedClassId = '${user.uid}_$className');
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Fel: $e')));
    }
  }

  void _showGenerateClassCodeDialog(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser!;

    showDialog(
      context: context,
      builder: (dialogContext) => StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
        stream: _classService.classesForTeacher(user.uid),
        builder: (streamContext, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const AlertDialog(
              title: Text('Generera klasskod'),
              content: CircularProgressIndicator(),
            );
          }

          final classes = snap.data?.docs ?? [];
          if (classes.isEmpty) {
            return AlertDialog(
              title: const Text('Generera klasskod'),
              content: const Text('Du har inga klasser än. Skapa en klass först.'),
              actions: [
                TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('OK')),
              ],
            );
          }

          return AlertDialog(
            title: const Text('Generera klasskod'),
            content: SizedBox(
              width: double.maxFinite,
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: classes.length,
                itemBuilder: (listContext, index) {
                  final doc = classes[index];
                  final className = doc.data()['name'] ?? 'Okänd klass';
                  final classId = doc.id;

                  return Card(
                    child: ListTile(
                      title: Text(className),
                      subtitle: SelectableText(
                        'Klasskod: $classId',
                        style: const TextStyle(fontFamily: 'monospace', fontSize: 12),
                      ),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            icon: const Icon(Icons.qr_code),
                            onPressed: () {
                              showDialog(
                                context: streamContext,
                                useRootNavigator: true,
                                builder: (qrDialogContext) => Dialog(
                                  child: Padding(
                                    padding: const EdgeInsets.all(16),
                                    child: ConstrainedBox(
                                      constraints: const BoxConstraints(maxWidth: 320),
                                      child: SingleChildScrollView(
                                        child: Column(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Text(
                                              'QR-kod för $className',
                                              style: Theme.of(qrDialogContext).textTheme.titleMedium,
                                              textAlign: TextAlign.center,
                                            ),
                                            const SizedBox(height: 16),
                                            SizedBox(
                                              width: 200,
                                              height: 200,
                                              child: QrImageView(data: classId, version: QrVersions.auto),
                                            ),
                                            const SizedBox(height: 16),
                                            SelectableText(
                                              'Klasskod: $classId',
                                              style: const TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.bold),
                                              textAlign: TextAlign.center,
                                            ),
                                            const SizedBox(height: 8),
                                            ElevatedButton.icon(
                                              onPressed: () => _copyToClipboard(classId, 'Klasskod'),
                                              icon: const Icon(Icons.copy),
                                              label: const Text('Kopiera klasskod'),
                                            ),
                                            const SizedBox(height: 8),
                                            const Text(
                                              'Elever kan skanna denna QR-kod eller ange klasskoden manuellt när de skapar sitt konto',
                                              textAlign: TextAlign.center,
                                              style: TextStyle(fontSize: 12, color: Colors.grey),
                                            ),
                                            const SizedBox(height: 8),
                                            TextButton(onPressed: () => Navigator.pop(qrDialogContext), child: const Text('Stäng')),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              );
                            },
                            tooltip: 'Visa QR-kod',
                          ),
                          IconButton(
                            icon: const Icon(Icons.copy),
                            onPressed: () => _copyToClipboard(classId, 'Klasskod'),
                            tooltip: 'Kopiera klasskod',
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('Stäng')),
            ],
          );
        },
      ),
    );
  }
}
