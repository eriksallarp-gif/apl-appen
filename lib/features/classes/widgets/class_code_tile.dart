import 'package:flutter/material.dart';

class ClassCodeTile extends StatelessWidget {
  final String className;
  final String classId;
  final VoidCallback onShowQr;
  final VoidCallback onCopy;

  const ClassCodeTile({
    super.key,
    required this.className,
    required this.classId,
    required this.onShowQr,
    required this.onCopy,
  });

  @override
  Widget build(BuildContext context) {
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
            IconButton(icon: const Icon(Icons.qr_code), onPressed: onShowQr),
            IconButton(icon: const Icon(Icons.copy), onPressed: onCopy),
          ],
        ),
      ),
    );
  }
}
