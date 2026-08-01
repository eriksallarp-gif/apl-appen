import 'package:flutter/material.dart';

class BulkWeeksDialog extends StatefulWidget {
  final void Function(List<int> weeks) onSave;

  const BulkWeeksDialog({
    super.key,
    required this.onSave,
  });

  @override
  State<BulkWeeksDialog> createState() => _BulkWeeksDialogState();
}

class _BulkWeeksDialogState extends State<BulkWeeksDialog> {
  final TextEditingController _weeksController = TextEditingController();

  @override
  void dispose() {
    _weeksController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Ange veckor att aktivera (komma-separerat)'),
      content: TextField(
        controller: _weeksController,
        decoration: const InputDecoration(hintText: 't.ex. 1,2,3,12'),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Avbryt'),
        ),
        ElevatedButton(
          onPressed: () {
            final parts = _weeksController.text
                .split(',')
                .map((s) => s.trim())
                .where((s) => s.isNotEmpty)
                .toList();
            final weeks = <int>[];
            for (final part in parts) {
              final week = int.tryParse(part);
              if (week != null) {
                weeks.add(week);
              }
            }
            widget.onSave(weeks);
            Navigator.of(context).pop();
          },
          child: const Text('Spara'),
        ),
      ],
    );
  }
}
