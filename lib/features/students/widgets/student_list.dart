import 'package:flutter/material.dart';

import 'student_card.dart';

class StudentList extends StatelessWidget {
  final TextEditingController searchController;
  final ValueChanged<String> onSearchChanged;
  final List<MapEntry<String, Map<String, dynamic>>> students;
  final bool selectionMode;
  final Set<String> selectedUids;
  final bool canDelete;
  final void Function(String uid, String displayName, String email) onEdit;
  final ValueChanged<String> onDelete;
  final ValueChanged<String> onStartSelection;
  final ValueChanged<String> onToggleSelection;

  const StudentList({
    super.key,
    required this.searchController,
    required this.onSearchChanged,
    required this.students,
    required this.selectionMode,
    required this.selectedUids,
    required this.canDelete,
    required this.onEdit,
    required this.onDelete,
    required this.onStartSelection,
    required this.onToggleSelection,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: TextField(
            controller: searchController,
            decoration: const InputDecoration(
              prefixIcon: Icon(Icons.search),
              hintText: 'Sök elever (namn eller e-post)',
              border: OutlineInputBorder(),
            ),
            onChanged: onSearchChanged,
          ),
        ),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.all(12),
            itemCount: students.length,
            itemBuilder: (context, index) {
              final entry = students[index];
              final uid = entry.key;
              final data = entry.value;
              final displayName = data['displayName'] ?? 'Okänd elev';
              final email = data['email'] ?? '';
              final selected = selectedUids.contains(uid);

              return StudentCard(
                uid: uid,
                displayName: displayName,
                email: email,
                selectionMode: selectionMode,
                selected: selected,
                canDelete: canDelete,
                onCheckboxChanged: (v) => onToggleSelection(uid),
                onEdit: () => onEdit(uid, displayName, email),
                onDelete: () => onDelete(uid),
                onLongPress: () => onStartSelection(uid),
                onTap: () => selectionMode ? onToggleSelection(uid) : null,
              );
            },
          ),
        ),
      ],
    );
  }
}
