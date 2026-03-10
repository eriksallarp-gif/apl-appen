import 'package:flutter/material.dart';

class SelectionToolbar extends StatelessWidget {
  final int selectedCount;
  final bool canAct;
  final VoidCallback onSelectAll;
  final VoidCallback onMessage;
  final VoidCallback onSetWeeks;
  final VoidCallback onDelete;
  final VoidCallback onClose;

  const SelectionToolbar({
    super.key,
    required this.selectedCount,
    required this.canAct,
    required this.onSelectAll,
    required this.onMessage,
    required this.onSetWeeks,
    required this.onDelete,
    required this.onClose,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.grey.shade100,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Row(
        children: [
          Text('$selectedCount markerade'),
          const SizedBox(width: 8),
          TextButton.icon(
            onPressed: onSelectAll,
            icon: const Icon(Icons.select_all),
            label: const Text('Markera alla'),
          ),
          const Spacer(),
          TextButton.icon(
            onPressed: canAct ? onMessage : null,
            icon: const Icon(Icons.message),
            label: const Text('Meddela'),
          ),
          const SizedBox(width: 8),
          TextButton.icon(
            onPressed: canAct ? onSetWeeks : null,
            icon: const Icon(Icons.calendar_today),
            label: const Text('Sätt veckor'),
          ),
          const SizedBox(width: 8),
          TextButton.icon(
            onPressed: canAct ? onDelete : null,
            icon: const Icon(Icons.delete, color: Colors.red),
            label: const Text('Ta bort', style: TextStyle(color: Colors.red)),
          ),
          IconButton(
            onPressed: onClose,
            icon: const Icon(Icons.close),
          ),
        ],
      ),
    );
  }
}
