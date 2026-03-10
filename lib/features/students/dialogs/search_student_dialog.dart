import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

class SearchStudentDialog extends StatefulWidget {
  final Future<List<QueryDocumentSnapshot<Map<String, dynamic>>>> Function() loadStudents;
  final Future<void> Function(String uid, String displayName, String email) onAssign;
  final String? selectedClassId;

  const SearchStudentDialog({
    super.key,
    required this.loadStudents,
    required this.onAssign,
    required this.selectedClassId,
  });

  @override
  State<SearchStudentDialog> createState() => _SearchStudentDialogState();
}

class _SearchStudentDialogState extends State<SearchStudentDialog> {
  final TextEditingController _searchController = TextEditingController();
  List<QueryDocumentSnapshot<Map<String, dynamic>>> _allStudents = [];
  List<QueryDocumentSnapshot<Map<String, dynamic>>> _filteredStudents = [];

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _filter(String value) {
    final q = value.toLowerCase().trim();
    setState(() {
      _filteredStudents = _allStudents.where((doc) {
        final data = doc.data();
        final name = (data['displayName'] ?? '').toString().toLowerCase();
        final email = (data['email'] ?? '').toString().toLowerCase();
        return name.contains(q) || email.contains(q);
      }).toList();
    });
  }

  Future<void> _ensureLoaded() async {
    if (_allStudents.isNotEmpty) return;
    final students = await widget.loadStudents();
    if (!mounted) return;
    setState(() {
      _allStudents = students;
      _filteredStudents = students;
    });
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Sök och lägg till elever'),
      content: SizedBox(
        width: double.maxFinite,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _searchController,
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.search),
                hintText: 'Sök elev (namn eller e-post)',
                border: OutlineInputBorder(),
              ),
              onChanged: _filter,
              onTap: _ensureLoaded,
            ),
            const SizedBox(height: 16),
            Expanded(
              child: _filteredStudents.isEmpty
                  ? const Center(child: Text('Inga elever hittades'))
                  : ListView.builder(
                      itemCount: _filteredStudents.length,
                      itemBuilder: (context, index) {
                        final doc = _filteredStudents[index];
                        final data = doc.data();
                        final displayName = (data['displayName'] ?? 'Okänd').toString();
                        final email = (data['email'] ?? '').toString();
                        final currentClassId = (data['classId'] ?? '').toString();

                        return Card(
                          margin: const EdgeInsets.only(bottom: 8),
                          child: ListTile(
                            title: Text(displayName),
                            subtitle: Text(
                              '$email\nKlass: ${currentClassId.isEmpty ? "Ingen" : currentClassId}',
                            ),
                            trailing: Icon(
                              currentClassId == widget.selectedClassId
                                  ? Icons.check_circle
                                  : Icons.add_circle_outline,
                              color: currentClassId == widget.selectedClassId
                                  ? Colors.green
                                  : Colors.grey,
                            ),
                            onTap: () async {
                              await widget.onAssign(doc.id, displayName, email);
                              if (!mounted) return;
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('$displayName tilldelad klassen')),
                              );
                              Navigator.of(context).pop();
                            },
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Stäng'),
        ),
      ],
    );
  }
}
