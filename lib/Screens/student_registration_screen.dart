import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:flutter/services.dart';

class StudentRegistrationScreen extends StatefulWidget {
  const StudentRegistrationScreen({super.key});

  @override
  State<StudentRegistrationScreen> createState() => _StudentRegistrationScreenState();
}

class _StudentRegistrationScreenState extends State<StudentRegistrationScreen> {
  String? _selectedClassId;
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  final Set<String> _selectedStudentUids = {};
  bool _selectionMode = false;
  bool _isProcessing = false;

  void _copyToClipboard(String value, String label) {
    Clipboard.setData(ClipboardData(text: value));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('$label kopierad')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser!;

    return Scaffold(
      body: Stack(
        children: [
          Column(
            children: [
              // Selection action bar
              if (_selectionMode)
                Container(
                  color: Colors.grey.shade100,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  child: Row(
                    children: [
                      Text('${_selectedStudentUids.length} markerade'),
                      const SizedBox(width: 8),
                      TextButton.icon(
                        onPressed: _selectAllFiltered,
                        icon: const Icon(Icons.select_all),
                        label: const Text('Markera alla'),
                      ),
                      const Spacer(),
                      TextButton.icon(
                        onPressed: _selectedStudentUids.isEmpty ? null : _bulkMessage,
                        icon: const Icon(Icons.message),
                        label: const Text('Meddela'),
                      ),
                      const SizedBox(width: 8),
                      TextButton.icon(
                        onPressed: _selectedStudentUids.isEmpty ? null : _bulkSetWeeks,
                        icon: const Icon(Icons.calendar_today),
                        label: const Text('Sätt veckor'),
                      ),
                      const SizedBox(width: 8),
                      TextButton.icon(
                        onPressed: _selectedStudentUids.isEmpty ? null : _bulkDelete,
                        icon: const Icon(Icons.delete, color: Colors.red),
                        label: const Text('Ta bort', style: TextStyle(color: Colors.red)),
                      ),
                      IconButton(
                        onPressed: () => setState(() {
                          _selectionMode = false;
                          _selectedStudentUids.clear();
                        }),
                        icon: const Icon(Icons.close),
                      ),
                    ],
                  ),
                ),

              // Klassväljare
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Välj klass eller visa elever utan klass',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: Colors.grey,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
                            stream: FirebaseFirestore.instance
                                .collection('classes')
                                .where('teacherUid', isEqualTo: user.uid)
                                .snapshots(),
                            builder: (context, snap) {
                              if (snap.connectionState == ConnectionState.waiting) {
                                return const CircularProgressIndicator();
                              }

                              final classes = snap.data?.docs ?? [];

                              return DropdownButton<String?>(
                                hint: const Text('Välj klass'),
                                isExpanded: true,
                                value: _selectedClassId == 'UNASSIGNED' ? null : _selectedClassId,
                                items: [
                                  const DropdownMenuItem(
                                    value: null,
                                    child: Text('Alla klasser'),
                                  ),
                                  ...classes.map((doc) => DropdownMenuItem(
                                    value: doc.id,
                                    child: Text(doc.data()['name'] ?? 'Okänd klass'),
                                  )),
                                ],
                                onChanged: (classId) {
                                  setState(() {
                                    _selectedClassId = classId;
                                    _searchQuery = '';
                                    _searchController.clear();
                                  });
                                },
                              );
                            },
                          ),
                        ),
                        const SizedBox(width: 8),
                        ElevatedButton.icon(
                          onPressed: () => setState(() {
                            _selectedClassId = 'UNASSIGNED';
                            _searchQuery = '';
                            _searchController.clear();
                          }),
                          icon: const Icon(Icons.person_add),
                          label: const Text('Utan klass'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              // Elevlista - kombinerar från både users och classes/{classId}/students
              if (_selectedClassId != null && _selectedClassId != 'UNASSIGNED')
                Expanded(
                  child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
                    // Läs ALLA students och filtrera på klient-sidan istället för .where()
                    // Detta undviker Firestore-indexeringsproblem
                    stream: FirebaseFirestore.instance
                        .collection('users')
                        .where('role', isEqualTo: 'student')
                        .snapshots(),
                    builder: (context, usersSnap) {
                      if (usersSnap.connectionState == ConnectionState.waiting) {
                        return const Center(child: CircularProgressIndicator());
                      }

                      // Filtrera på klient-sidan: endast elever med matchande classId
                      // Läs även från classes/{classId}/students för backward compatibility
                      return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
                        stream: FirebaseFirestore.instance
                            .collection('classes')
                            .doc(_selectedClassId)
                            .collection('students')
                            .snapshots(),
                        builder: (context, classStudentsSnap) {
                          if (classStudentsSnap.connectionState == ConnectionState.waiting) {
                            return const Center(child: CircularProgressIndicator());
                          }

                          print('DEBUG SUBCOLLECTION: classId=$_selectedClassId');

                          // Kombinera båda källorna och deduplicera
                          final usersFromUsersCollection2 = (usersSnap.data?.docs ?? []).where((doc) {
                            final data = doc.data();
                            final classId = (data['classId'] ?? '').toString().trim();
                            final teacherUid = (data['teacherUid'] ?? '').toString().trim();
                            return teacherUid == user.uid && classId == _selectedClassId;
                          }).toList();
                          final usersFromClassCollection2 = classStudentsSnap.data?.docs ?? [];

                          final Map<String, Map<String, dynamic>> combined = {};

                          // Lägg till från users
                          for (final doc in usersFromUsersCollection2) {
                            combined[doc.id] = doc.data();
                          }

                          // Lägg till från classes/{classId}/students (överskriver inte befintlig data)
                          for (final doc in usersFromClassCollection2) {
                            if (!combined.containsKey(doc.id)) {
                              combined[doc.id] = doc.data();
                            }
                          }

                          final allStudents = combined.entries
                              .map((e) => MapEntry(e.key, e.value))
                              .toList();

                          // Client-side filter using search query
                          final filtered = _searchQuery.trim().isEmpty
                              ? allStudents
                              : allStudents.where((entry) {
                                  final data = entry.value;
                                  final name = (data['displayName'] ?? '').toString().toLowerCase();
                                  final email = (data['email'] ?? '').toString().toLowerCase();
                                  final q = _searchQuery.toLowerCase();
                                  return name.contains(q) || email.contains(q);
                                }).toList();

                          if (filtered.isEmpty) {
                            return Center(
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    Icons.person_add,
                                    size: 64,
                                    color: Colors.grey.shade300,
                                  ),
                                  const SizedBox(height: 16),
                                  const Text(
                                    'Inga elever i denna klass ännu',
                                    style: TextStyle(
                                      fontSize: 16,
                                      color: Colors.grey,
                                    ),
                                  ),
                                  const SizedBox(height: 16),
                                  ElevatedButton.icon(
                                    onPressed: () => _showSearchAllStudentsDialog(context),
                                    icon: const Icon(Icons.search),
                                    label: const Text('Sök och lägg till elever'),
                                  ),
                                ],
                              ),
                            );
                          }

                          return _buildStudentList(filtered);
                        },
                      );
                    },
                  ),
                )

              // Elevlista för elever UTAN klassilldelning
              else if (_selectedClassId == 'UNASSIGNED')
                Expanded(
                  child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
                    stream: FirebaseFirestore.instance
                        .collection('users')
                        .where('role', isEqualTo: 'student')
                        .snapshots(),
                    builder: (context, snap) {
                      if (snap.connectionState == ConnectionState.waiting) {
                        return const Center(child: CircularProgressIndicator());
                      }

                      // Filtrera bort elever som redan har tilldelats en klass
                      final allUsers = snap.data?.docs ?? [];
                      final unassigned = allUsers
                          .where((doc) {
                            final data = doc.data();
                            final classId = (data['classId'] ?? '').toString().trim();
                            final teacherUid = (data['teacherUid'] ?? '').toString().trim();
                            return teacherUid == user.uid && classId.isEmpty;
                          })
                          .toList();

                      // Client-side filter using search query
                      final filtered = _searchQuery.trim().isEmpty
                          ? unassigned
                          : unassigned.where((doc) {
                              final data = doc.data();
                              final name = (data['displayName'] ?? '').toString().toLowerCase();
                              final email = (data['email'] ?? '').toString().toLowerCase();
                              final q = _searchQuery.toLowerCase();
                              return name.contains(q) || email.contains(q);
                            }).toList();

                      if (filtered.isEmpty) {
                        return Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.person_add_disabled,
                                size: 64,
                                color: Colors.grey.shade300,
                              ),
                              const SizedBox(height: 16),
                              const Text(
                                'Inga elever utan klassilldelning',
                                style: TextStyle(
                                  fontSize: 16,
                                  color: Colors.grey,
                                ),
                              ),
                            ],
                          ),
                        );
                      }

                      // Konvertera till samma format som klassväljaren
                      final entries = filtered
                          .map((doc) => MapEntry(doc.id, doc.data()))
                          .toList();

                      return _buildStudentList(entries);
                    },
                  ),
                ),
            ],
          ),

          // Processing overlay
          if (_isProcessing)
            Positioned.fill(
              child: Container(
                color: Colors.black.withOpacity(0.3),
                child: const Center(
                  child: CircularProgressIndicator(),
                ),
              ),
            ),
        ],
      ),
      floatingActionButton: _selectedClassId != null && _selectedClassId != 'UNASSIGNED'
          ? FloatingActionButton(
              onPressed: () => _showAddStudentDialog(context),
              tooltip: 'Lägg till elev',
              child: const Icon(Icons.person_add),
            )
          : null,
      bottomNavigationBar: Container(
        padding: const EdgeInsets.all(8),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            ElevatedButton.icon(
              onPressed: () => _showCreateClassDialog(context),
              icon: const Icon(Icons.class_),
              label: const Text('Skapa klass'),
            ),
            ElevatedButton.icon(
              onPressed: () => _showGenerateClassCodeDialog(context),
              icon: const Icon(Icons.qr_code),
              label: const Text('Klasskoder'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStudentList(List<MapEntry<String, Map<String, dynamic>>> students) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: TextField(
            controller: _searchController,
            decoration: const InputDecoration(
              prefixIcon: Icon(Icons.search),
              hintText: 'Sök elever (namn eller e-post)',
              border: OutlineInputBorder(),
            ),
            onChanged: (v) => setState(() => _searchQuery = v),
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

              final selected = _selectedStudentUids.contains(uid);

              return Card(
                margin: const EdgeInsets.only(bottom: 12),
                child: ListTile(
                  leading: _selectionMode
                      ? Checkbox(
                          value: selected,
                          onChanged: (v) => setState(() {
                            if (v == true) {
                              _selectedStudentUids.add(uid);
                            } else {
                              _selectedStudentUids.remove(uid);
                            }
                          }),
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
                              displayName.isNotEmpty
                                  ? displayName[0].toUpperCase()
                                  : '?',
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
                  trailing: _selectionMode
                      ? null
                      : PopupMenuButton(
                          itemBuilder: (context) => [
                            PopupMenuItem(
                              child: const Row(
                                children: [
                                  Icon(Icons.edit, size: 20),
                                  SizedBox(width: 8),
                                  Text('Redigera'),
                                ],
                              ),
                              onTap: () {
                                _showEditStudentDialog(
                                  context,
                                  uid,
                                  displayName,
                                  email,
                                );
                              },
                            ),
                            if (_selectedClassId != 'UNASSIGNED')
                              PopupMenuItem(
                                child: const Row(
                                  children: [
                                    Icon(Icons.delete, size: 20, color: Colors.red),
                                    SizedBox(width: 8),
                                    Text('Ta bort', style: TextStyle(color: Colors.red)),
                                  ],
                                ),
                                onTap: () {
                                  _showDeleteConfirmation(context, uid);
                                },
                              ),
                          ],
                        ),
                  onLongPress: () => setState(() {
                    _selectionMode = true;
                    _selectedStudentUids.add(uid);
                  }),
                  onTap: () {
                    if (_selectionMode) {
                      setState(() {
                        if (selected) {
                          _selectedStudentUids.remove(uid);
                        } else {
                          _selectedStudentUids.add(uid);
                        }
                      });
                    }
                  },
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  void _showAddStudentDialog(BuildContext context) {
    final nameController = TextEditingController();
    final emailController = TextEditingController();

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Lägg till elev'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameController,
              decoration: const InputDecoration(
                labelText: 'Namn',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: emailController,
              decoration: const InputDecoration(
                labelText: 'E-post',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Avbryt'),
          ),
          ElevatedButton(
            onPressed: () async {
              if (nameController.text.isEmpty || emailController.text.isEmpty) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Fyll i alla fält')),
                );
                return;
              }

              try {
                // Hämta lärarens UID från den valda klassen
                final classDoc = await FirebaseFirestore.instance
                    .collection('classes')
                    .doc(_selectedClassId)
                    .get();
                
                final teacherUid = classDoc.data()?['teacherUid'] as String?;
                
                if (teacherUid == null) {
                  throw Exception('Kunde inte hitta lärare för denna klass');
                }

                // Skapa användarens dokument i users-kollektionen
                final newStudentUid = FirebaseFirestore.instance
                    .collection('users')
                    .doc()
                    .id;

                await FirebaseFirestore.instance
                    .collection('users')
                    .doc(newStudentUid)
                    .set({
                  'displayName': nameController.text,
                  'email': emailController.text,
                  'classId': _selectedClassId,
                  'teacherUid': teacherUid,
                  'role': 'student',
                  'createdAt': FieldValue.serverTimestamp(),
                });

                // Lägg till eleven i klassens students-underkollektionen
                await FirebaseFirestore.instance
                    .collection('classes')
                    .doc(_selectedClassId)
                    .collection('students')
                    .doc(newStudentUid)
                    .set({
                  'displayName': nameController.text,
                  'email': emailController.text,
                  'uid': newStudentUid,
                });

                if (context.mounted) {
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Elev tillagd ✅')),
                  );
                }
              } catch (e) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Fel: $e')),
                  );
                }
              }
            },
            child: const Text('Lägg till'),
          ),
        ],
      ),
    );
  }

  void _showEditStudentDialog(
    BuildContext context,
    String studentUid,
    String currentName,
    String currentEmail,
  ) {
    final nameController = TextEditingController(text: currentName);
    final emailController = TextEditingController(text: currentEmail);
    String? selectedRole;
    String? selectedNewClass = _selectedClassId == 'UNASSIGNED' ? null : _selectedClassId;

    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: const Text('Redigera elev'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextField(
                  controller: nameController,
                  decoration: const InputDecoration(
                    labelText: 'Namn',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: emailController,
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
                  value: selectedRole,
                  hint: const Text('Välj yrkesutgång'),
                  items: [
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
                  onChanged: (value) {
                    setState(() => selectedRole = value);
                  },
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
                      .where('teacherUid',
                          isEqualTo: FirebaseAuth.instance.currentUser!.uid)
                      .snapshots(),
                  builder: (context, classSnap) {
                    if (classSnap.connectionState == ConnectionState.waiting) {
                      return const CircularProgressIndicator();
                    }
                    final classes = classSnap.data?.docs ?? [];
                    return DropdownButton<String>(
                      isExpanded: true,
                      value: selectedNewClass,
                      items: classes
                          .map((doc) => DropdownMenuItem(
                                value: doc.id,
                                child: Text(doc['name'] ?? 'Namnlös klass'),
                              ))
                          .toList(),
                      onChanged: (value) {
                        setState(() => selectedNewClass = value);
                      },
                    );
                  },
                ),
              ],
            ),
          ),
          actions: [
            // Ta bort från klass-knapp (till vänster)
            if (_selectedClassId != null && _selectedClassId != 'UNASSIGNED')
              TextButton.icon(
                onPressed: () async {
                  final confirm = await showDialog<bool>(
                    context: context,
                    builder: (context) => AlertDialog(
                      title: const Text('Ta bort från klass'),
                      content: Text('Ta bort ${nameController.text} från denna klass?'),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(context, false),
                          child: const Text('Avbryt'),
                        ),
                        ElevatedButton(
                          onPressed: () => Navigator.pop(context, true),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.red,
                          ),
                          child: const Text('Ta bort'),
                        ),
                      ],
                    ),
                  );

                  if (confirm == true) {
                    try {
                      // Ta bort från klassens students subcollection
                      await FirebaseFirestore.instance
                          .collection('classes')
                          .doc(_selectedClassId)
                          .collection('students')
                          .doc(studentUid)
                          .delete();

                      // Ta bort classId från users
                      await FirebaseFirestore.instance
                          .collection('users')
                          .doc(studentUid)
                          .update({'classId': FieldValue.delete()});

                      if (context.mounted) {
                        Navigator.pop(context); // Stäng redigeringsdialogen
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('${nameController.text} borttagen från klassen')),
                        );
                      }
                    } catch (e) {
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('Fel: $e')),
                        );
                      }
                    }
                  }
                },
                icon: const Icon(Icons.remove_circle, color: Colors.red),
                label: const Text('Ta bort från klass', style: TextStyle(color: Colors.red)),
              ),
            const Spacer(),
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Avbryt'),
            ),
            ElevatedButton(
              onPressed: () async {
                try {
                  Map<String, dynamic> updates = {
                    'displayName': nameController.text,
                    'email': emailController.text,
                  };
                  if (selectedRole != null) {
                    updates['role_type'] = selectedRole;
                  }

                  // Uppdatera i users-kollektionen
                  await FirebaseFirestore.instance
                      .collection('users')
                      .doc(studentUid)
                      .update(updates);

                  // Uppdatera i klassens students-underkollektionen
                  if (selectedNewClass != null) {
                    // Hämta teacherUid från den nya klassen
                    final newClassDoc = await FirebaseFirestore.instance
                        .collection('classes')
                        .doc(selectedNewClass)
                        .get();
                    
                    final teacherUid = newClassDoc.data()?['teacherUid'] as String?;

                    // Minska från gamla klassen om det finns
                    if (_selectedClassId != null && _selectedClassId != 'UNASSIGNED') {
                      await FirebaseFirestore.instance
                          .collection('classes')
                          .doc(_selectedClassId)
                          .collection('students')
                          .doc(studentUid)
                          .delete();
                    }

                    // Lägga till i nya klassen
                    await FirebaseFirestore.instance
                        .collection('classes')
                        .doc(selectedNewClass)
                        .collection('students')
                        .doc(studentUid)
                        .set({
                      'displayName': nameController.text,
                      'email': emailController.text,
                      'role_type': ?selectedRole,
                    });

                    // Uppdatera classId och teacherUid i users
                    Map<String, dynamic> userUpdates = {'classId': selectedNewClass};
                    if (teacherUid != null) {
                      userUpdates['teacherUid'] = teacherUid;
                    }
                    
                    await FirebaseFirestore.instance
                        .collection('users')
                        .doc(studentUid)
                        .update(userUpdates);
                  } else {
                    await FirebaseFirestore.instance
                        .collection('classes')
                        .doc(_selectedClassId)
                        .collection('students')
                        .doc(studentUid)
                        .update({
                      'displayName': nameController.text,
                      'email': emailController.text,
                      'role_type': ?selectedRole,
                    });
                  }

                  if (context.mounted) {
                    Navigator.pop(context);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Elev uppdaterad ✅')),
                    );
                  }
                } catch (e) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Fel: $e')),
                    );
                  }
                }
              },
              child: const Text('Uppdatera'),
            ),
          ],
        ),
      ),
    );
  }

  void _showDeleteConfirmation(BuildContext context, String studentUid) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Koppla bort elev?'),
        content: const Text(
          'Detta tar bort eleven från din klass. Eleven behåller sitt konto och kan kopplas till en annan lärare.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Avbryt'),
          ),
          ElevatedButton(
            onPressed: () async {
              try {
                // Ta INTE bort från users-kollektionen, bara koppla bort
                await FirebaseFirestore.instance
                    .collection('users')
                    .doc(studentUid)
                    .update({
                      'teacherUid': '',
                      'classId': '',
                    });

                // Ta bort från klassens students-underkollektionen
                await FirebaseFirestore.instance
                    .collection('classes')
                    .doc(_selectedClassId)
                    .collection('students')
                    .doc(studentUid)
                    .delete();

                if (context.mounted) {
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Elev bortkopplad från klassen ✅')),
                  );
                }
              } catch (e) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Fel: $e')),
                  );
                }
              }
            },
            child: const Text('Koppla bort'),
          ),
        ],
      ),
    );
  }

  Future<void> _bulkDelete() async {
    if (_selectedClassId == null || _selectedStudentUids.isEmpty) return;
    setState(() => _isProcessing = true);
    final confirm = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Koppla bort markerade elever?'),
        content: const Text('Detta tar bort eleverna från klassen men de behåller sina konton.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Avbryt')),
          ElevatedButton(onPressed: () => Navigator.pop(c, true), child: const Text('Koppla bort')),
        ],
      ),
    );
    if (confirm != true) {
      setState(() => _isProcessing = false);
      return;
    }

    final batch = FirebaseFirestore.instance.batch();
    try {
      for (final uid in _selectedStudentUids) {
        // Koppla bort eleven från lärare och klass
        final userRef = FirebaseFirestore.instance.collection('users').doc(uid);
        batch.update(userRef, {
          'teacherUid': '',
          'classId': '',
        });
        
        // Ta bort från klassens students-underkollektionen
        final classRef = FirebaseFirestore.instance
            .collection('classes')
            .doc(_selectedClassId)
            .collection('students')
            .doc(uid);
        batch.delete(classRef);
      }
      await batch.commit();
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Markerade elever bortkopplade från klassen')));
        setState(() {
          _selectionMode = false;
          _selectedStudentUids.clear();
          _isProcessing = false;
        });
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Fel: $e')));
        setState(() => _isProcessing = false);
      }
    }
  }

  Future<void> _bulkMessage() async {
    if (_selectedStudentUids.isEmpty) return;
    setState(() => _isProcessing = true);
    final ctrl = TextEditingController();
    final send = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Skicka meddelande till markerade'),
        content: TextField(
          controller: ctrl,
          maxLines: 4,
          decoration: const InputDecoration(hintText: 'Skriv meddelande...'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Avbryt')),
          ElevatedButton(onPressed: () => Navigator.pop(c, true), child: const Text('Skicka')),
        ],
      ),
    );
    if (send != true) {
      setState(() => _isProcessing = false);
      return;
    }
    final now = FieldValue.serverTimestamp();
    try {
      for (final uid in _selectedStudentUids) {
        await FirebaseFirestore.instance.collection('messages').add({
          'to': uid,
          'from': FirebaseAuth.instance.currentUser?.uid,
          'message': ctrl.text,
          'createdAt': now,
        });
      }
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Meddelanden skickade')));
        setState(() {
          _selectionMode = false;
          _selectedStudentUids.clear();
          _isProcessing = false;
        });
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Fel: $e')));
        setState(() => _isProcessing = false);
      }
    }
  }

  Future<void> _bulkSetWeeks() async {
    if (_selectedClassId == null || _selectedStudentUids.isEmpty) return;
    setState(() => _isProcessing = true);
    final ctrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Ange veckor att aktivera (komma-separerat)'),
        content: TextField(
          controller: ctrl,
          decoration: const InputDecoration(hintText: 't.ex. 1,2,3,12'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Avbryt')),
          ElevatedButton(onPressed: () => Navigator.pop(c, true), child: const Text('Spara')),
        ],
      ),
    );
    if (ok != true) {
      setState(() => _isProcessing = false);
      return;
    }
    final parts = ctrl.text.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty).toList();
    final Map<String, bool> weekMap = { for (var i = 1; i <= 52; i++) i.toString(): false };
    for (final p in parts) {
      final n = int.tryParse(p);
      if (n != null && n >= 1 && n <= 52) weekMap[n.toString()] = true;
    }

    try {
      final batch = FirebaseFirestore.instance.batch();
      for (final uid in _selectedStudentUids) {
        final ref = FirebaseFirestore.instance
            .collection('classes')
            .doc(_selectedClassId)
            .collection('studentWeekOverrides')
            .doc(uid);
        batch.set(ref, {'weekEnabled': weekMap}, SetOptions(merge: true));
      }
      await batch.commit();
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Veckor uppdaterade för markerade elever')));
        setState(() {
          _selectionMode = false;
          _selectedStudentUids.clear();
          _isProcessing = false;
        });
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Fel: $e')));
        setState(() => _isProcessing = false);
      }
    }
  }

  Future<void> _selectAllFiltered() async {
    if (_selectedClassId == null) return;
    setState(() => _isProcessing = true);
    try {
      final snap = await FirebaseFirestore.instance
          .collection('classes')
          .doc(_selectedClassId)
          .collection('students')
          .get();
      final docs = snap.docs;
      final q = _searchQuery.toLowerCase().trim();
      final toSelect = q.isEmpty
          ? docs.map((d) => d.id).toList()
          : docs.where((d) {
              final data = d.data();
              final name = (data['displayName'] ?? '').toString().toLowerCase();
              final email = (data['email'] ?? '').toString().toLowerCase();
              return name.contains(q) || email.contains(q);
            }).map((d) => d.id).toList();

      setState(() {
        _selectedStudentUids.clear();
        _selectedStudentUids.addAll(toSelect);
        _selectionMode = true;
        _isProcessing = false;
      });
    } catch (e) {
      setState(() => _isProcessing = false);
      if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Fel vid markera alla: $e')));
    }
  }

  void _showSearchAllStudentsDialog(BuildContext context) {
    final searchController = TextEditingController();
    List<QueryDocumentSnapshot<Map<String, dynamic>>> allStudents = [];
    List<QueryDocumentSnapshot<Map<String, dynamic>>> filteredStudents = [];

    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Sök och lägg till elever'),
          content: SizedBox(
            width: double.maxFinite,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: searchController,
                  decoration: const InputDecoration(
                    prefixIcon: Icon(Icons.search),
                    hintText: 'Sök elev (namn eller e-post)',
                    border: OutlineInputBorder(),
                  ),
                  onChanged: (v) {
                    setDialogState(() {
                      final q = v.toLowerCase().trim();
                      filteredStudents = allStudents
                          .where((doc) {
                            final data = doc.data();
                            final name = (data['displayName'] ?? '').toString().toLowerCase();
                            final email = (data['email'] ?? '').toString().toLowerCase();
                            return name.contains(q) || email.contains(q);
                          })
                          .toList();
                    });
                  },
                  onTap: () async {
                    if (allStudents.isEmpty) {
                      final snap = await FirebaseFirestore.instance
                          .collection('users')
                          .where('role', isEqualTo: 'student')
                          .get();
                      setDialogState(() {
                        allStudents = snap.docs;
                        filteredStudents = snap.docs;
                      });
                    }
                  },
                ),
                const SizedBox(height: 16),
                Expanded(
                  child: filteredStudents.isEmpty
                      ? const Center(child: Text('Inga elever hittades'))
                      : ListView.builder(
                          itemCount: filteredStudents.length,
                          itemBuilder: (context, index) {
                            final doc = filteredStudents[index];
                            final data = doc.data();
                            final displayName = data['displayName'] ?? 'Okänd';
                            final email = data['email'] ?? '';
                            final currentClassId = data['classId'] ?? '';

                            return Card(
                              margin: const EdgeInsets.only(bottom: 8),
                              child: ListTile(
                                title: Text(displayName),
                                subtitle: Text('$email\nKlass: ${currentClassId.isEmpty ? "Ingen" : currentClassId}'),
                                trailing: Icon(
                                  currentClassId == _selectedClassId
                                      ? Icons.check_circle
                                      : Icons.add_circle_outline,
                                  color: currentClassId == _selectedClassId ? Colors.green : Colors.grey,
                                ),
                                onTap: () async {
                                  // Uppdatera elevens classId
                                  await FirebaseFirestore.instance
                                      .collection('users')
                                      .doc(doc.id)
                                      .set(
                                        {'classId': _selectedClassId},
                                        SetOptions(merge: true),
                                      );

                                  // Lägg också till i subcollection för backward compatibility
                                  if (_selectedClassId != null) {
                                    await FirebaseFirestore.instance
                                        .collection('classes')
                                        .doc(_selectedClassId)
                                        .collection('students')
                                        .doc(doc.id)
                                        .set(
                                          {
                                            'displayName': displayName,
                                            'email': email,
                                            'role': 'student',
                                          },
                                          SetOptions(merge: true),
                                        );
                                  }

                                  if (context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(content: Text('$displayName tilldelad klassen')),
                                    );
                                    // Stäng dialogen
                                    Navigator.pop(context);
                                  }
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
              onPressed: () => Navigator.pop(context),
              child: const Text('Stäng'),
            ),
          ],
        ),
      ),
    );
  }

  // Skapa ny klass
  void _showCreateClassDialog(BuildContext context) {
    final nameController = TextEditingController();
    final user = FirebaseAuth.instance.currentUser!;

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Skapa ny klass'),
        content: TextField(
          controller: nameController,
          decoration: const InputDecoration(
            labelText: 'Klassnamn (ex: BA23, EL24)',
            border: OutlineInputBorder(),
          ),
          autofocus: true,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Avbryt'),
          ),
          ElevatedButton(
            onPressed: () async {
              final className = nameController.text.trim();
              if (className.isEmpty) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Ange klassnamn')),
                );
                return;
              }

              // Skapa klassID med lärarens UID + klassnamn
              final classId = '${user.uid}_$className';

              try {
                await FirebaseFirestore.instance
                    .collection('classes')
                    .doc(classId)
                    .set({
                  'name': className,
                  'teacherUid': user.uid,
                  'createdAt': FieldValue.serverTimestamp(),
                  'weekEnabled': <String, bool>{}, // Tom veckkonfiguration
                });

                if (context.mounted) {
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Klass "$className" skapad!')),
                  );
                  
                  // Välj den nya klassen automatiskt
                  setState(() {
                    _selectedClassId = classId;
                  });
                }
              } catch (e) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Fel: $e')),
                  );
                }
              }
            },
            child: const Text('Skapa'),
          ),
        ],
      ),
    );
  }

  // Generera klasskod för QR-skanning eller manuell inmatning
  void _showGenerateClassCodeDialog(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser!;

    showDialog(
      context: context,
      builder: (context) => StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
        stream: FirebaseFirestore.instance
            .collection('classes')
            .where('teacherUid', isEqualTo: user.uid)
            .snapshots(),
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const AlertDialog(
              title: Text('Generera klasskod'),
              content: CircularProgressIndicator(),
            );
          }

          final classes = snap.data?.docs ?? [];

          if (classes.isEmpty) {
            return AlertDialog(
              title: const Text('Generera klasskod'),
              content: const Text('Du har inga klasser än. Skapa en klass först.'),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('OK'),
                ),
              ],
            );
          }

          return AlertDialog(
            title: const Text('Generera klasskod'),
            content: SizedBox(
              width: double.maxFinite,
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: classes.length,
                itemBuilder: (context, index) {
                  final doc = classes[index];
                  final className = doc.data()['name'] ?? 'Okänd klass';
                  final classId = doc.id;

                  return Card(
                    child: ListTile(
                      title: Text(className),
                      subtitle: SelectableText(
                        'Klasskod: $classId',
                        style: const TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 12,
                        ),
                      ),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            icon: const Icon(Icons.qr_code),
                            onPressed: () {
                              showDialog(
                                context: context,
                                useRootNavigator: true,
                                builder: (ctx) => Dialog(
                                  child: Padding(
                                    padding: const EdgeInsets.all(16),
                                    child: ConstrainedBox(
                                      constraints: const BoxConstraints(maxWidth: 320),
                                      child: SingleChildScrollView(
                                        child: Column(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Text(
                                              'QR-kod för $className',
                                              style: Theme.of(ctx).textTheme.titleMedium,
                                              textAlign: TextAlign.center,
                                            ),
                                            const SizedBox(height: 16),
                                            SizedBox(
                                              width: 200,
                                              height: 200,
                                              child: QrImageView(
                                                data: classId,
                                                version: QrVersions.auto,
                                              ),
                                            ),
                                            const SizedBox(height: 16),
                                            SelectableText(
                                              'Klasskod: $classId',
                                              style: const TextStyle(
                                                fontFamily: 'monospace',
                                                fontWeight: FontWeight.bold,
                                              ),
                                              textAlign: TextAlign.center,
                                            ),
                                            const SizedBox(height: 8),
                                            ElevatedButton.icon(
                                              onPressed: () => _copyToClipboard(classId, 'Klasskod'),
                                              icon: const Icon(Icons.copy),
                                              label: const Text('Kopiera klasskod'),
                                            ),
                                            const SizedBox(height: 8),
                                            const Text(
                                              'Elever kan skanna denna QR-kod eller ange klasskoden manuellt när de skapar sitt konto',
                                              textAlign: TextAlign.center,
                                              style: TextStyle(fontSize: 12, color: Colors.grey),
                                            ),
                                            const SizedBox(height: 8),
                                            TextButton(
                                              onPressed: () => Navigator.pop(ctx),
                                              child: const Text('Stäng'),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              );
                            },
                            tooltip: 'Visa QR-kod',
                          ),
                          IconButton(
                            icon: const Icon(Icons.copy),
                            onPressed: () {
                              _copyToClipboard(classId, 'Klasskod');
                            },
                            tooltip: 'Kopiera klasskod',
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Stäng'),
              ),
            ],
          );
        },
      ),
    );
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }
}
