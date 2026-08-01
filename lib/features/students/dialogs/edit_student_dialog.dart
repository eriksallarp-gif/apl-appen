import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

class EditStudentDialogResult {
  final String displayName;
  final String email;
  final String? roleType;
  final String? selectedClass;

  const EditStudentDialogResult({
    required this.displayName,
    required this.email,
    required this.roleType,
    required this.selectedClass,
  });
}

class EditStudentDialog extends StatefulWidget {
  final String initialName;
  final String initialEmail;
  final String? initialSelectedClass;
  final String teacherUid;
  final bool showRemoveFromClass;
  final void Function(String currentName) onRemove;
  final void Function(EditStudentDialogResult result) onSave;

  const EditStudentDialog({
    super.key,
    required this.initialName,
    required this.initialEmail,
    required this.initialSelectedClass,
    required this.teacherUid,
    required this.showRemoveFromClass,
    required this.onRemove,
    required this.onSave,
  });

  @override
  State<EditStudentDialog> createState() => _EditStudentDialogState();
}

class _EditStudentDialogState extends State<EditStudentDialog> {
  late final TextEditingController _nameController;
  late final TextEditingController _emailController;
  String? _selectedRole;
  String? _selectedNewClass;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.initialName);
    _emailController = TextEditingController(text: widget.initialEmail);
    _selectedNewClass = widget.initialSelectedClass;
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Redigera elev'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextField(
              controller: _nameController,
              decoration: const InputDecoration(
                labelText: 'Namn',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _emailController,
              decoration: const InputDecoration(
                labelText: 'E-post',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Yrkesutgång',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
            ),
            const SizedBox(height: 8),
            DropdownButton<String>(
              isExpanded: true,
              value: _selectedRole,
              hint: const Text('Välj yrkesutgång'),
              items: const [
                'Träarbetare',
                'VVS',
                'Målare',
                'Plåtslagare',
                'Anläggare',
              ]
                  .map((role) => DropdownMenuItem(
                        value: role,
                        child: Text(role),
                      ))
                  .toList(),
              onChanged: (value) => setState(() => _selectedRole = value),
            ),
            const SizedBox(height: 16),
            const Text(
              'Flytta till klass',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
            ),
            const SizedBox(height: 8),
            StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
              stream: FirebaseFirestore.instance
                  .collection('classes')
                  .where('teacherUid', isEqualTo: widget.teacherUid)
                  .snapshots(),
              builder: (streamContext, classSnap) {
                if (classSnap.connectionState == ConnectionState.waiting) {
                  return const CircularProgressIndicator();
                }
                final classes = classSnap.data?.docs ?? [];
                return DropdownButton<String>(
                  isExpanded: true,
                  value: _selectedNewClass,
                  items: classes
                      .map((doc) => DropdownMenuItem(
                            value: doc.id,
                            child: Text(doc['name'] ?? 'Namnlös klass'),
                          ))
                      .toList(),
                  onChanged: (value) => setState(() => _selectedNewClass = value),
                );
              },
            ),
          ],
        ),
      ),
      actions: [
        if (widget.showRemoveFromClass)
          TextButton.icon(
            onPressed: () {
              widget.onRemove(_nameController.text.trim());
              Navigator.of(context).pop();
            },
            icon: const Icon(Icons.remove_circle, color: Colors.red),
            label: const Text('Ta bort från klass', style: TextStyle(color: Colors.red)),
          ),
        const Spacer(),
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Avbryt'),
        ),
        ElevatedButton(
          onPressed: () {
            widget.onSave(
              EditStudentDialogResult(
                displayName: _nameController.text.trim(),
                email: _emailController.text.trim(),
                roleType: _selectedRole,
                selectedClass: _selectedNewClass,
              ),
            );
            Navigator.of(context).pop();
          },
          child: const Text('Uppdatera'),
        ),
      ],
    );
  }
}
