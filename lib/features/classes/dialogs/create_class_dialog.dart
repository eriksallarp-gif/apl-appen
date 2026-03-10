import 'package:flutter/material.dart';

class CreateClassDialog extends StatefulWidget {
  final void Function(String className) onSave;

  const CreateClassDialog({
    super.key,
    required this.onSave,
  });

  @override
  State<CreateClassDialog> createState() => _CreateClassDialogState();
}

class _CreateClassDialogState extends State<CreateClassDialog> {
  final TextEditingController _nameController = TextEditingController();

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Skapa ny klass'),
      content: TextField(
        controller: _nameController,
        decoration: const InputDecoration(
          labelText: 'Klassnamn (ex: BA23, EL24)',
          border: OutlineInputBorder(),
        ),
        autofocus: true,
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Avbryt'),
        ),
        ElevatedButton(
          onPressed: () {
            final className = _nameController.text.trim();
            if (className.isEmpty) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Ange klassnamn')),
              );
              return;
            }

            widget.onSave(className);
            Navigator.of(context).pop();
          },
          child: const Text('Skapa'),
        ),
      ],
    );
  }
}
