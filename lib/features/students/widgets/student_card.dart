import 'package:flutter/material.dart';

class StudentCard extends StatelessWidget {
  final String uid;
  final String displayName;
  final String email;
  final bool selectionMode;
  final bool selected;
  final bool canDelete;
  final ValueChanged<bool?>? onCheckboxChanged;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final VoidCallback onLongPress;
  final VoidCallback onTap;

  const StudentCard({
    super.key,
    required this.uid,
    required this.displayName,
    required this.email,
    required this.selectionMode,
    required this.selected,
    required this.canDelete,
    required this.onCheckboxChanged,
    required this.onEdit,
    required this.onDelete,
    required this.onLongPress,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        leading: selectionMode
            ? Checkbox(
                value: selected,
                onChanged: onCheckboxChanged,
              )
            : Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: Colors.orange.shade100,
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Text(
                    displayName.isNotEmpty ? displayName[0].toUpperCase() : '?',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: Colors.orange.shade700,
                    ),
                  ),
                ),
              ),
        title: Text(displayName),
        subtitle: Text(email),
        trailing: selectionMode
            ? null
            : PopupMenuButton(
                itemBuilder: (context) => [
                  PopupMenuItem(
                    onTap: onEdit,
                    child: const Row(
                      children: [
                        Icon(Icons.edit, size: 20),
                        SizedBox(width: 8),
                        Text('Redigera'),
                      ],
                    ),
                  ),
                  if (canDelete)
                    PopupMenuItem(
                      onTap: onDelete,
                      child: const Row(
                        children: [
                          Icon(Icons.delete, size: 20, color: Colors.red),
                          SizedBox(width: 8),
                          Text('Ta bort', style: TextStyle(color: Colors.red)),
                        ],
                      ),
                    ),
                ],
              ),
        onLongPress: onLongPress,
        onTap: onTap,
      ),
    );
  }
}
