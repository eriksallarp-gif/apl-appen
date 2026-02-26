import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class SchoolsScreen extends StatefulWidget {
  const SchoolsScreen({super.key});

  @override
  State<SchoolsScreen> createState() => _SchoolsScreenState();
}

class _SchoolsScreenState extends State<SchoolsScreen> {
  final _schoolNameCtrl = TextEditingController();
  String? _msg;

  @override
  void dispose() {
    _schoolNameCtrl.dispose();
    super.dispose();
  }

  Future<void> _addSchool() async {
    final name = _schoolNameCtrl.text.trim();
    if (name.isEmpty) return;
    try {
      await FirebaseFirestore.instance.collection('schools').add({
        'name': name,
        'createdAt': FieldValue.serverTimestamp(),
      });
      setState(() {
        _msg = 'Skola tillagd!';
        _schoolNameCtrl.clear();
      });
    } catch (e) {
      setState(() => _msg = 'Fel: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Skolor')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            TextField(
              controller: _schoolNameCtrl,
              decoration: const InputDecoration(
                labelText: 'Skolans namn',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 8),
            ElevatedButton(
              onPressed: _addSchool,
              child: const Text('Lägg till skola'),
            ),
            if (_msg != null) ...[
              const SizedBox(height: 8),
              Text(_msg!, style: const TextStyle(color: Colors.green)),
            ],
            const SizedBox(height: 16),
            Expanded(
              child: StreamBuilder<QuerySnapshot>(
                stream: FirebaseFirestore.instance
                    .collection('schools')
                    .orderBy('name')
                    .snapshots(),
                builder: (context, snap) {
                  if (snap.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  final docs = snap.data?.docs ?? [];
                  return ListView(
                    children: docs.map((doc) {
                      final name = doc['name'] ?? '';
                      return ListTile(
                        title: Text(name),
                      );
                    }).toList(),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
