import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:url_launcher/url_launcher.dart';

class AdminScreen extends StatefulWidget {
  const AdminScreen({super.key});

  @override
  State<AdminScreen> createState() => _AdminScreenState();
}

class _AdminScreenState extends State<AdminScreen> {
  int _selectedTabIndex = 0;
  List<Map<String, dynamic>> _allTeachers = [];
  List<Map<String, dynamic>> _allStudents = [];
  final List<Map<String, dynamic>> _pendingTeachers = [];
  bool _loading = true;

  // Form controllers
  final _teacherFirstNameCtrl = TextEditingController();
  final _teacherLastNameCtrl = TextEditingController();
  final _teacherEmailCtrl = TextEditingController();
  final _teacherPasswordCtrl = TextEditingController();
  final _teacherSchoolCtrl = TextEditingController();

  final _studentFirstNameCtrl = TextEditingController();
  final _studentLastNameCtrl = TextEditingController();
  final _studentEmailCtrl = TextEditingController();
  final _studentPasswordCtrl = TextEditingController();

  String? _selectedTeacherId;
  String? _selectedClassId;
  List<Map<String, dynamic>> _classes = [];
  final bool _teacherApproved = true;
  String? _errorMsg;
  final bool _isCreating = false;

  @override
  void initState() {
    super.initState();
    _loadAdminData();
  }

  @override
  void dispose() {
    _teacherFirstNameCtrl.dispose();
    _teacherLastNameCtrl.dispose();
    _teacherEmailCtrl.dispose();
    _teacherPasswordCtrl.dispose();
    _teacherSchoolCtrl.dispose();
    _studentFirstNameCtrl.dispose();
    _studentLastNameCtrl.dispose();
    _studentEmailCtrl.dispose();
    _studentPasswordCtrl.dispose();
    super.dispose();
  }

  Future<void> _openAdminDashboard() async {
    final url = 'https://www.apl-appen.se/dashboard/admin';
    try {
      final uri = Uri.parse(url);
      // Försök först med platformDefault
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.platformDefault);
      } else {
        // Fallback: försök direkt utan att kolla canLaunchUrl
        try {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
        } catch (e) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Kunde inte öppna länken')),
            );
          }
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Fel: $e')),
        );
      }
    }
  }

  Future<void> _loadAdminData() async {
    if (!mounted) return;
    setState(() => _loading = true);
    try {
      // Hämta alla lärare
      final teacherQuery = await FirebaseFirestore.instance
          .collection('users')
          .where('role', isEqualTo: 'teacher')
          .get();

      _allTeachers = teacherQuery.docs.map((doc) {
        return {
          'id': doc.id,
          'name': doc.data()['displayName'] ?? doc.data()['email'] ?? 'Okänd',
          'email': doc.data()['email'] ?? '',
          'school': doc.data()['school'] ?? '',
          'approved': doc.data()['approved'] ?? true,
        };
      }).toList();

      // Hämta alla elever
      final studentQuery = await FirebaseFirestore.instance
          .collection('users')
          .where('role', isEqualTo: 'student')
          .get();

      _allStudents = studentQuery.docs.map((doc) {
        return {
          'id': doc.id,
          'name': doc.data()['displayName'] ?? doc.data()['email'] ?? 'Okänd',
          'email': doc.data()['email'] ?? '',
        };
      }).toList();

      // Hämta alla klasser
      final classQuery = await FirebaseFirestore.instance
          .collection('classes')
          .get();

      _classes = classQuery.docs.map((doc) {
        return {'id': doc.id, 'name': doc.data()['name'] ?? 'Okänd klass'};
      }).toList();

      if (mounted) {
        setState(() => _loading = false);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMsg = 'Fel vid laddning: $e';
          _loading = false;
        });
      }
    }
  }

  Future<void> _createTeacher() async {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Lägg till lärare via hemsidan admin-panelen'),
      ),
    );
  }

  Future<void> _createStudent() async {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Lägg till elev via hemsidan admin-panelen'),
      ),
    );
  }

  Future<void> _deleteUser(String userId, String role) async {
    if (!mounted) return;

    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Bekräfta borttagning'),
        content: Text(
          'Är du säker på att du vill PERMANENT ta bort denna ${role == 'teacher' ? 'lärare' : 'elev'}?\n\nDetta raderar:\n• Användarkontot\n• All data (tidkort, bedömningar)\n• Klassmedlemskap\n\nDetta går INTE att ångra!',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Avbryt'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('TA BORT PERMANENT', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    try {
      final batch = FirebaseFirestore.instance.batch();
      
      // 1. Ta bort användaren från users-kollektionen
      final userRef = FirebaseFirestore.instance.collection('users').doc(userId);
      batch.delete(userRef);

      // 2. Om det är en elev, ta bort från alla klasser
      if (role == 'student') {
        final classesSnap = await FirebaseFirestore.instance
            .collection('classes')
            .get();
        
        for (final classDoc in classesSnap.docs) {
          final studentRef = classDoc.reference
              .collection('students')
              .doc(userId);
          batch.delete(studentRef);
        }

        // 3. Ta bort elevens tidkort
        final timesheetsSnap = await FirebaseFirestore.instance
            .collection('timesheets')
            .where('studentUid', isEqualTo: userId)
            .get();
        
        for (final doc in timesheetsSnap.docs) {
          batch.delete(doc.reference);
        }

        // 4. Ta bort elevens bedömningar
        final assessmentsSnap = await FirebaseFirestore.instance
            .collection('assessments')
            .where('studentUid', isEqualTo: userId)
            .get();
        
        for (final doc in assessmentsSnap.docs) {
          batch.delete(doc.reference);
        }

        // 5. Ta bort elevens bedömningsförfrågningar
        final requestsSnap = await FirebaseFirestore.instance
            .collection('assessmentRequests')
            .where('studentUid', isEqualTo: userId)
            .get();
        
        for (final doc in requestsSnap.docs) {
          batch.delete(doc.reference);
        }
      } else if (role == 'teacher') {
        // För lärare: ta bort deras klasser
        final classesSnap = await FirebaseFirestore.instance
            .collection('classes')
            .where('teacherUid', isEqualTo: userId)
            .get();
        
        for (final doc in classesSnap.docs) {
          batch.delete(doc.reference);
        }
      }

      await batch.commit();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Användare och associerad data permanent borttagen ✅')),
        );
        await _loadAdminData();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Fel vid borttagning: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Admin'),
        actions: [
          IconButton(
            tooltip: 'Logga ut',
            onPressed: () => FirebaseAuth.instance.signOut(),
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Tabs/Navigation
                    Row(
                      children: [
                        _buildTabButton('Lägg till lärare', 0),
                        const SizedBox(width: 8),
                        _buildTabButton('Lägg till elev', 1),
                        const SizedBox(width: 8),
                        _buildTabButton('Hantera', 2),
                      ],
                    ),
                    const SizedBox(height: 20),

                    // Error message
                    if (_errorMsg != null)
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.red.shade100,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.red.shade300),
                        ),
                        child: Text(
                          _errorMsg!,
                          style: TextStyle(color: Colors.red.shade700),
                        ),
                      ),
                    const SizedBox(height: 16),

                    // Tab content
                    if (_selectedTabIndex == 0) _buildAddTeacherForm(),
                    if (_selectedTabIndex == 1) _buildAddStudentForm(),
                    if (_selectedTabIndex == 2) _buildManageUsersTab(),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildTabButton(String label, int index) {
    final isSelected = _selectedTabIndex == index;
    return MaterialButton(
      onPressed: () => setState(() => _selectedTabIndex = index),
      color: isSelected ? Colors.orange : Colors.grey.shade200,
      textColor: isSelected ? Colors.white : Colors.black,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      child: Text(label),
    );
  }

  Widget _buildAddTeacherForm() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Lägg till lärare',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            InkWell(
              onTap: _openAdminDashboard,
              borderRadius: BorderRadius.circular(8),
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.orange.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.orange.shade200),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        'För att lägga till nya lärare, använd admin-panelen på hemsidan: www.apl-appen.se/dashboard/admin',
                        style: TextStyle(
                          color: Colors.orange.shade700,
                          fontSize: 13,
                        ),
                      ),
                    ),
                    Icon(
                      Icons.open_in_new,
                      color: Colors.orange.shade700,
                      size: 18,
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Eller manuelle med formuläret nedan (inte rekommenderat):',
              style: TextStyle(fontSize: 12, color: Colors.grey),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _teacherFirstNameCtrl,
              enabled: false,
              decoration: const InputDecoration(
                labelText: 'Förnamn',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _teacherLastNameCtrl,
              enabled: false,
              decoration: const InputDecoration(
                labelText: 'Efternamn',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _teacherEmailCtrl,
              enabled: false,
              decoration: const InputDecoration(
                labelText: 'E-post',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _teacherPasswordCtrl,
              obscureText: true,
              enabled: false,
              decoration: const InputDecoration(
                labelText: 'Lösenord',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _teacherSchoolCtrl,
              enabled: false,
              decoration: const InputDecoration(
                labelText: 'Skola',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Checkbox(value: _teacherApproved, onChanged: null),
                const Text('Godkänd direkt'),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAddStudentForm() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Lägg till elev',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            InkWell(
              onTap: _openAdminDashboard,
              borderRadius: BorderRadius.circular(8),
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.orange.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.orange.shade200),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        'För att lägga till nya elever, använd admin-panelen på hemsidan: www.apl-appen.se/dashboard/admin',
                        style: TextStyle(
                          color: Colors.orange.shade700,
                          fontSize: 13,
                        ),
                      ),
                    ),
                    Icon(
                      Icons.open_in_new,
                      color: Colors.orange.shade700,
                      size: 18,
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildManageUsersTab() {
    return Column(
      children: [
        // Lärare
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Lärare (${_allTeachers.length})',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 12),
                if (_allTeachers.isEmpty)
                  const Text(
                    'Inga lärare ännu',
                    style: TextStyle(color: Colors.grey),
                  )
                else
                  ..._allTeachers.map((teacher) {
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  teacher['name'],
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                Text(
                                  teacher['email'],
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: Colors.grey,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            onPressed: () =>
                                _deleteUser(teacher['id'], 'teacher'),
                            icon: const Icon(Icons.delete, color: Colors.red),
                            tooltip: 'Ta bort',
                          ),
                        ],
                      ),
                    );
                  }),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),

        // Elever
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Elever (${_allStudents.length})',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 12),
                if (_allStudents.isEmpty)
                  const Text(
                    'Inga elever ännu',
                    style: TextStyle(color: Colors.grey),
                  )
                else
                  ..._allStudents.map((student) {
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  student['name'],
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                Text(
                                  student['email'],
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: Colors.grey,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            onPressed: () =>
                                _deleteUser(student['id'], 'student'),
                            icon: const Icon(Icons.delete, color: Colors.red),
                            tooltip: 'Ta bort',
                          ),
                        ],
                      ),
                    );
                  }),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
