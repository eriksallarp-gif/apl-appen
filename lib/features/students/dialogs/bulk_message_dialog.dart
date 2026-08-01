import 'package:flutter/material.dart';

class BulkMessageDialog extends StatefulWidget {
  final void Function(String message) onSend;

  const BulkMessageDialog({
    super.key,
    required this.onSend,
  });

  @override
  State<BulkMessageDialog> createState() => _BulkMessageDialogState();
}

class _BulkMessageDialogState extends State<BulkMessageDialog> {
  final TextEditingController _messageController = TextEditingController();

  @override
  void dispose() {
    _messageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Skicka meddelande till markerade'),
      content: TextField(
        controller: _messageController,
        maxLines: 4,
        decoration: const InputDecoration(hintText: 'Skriv meddelande...'),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Avbryt'),
        ),
        ElevatedButton(
          onPressed: () {
            widget.onSend(_messageController.text);
            Navigator.of(context).pop();
          },
          child: const Text('Skicka'),
        ),
      ],
    );
  }
}
