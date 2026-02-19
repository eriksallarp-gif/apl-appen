import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'dart:math';
import 'firebase_options.dart';

const activityTemplate = <Map<String, dynamic>>[
  {
    "group": "Formsättning",
    "items": ["Formbyggnad", "Elementform", "Demontering"]
  },
  {
    "group": "Armering och betong",
    "items": ["Armering", "Betong"]
  },
  {
    "group": "Utvändigt arbete",
    "items": ["Utvändig beklädnad", "Tak", "Dörrar & Fönster"]
  },
  {
    "group": "Stomme och beklädnad",
    "items": ["Stolpverk", "Bjälklag"]
  },
  {
    "group": "Invändigt arbete",
    "items": ["Inredning", "Snickerier", "Invändig beklädnad", "Dörrar", "Golv"]
  },
  {
    "group": "Isolering",
    "items": ["Värme/ljud/brand", "Fuktisolering"]
  },
  {
    "group": "Reparationer",
    "items": ["Demontering/Rivning", "Återmontering"]
  },
  {
    "group": "Miljö / Övrigt",
    "items": ["Miljö", "Hjälparbeten", "Skyddsarbeten", "Övrigt"]
  }
];

class WeeklyTimesheetScreen extends StatefulWidget {
  final String studentUid;
  final String teacherUid;
  final String weekStart; // YYYY-MM-DD
  final bool readOnly; // true för lärare-läge

  const WeeklyTimesheetScreen({
    super.key,
    required this.studentUid,
    required this.teacherUid,
    required this.weekStart,
    required this.readOnly,
  });

  @override
  State<WeeklyTimesheetScreen> createState() => _WeeklyTimesheetScreenState();
}

class _WeeklyTimesheetScreenState extends State<WeeklyTimesheetScreen> {
  final _controllers = <String, Map<String, TextEditingController>>{};
  bool _saving = false;
  String? _msg;

  static const _days = ['mon', 'tue', 'wed', 'thu', 'fri'];
  static const _dayLabel = {'mon': 'Mån', 'tue': 'Tis', 'wed': 'Ons', 'thu': 'Tor', 'fri': 'Fre'};

  @override
  void initState() {
    super.initState();
    // Skapa controllers för alla rader/dagar
    for (final g in activityTemplate) {
      for (final item in (g['items'] as List)) {
        final name = item.toString();
        _controllers[name] = {
          for (final day in _days) day: TextEditingController(text: ''),
        };
      }
    }
  }

  @override
  void dispose() {
    for (final row in _controllers.values) {
      for (final c in row.values) {
        c.dispose();
      }
    }
    super.dispose();
  }

  Map<String, dynamic> _buildEntries() {
    final out = <String, dynamic>{};
    for (final entry in _controllers.entries) {
      final activity = entry.key;
      final dayMap = <String, int>{};
      for (final day in _days) {
        final raw = entry.value[day]!.text.trim();
        final val = int.tryParse(raw);
        dayMap[day] = val ?? 0;
      }
      out[activity] = dayMap;
    }
    return out;
  }

  int _sumWeek() {
    int sum = 0;
    for (final row in _controllers.values) {
      for (final day in _days) {
        sum += int.tryParse(row[day]!.text.trim()) ?? 0;
      }
    }
    return sum;
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _msg = null;
    });
final docId = '${widget.studentUid}_${widget.weekStart}';
final snap = await FirebaseFirestore.instance.collection('timesheets').doc(docId).get();
final approved = (snap.data()?['approved'] ?? false) == true;
if (approved) {
  setState(() => _msg = 'Tidkortet är godkänt och låst.');
  return;
}

    try {
      final docId = '${widget.studentUid}_${widget.weekStart}';
      await FirebaseFirestore.instance.collection('timesheets').doc(docId).set({
        'studentUid': widget.studentUid,
        'teacherUid': widget.teacherUid,
        'weekStart': widget.weekStart,
        'entries': _buildEntries(),
        'updatedAt': FieldValue.serverTimestamp(),
        // approved hanteras av lärare, men vi lämnar fältet om det finns
      }, SetOptions(merge: true));

      setState(() => _msg = 'Sparat ✅');
    } catch (e) {
      setState(() => _msg = 'Fel: $e');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final docId = '${widget.studentUid}_${widget.weekStart}';
    final docStream = FirebaseFirestore.instance.collection('timesheets').doc(docId).snapshots();

    return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      stream: docStream,
      builder: (context, snap) {
        final data = snap.data?.data();
        final entries = (data?['entries'] as Map?)?.cast<String, dynamic>();
        final approved = (data?['approved'] ?? false) as bool;
        final effectiveReadOnly = widget.readOnly || approved;


        // Fyll controllers från Firestore när data finns
        if (entries != null) {
          for (final e in entries.entries) {
            final activity = e.key;
            final dayMap = (e.value as Map?)?.cast<String, dynamic>() ?? {};
            final row = _controllers[activity];
            if (row != null) {
              for (final day in _days) {
                final v = (dayMap[day] ?? 0).toString();
                if (row[day]!.text != v) row[day]!.text = v;
              }
            }
          }
        }

        return Scaffold(
          appBar: AppBar(
            title: Text('Tidkort v. start ${widget.weekStart}'),
            actions: [
              if (!effectiveReadOnly)
                IconButton(
                  tooltip: 'Spara',
                  onPressed: _saving ? null : _save,
                  icon: const Icon(Icons.save),
                ),
              if (widget.readOnly)
                IconButton(
                  tooltip: approved ? 'Avmarkera godkänd' : 'Markera godkänd',
                  onPressed: () async {
                    await FirebaseFirestore.instance
                        .collection('timesheets')
                        .doc(docId)
                        .set({'approved': !approved}, SetOptions(merge: true));
                  },
                  icon: Icon(approved ? Icons.check_circle : Icons.check_circle_outline),
                ),
            ],
          ),
          body: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(child: Text('Summa vecka: ${_sumWeek()} h')),
                    if (approved) const Text('GODKÄND ✅ (låst)', style: TextStyle(fontWeight: FontWeight.bold)),
                  ],
                ),
                if (_msg != null) Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(_msg!),
                ),
                const SizedBox(height: 8),
                Expanded(
                  child: ListView(
                    children: [
                      for (final g in activityTemplate) ...[
                        Text(
                          g['group'].toString(),
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 6),
                        for (final item in (g['items'] as List)) ...[
                          _TimesheetRow(
                            label: item.toString(),
                            controllers: _controllers[item.toString()]!,
                            readOnly: effectiveReadOnly,
                          ),
                          const SizedBox(height: 8),
                        ],
                        const Divider(height: 24),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
          bottomNavigationBar: Padding(
            padding: const EdgeInsets.all(8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: _days.map((d) => Text(_dayLabel[d]!, style: const TextStyle(fontWeight: FontWeight.bold))).toList(),
            ),
          ),
          floatingActionButton: effectiveReadOnly
              ? null
              : FloatingActionButton.extended(
                  onPressed: _saving ? null : _save,
                  icon: const Icon(Icons.save),
                  label: const Text('Spara'),
                ),
        );
      },
    );
  }
}

class _TimesheetRow extends StatelessWidget {
  final String label;
  final Map<String, TextEditingController> controllers;
  final bool readOnly;

  const _TimesheetRow({
    required this.label,
    required this.controllers,
    required this.readOnly,
  });

  static const _days = ['mon', 'tue', 'wed', 'thu', 'fri'];

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            Row(
              children: [
                for (final day in _days) ...[
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: TextField(
                        controller: controllers[day],
                        readOnly: readOnly,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          isDense: true,
                          border: OutlineInputBorder(),
                          hintText: '0',
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}
class StudentWeeklyTimesheetHome extends StatelessWidget {
  const StudentWeeklyTimesheetHome({super.key});

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser!;
    final userDocStream =
        FirebaseFirestore.instance.collection('users').doc(user.uid).snapshots();

    return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      stream: userDocStream,
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }

        final data = snap.data?.data() ?? {};
        final teacherUid = (data['teacherUid'] ?? '').toString().trim();

        if (teacherUid.isEmpty) {
          return const Center(child: Text('Ingen lärare kopplad.'));
        }

        // Räkna ut måndag denna vecka
        final now = DateTime.now();
        final monday =
            now.subtract(Duration(days: now.weekday - DateTime.monday));
        final weekStart =
            '${monday.year}-${monday.month.toString().padLeft(2, '0')}-${monday.day.toString().padLeft(2, '0')}';

        return WeeklyTimesheetScreen(
          studentUid: user.uid,
          teacherUid: teacherUid,
          weekStart: weekStart,
          readOnly: false, // elev får redigera
        );
      },
    );
  }
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  runApp(const AplApp());
}

class AplApp extends StatelessWidget {
  const AplApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      home: AuthGate(),
    );
  }
}

class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<User?>(
      stream: FirebaseAuth.instance.authStateChanges(),
      builder: (context, authSnap) {
        if (authSnap.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        final user = authSnap.data;
        if (user == null) return const LoginScreen();

        return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
          stream: FirebaseFirestore.instance
              .collection('users')
              .doc(user.uid)
              .snapshots(),
          builder: (context, profileSnap) {
            if (profileSnap.connectionState == ConnectionState.waiting) {
              return const Scaffold(
                body: Center(child: CircularProgressIndicator()),
              );
            }

            final data = profileSnap.data?.data();
            final role = (data?['role'] ?? 'student')
                .toString()
                .trim()
                .toLowerCase();
final displayName = (data?['displayName'] ?? '').toString().trim();
if (displayName.isEmpty) {
  return const ProfileSetupScreen();
}

switch (role) {
  case 'admin':
    return AdminHome();

  case 'teacher':
    return TeacherHome();

  default: // student
    final teacherUid = (data?['teacherUid'] ?? '').toString().trim();

    if (teacherUid.isNotEmpty) {
      return const MainNavigation();
    }
    return StudentHome();
}

          },
        );
      },
    );
  }
}

class ProfileSetupScreen extends StatefulWidget {
  const ProfileSetupScreen({super.key});

  @override
  State<ProfileSetupScreen> createState() => _ProfileSetupScreenState();
}

class _ProfileSetupScreenState extends State<ProfileSetupScreen> {
  final _nameCtrl = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _nameCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) {
        setState(() => _error = 'Du är inte inloggad.');
        return;
      }

      final name = _nameCtrl.text.trim();
      if (name.isEmpty) {
        setState(() => _error = 'Skriv ditt namn.');
        return;
      }

      // Spara i Firestore-profilen
      await FirebaseFirestore.instance.collection('users').doc(user.uid).set({
        'displayName': name,
      }, SetOptions(merge: true));

      // (Valfritt men bra) Spara även i Firebase Auth-profilen
      await user.updateDisplayName(name);
    } catch (e) {
      setState(() => _error = 'Fel: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Fyll i din profil'),
        actions: [
          IconButton(
            tooltip: 'Logga ut',
            onPressed: () => FirebaseAuth.instance.signOut(),
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Skriv ditt namn (det visas för lärare/elever).',
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _nameCtrl,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(
                    labelText: 'Namn',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                if (_error != null) ...[
                  Text(_error!, style: const TextStyle(color: Colors.red)),
                  const SizedBox(height: 12),
                ],
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _loading ? null : _save,
                    child: _loading
                        ? const SizedBox(
                            height: 18,
                            width: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Spara'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  Future<void> _signIn() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      await FirebaseAuth.instance.signInWithEmailAndPassword(
        email: _emailCtrl.text.trim(),
        password: _passCtrl.text,
      );
    } on FirebaseAuthException catch (e) {
      setState(() => _error = e.message ?? 'Inloggning misslyckades.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _register() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final cred = await FirebaseAuth.instance.createUserWithEmailAndPassword(
        email: _emailCtrl.text.trim(),
        password: _passCtrl.text,
      );

      final uid = cred.user!.uid;
      final email = cred.user!.email ?? _emailCtrl.text.trim();

      await FirebaseFirestore.instance.collection('users').doc(uid).set({
        'email': email.toLowerCase(),
        'role': 'student',
        'createdAt': FieldValue.serverTimestamp(),
      });
    } on FirebaseAuthException catch (e) {
      setState(() => _error = e.message ?? 'Konto kunde inte skapas.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Logga in')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: _emailCtrl,
                  decoration: const InputDecoration(
                    labelText: 'E-post',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _passCtrl,
                  obscureText: true,
                  decoration: const InputDecoration(
                    labelText: 'Lösenord',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                if (_error != null) ...[
                  Text(_error!, style: const TextStyle(color: Colors.red)),
                  const SizedBox(height: 12),
                ],
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton(
                        onPressed: _loading ? null : _signIn,
                        child: const Text('Logga in'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: OutlinedButton(
                        onPressed: _loading ? null : _register,
                        child: const Text('Skapa konto'),
                      ),
                    ),
                  ],
                )
              ],
            ),
          ),
        ),
      ),
    );
  }
}




class TeacherHome extends StatefulWidget {
  const TeacherHome({super.key});

  @override
  State<TeacherHome> createState() => _TeacherHomeState();
}

class _TeacherHomeState extends State<TeacherHome> {
  final _newClassCtrl = TextEditingController();
  String _filterClass = 'ALL'; // ALL = alla
  final _addStudentEmailCtrl = TextEditingController();
  String _addStudentClass = 'NONE';
  String? _msg;
  String _inviteForClass = 'NONE';
  String? _lastInviteCode;

  @override
  void dispose() {
    _newClassCtrl.dispose();
    _addStudentEmailCtrl.dispose();
    super.dispose();
  }

  Future<void> _createClass(String teacherUid) async {
    final name = _newClassCtrl.text.trim();
    if (name.isEmpty) return;

    // classDocId: vi använder name + teacherUid för enkelhet (unik per lärare)
    final docId = '${teacherUid}_$name';

    await FirebaseFirestore.instance.collection('classes').doc(docId).set({
      'teacherUid': teacherUid,
      'name': name,
      'createdAt': FieldValue.serverTimestamp(),
    });

    _newClassCtrl.clear();
    if (mounted) setState(() {});
  }

  Future<void> _setStudentClass({
    required String studentUid,
    required String? className, // null = ingen klass
  }) async {
    await FirebaseFirestore.instance.collection('users').doc(studentUid).set({
      'classId': className ?? '',
    }, SetOptions(merge: true));
  }

  Future<void> _addStudentToClass(String teacherUid, List<String> classNames) async {
    setState(() => _msg = null);
    try {
      final email = _addStudentEmailCtrl.text.trim().toLowerCase();
      if (email.isEmpty) {
        setState(() => _msg = 'Skriv en elevs e-post.');
        return;
      }

      final q = await FirebaseFirestore.instance
          .collection('users')
          .where('email', isEqualTo: email)
          .limit(1)
          .get();

      if (q.docs.isEmpty) {
        setState(() => _msg = 'Hittade ingen användare med den e-posten.');
        return;
      }

      final userDoc = q.docs.first;
      final role = (userDoc.data()['role'] ?? 'student').toString().trim().toLowerCase();
      if (role != 'student') {
        setState(() => _msg = 'Användaren är inte en elev.');
        return;
      }

      final classId = (_addStudentClass == 'NONE') ? '' : _addStudentClass;

      await userDoc.reference.set({
        'teacherUid': teacherUid,
        'classId': classId,
      }, SetOptions(merge: true));

      setState(() {
        _msg = 'Elev tillagd/uppdaterad.';
        _addStudentEmailCtrl.clear();
        _addStudentClass = 'NONE';
      });
    } catch (e) {
      setState(() => _msg = 'Fel: $e');
    }
  }

  Future<void> _createInvite(String teacherUid, List<String> classNames) async {
    setState(() {
      _msg = null;
      _lastInviteCode = null;
    });

    try {
      if (classNames.isEmpty) {
        setState(() => _msg = 'Skapa minst en klass först.');
        return;
      }

      if (_inviteForClass == 'NONE') {
        setState(() => _msg = 'Välj en klass för koden.');
        return;
      }

      String code = '';
      final refCol = FirebaseFirestore.instance.collection('invites');
      for (int i = 0; i < 5; i++) {
        final candidate = generateInviteCode();
        final doc = await refCol.doc(candidate).get();
        if (!doc.exists) {
          code = candidate;
          await refCol.doc(code).set({
            'teacherUid': teacherUid,
            'classId': _inviteForClass == 'NONE' ? '' : _inviteForClass,
            'used': false,
            'createdAt': FieldValue.serverTimestamp(),
          });
          break;
        }
      }

      if (code.isEmpty) {
        setState(() => _msg = 'Kunde inte skapa unik kod, försök igen.');
        return;
      }

      setState(() {
        _lastInviteCode = code;
        _msg = 'Kod skapad. Dela den med eleven.';
      });
    } catch (e) {
      setState(() => _msg = 'Fel: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final teacherUid = FirebaseAuth.instance.currentUser!.uid;

    final classesQuery = FirebaseFirestore.instance
        .collection('classes')
        .where('teacherUid', isEqualTo: teacherUid);

    final studentsQuery = FirebaseFirestore.instance
        .collection('users')
        .where('teacherUid', isEqualTo: teacherUid);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Lärare'),
        actions: [
          IconButton(
            tooltip: 'Logga ut',
            onPressed: () => FirebaseAuth.instance.signOut(),
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
          stream: classesQuery.snapshots(),
          builder: (context, classSnap) {
            if (classSnap.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }

            final classDocs = classSnap.data?.docs ?? [];
            final classNames = classDocs
                .map((d) => (d.data()['name'] ?? '').toString().trim())
                .where((s) => s.isNotEmpty)
                .toList()
              ..sort();

            final filterOptions = ['ALL', ...classNames];

            // Se till att vald filterklass finns
            if (!filterOptions.contains(_filterClass)) {
              _filterClass = 'ALL';
            }

            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Klasser',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),

                // Skapa klass
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _newClassCtrl,
                        decoration: const InputDecoration(
                          labelText: 'Ny klass (t.ex. BA23)',
                          border: OutlineInputBorder(),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    ElevatedButton(
                      onPressed: () => _createClass(teacherUid),
                      child: const Text('Lägg till'),
                    ),
                  ],
                ),

                const SizedBox(height: 12),

                // Filter
                Row(
                  children: [
                    const Text('Filter: '),
                    const SizedBox(width: 8),
                    DropdownButton<String>(
                      value: _filterClass,
                      items: filterOptions
                          .map((c) => DropdownMenuItem(
                                value: c,
                                child: Text(c == 'ALL' ? 'Alla klasser' : c),
                              ))
                          .toList(),
                      onChanged: (v) => setState(() => _filterClass = v ?? 'ALL'),
                    ),
                  ],
                ),

                const SizedBox(height: 12),
                const Text('Lägg till elev via e-post', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _addStudentEmailCtrl,
                        decoration: const InputDecoration(
                          labelText: 'Elevens e-post',
                          border: OutlineInputBorder(),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    SizedBox(
                      width: 150,
                      child: DropdownButtonFormField<String>(
                        initialValue: _addStudentClass,
                        decoration: const InputDecoration(
                          labelText: 'Klass',
                          border: OutlineInputBorder(),
                          isDense: true,
                        ),
                        items: [
                          const DropdownMenuItem(value: 'NONE', child: Text('Ingen')),
                          ...classNames.map((c) => DropdownMenuItem(value: c, child: Text(c))),
                        ],
                        onChanged: (v) => setState(() => _addStudentClass = v ?? 'NONE'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    ElevatedButton(
                      onPressed: () => _addStudentToClass(teacherUid, classNames),
                      child: const Text('Lägg till'),
                    ),
                  ],
                ),
                if (_msg != null) ...[
                  const SizedBox(height: 8),
                  Text(_msg!, style: const TextStyle(color: Colors.green)),
                ],
                const SizedBox(height: 12),
                const Text('Generera kopplingskod', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                Row(
                  children: [
                    SizedBox(
                      width: 220,
                      child: DropdownButtonFormField<String>(
                        initialValue: _inviteForClass,
                        decoration: const InputDecoration(
                          labelText: 'Klass (kod gäller för)',
                          border: OutlineInputBorder(),
                          isDense: true,
                        ),
                        items: [
                          const DropdownMenuItem(value: 'NONE', child: Text('Ingen')),
                          ...classNames.map((c) => DropdownMenuItem(value: c, child: Text(c))),
                        ],
                        onChanged: (v) => setState(() => _inviteForClass = v ?? 'NONE'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    ElevatedButton(
                      onPressed: () => _createInvite(teacherUid, classNames),
                      child: const Text('Generera kod'),
                    ),
                    const SizedBox(width: 12),
                    if (_lastInviteCode != null) SelectableText('Kod: $_lastInviteCode'),
                  ],
                ),

                const SizedBox(height: 12),

                const Text(
                  'Mina elever',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),

                Expanded(
                  child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
                    stream: studentsQuery.snapshots(),
                    builder: (context, studentSnap) {
                      if (studentSnap.connectionState == ConnectionState.waiting) {
                        return const Center(child: CircularProgressIndicator());
                      }
                      if (studentSnap.hasError) {
                        return Center(child: Text('Fel: ${studentSnap.error}'));
                      }

                      final docs = studentSnap.data?.docs ?? [];

                      // Bara elever
                      final students = docs.where((d) {
                        final role = (d.data()['role'] ?? '')
                            .toString()
                            .trim()
                            .toLowerCase();
                        return role == 'student';
                      }).toList();

                      // Filter på klass
                      final filtered = students.where((d) {
                        if (_filterClass == 'ALL') return true;
                        final classId = (d.data()['classId'] ?? '').toString().trim();
                        return classId == _filterClass;
                      }).toList();

                      if (filtered.isEmpty) {
                        return const Center(
                          child: Text(
                            'Inga elever i detta filter.\nBe elever koppla sig eller ändra klass.',
                            textAlign: TextAlign.center,
                          ),
                        );
                      }

                      // sortera på namn/email för snyggare lista
                      filtered.sort((a, b) {
                        final an = (a.data()['displayName'] ?? '').toString();
                        final bn = (b.data()['displayName'] ?? '').toString();
                        final ae = (a.data()['email'] ?? '').toString();
                        final be = (b.data()['email'] ?? '').toString();
                        final ax = (an.isEmpty ? ae : an).toLowerCase();
                        final bx = (bn.isEmpty ? be : bn).toLowerCase();
                        return ax.compareTo(bx);
                      });

                      return ListView.separated(
                        itemCount: filtered.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (context, i) {
                          final doc = filtered[i];
                          final data = doc.data();
                          final studentUid = doc.id;

                          final email = (data['email'] ?? '').toString();
                          final name = (data['displayName'] ?? '').toString().trim();
                          final currentClass = (data['classId'] ?? '').toString().trim();

                          final studentTitle = name.isEmpty ? email : name;

                          return Card(
                            child: Padding(
                              padding: const EdgeInsets.symmetric(vertical: 6),
                              child: ListTile(
                                title: Text(studentTitle),
                                subtitle: Text(name.isEmpty ? 'Elev' : email),
                                onTap: () {
  Navigator.push(
    context,
    MaterialPageRoute(
      builder: (_) => StudentDetailScreen(studentUid: studentUid),
    ),
  );
},

                                trailing: SizedBox(
                                  width: 170,
                                  child: DropdownButtonFormField<String>(
                                    initialValue: currentClass.isEmpty ? 'NONE' : currentClass,
                                    decoration: const InputDecoration(
                                      labelText: 'Klass',
                                      border: OutlineInputBorder(),
                                      isDense: true,
                                    ),
                                    items: [
                                      const DropdownMenuItem(
                                        value: 'NONE',
                                        child: Text('Ingen'),
                                      ),
                                      ...classNames.map(
                                        (c) => DropdownMenuItem(
                                          value: c,
                                          child: Text(c),
                                        ),
                                      ),
                                    ],
                                    onChanged: (v) async {
                                      final newClass = (v == null || v == 'NONE') ? null : v;
                                      await _setStudentClass(
                                        studentUid: studentUid,
                                        className: newClass,
                                      );
                                    },
                                  ),
                                ),
                              ),
                            ),
                          );
                        },
                      );
                    },
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
class StudentDetailScreen extends StatelessWidget {
  final String studentUid;

  const StudentDetailScreen({
    super.key,
    required this.studentUid,
  });

  @override
  Widget build(BuildContext context) {
    final docStream = FirebaseFirestore.instance
        .collection('users')
        .doc(studentUid)
        .snapshots();

    return Scaffold(
      appBar: AppBar(title: const Text('Elev')),
      body: StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
        stream: docStream,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (!snap.hasData || !snap.data!.exists) {
            return const Center(child: Text('Eleven hittades inte.'));
          }

          final data = snap.data!.data()!;
          final name = (data['displayName'] ?? '').toString().trim();
          final email = (data['email'] ?? '').toString().trim();
          final classId = (data['classId'] ?? '').toString().trim();

          return Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name.isEmpty ? 'Okänt namn' : name,
                  style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                if (email.isNotEmpty) Text('E-post: $email'),
                const SizedBox(height: 6),
                Text('Klass: ${classId.isEmpty ? 'Ingen' : classId}'),
                const SizedBox(height: 6),
                Text('UID: $studentUid', style: const TextStyle(fontSize: 12)),
                const SizedBox(height: 18),
                const Divider(),
                const SizedBox(height: 12),

                // Placeholder-knappar (vi kopplar på funktioner senare)
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
onPressed: () {
  final now = DateTime.now();
  final monday = now.subtract(Duration(days: now.weekday - DateTime.monday));
  final nextMonday = monday.add(const Duration(days: 7));

  String ymd(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  Navigator.push(
    context,
    MaterialPageRoute(
      builder: (_) => TeacherTimesheetPeriodScreen(
        studentUid: studentUid,
        weekStart1: ymd(monday),
        weekStart2: ymd(nextMonday),
      ),
    ),
  );
},

                    child: const Text('Tidkort'),
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    onPressed: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Bedömning kommer snart 🙂')),
                      );
                    },
                    child: const Text('Bedömning'),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
class TeacherTimesheetPeriodScreen extends StatelessWidget {
  final String studentUid;
  final String weekStart1;
  final String weekStart2; // kan vara '' om du vill

  const TeacherTimesheetPeriodScreen({
    super.key,
    required this.studentUid,
    required this.weekStart1,
    required this.weekStart2,
  });

  @override
  Widget build(BuildContext context) {
    final teacherUid = FirebaseAuth.instance.currentUser!.uid;

    return DefaultTabController(
      length: weekStart2.isEmpty ? 1 : 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Tidkort (lärare)'),
          bottom: TabBar(
            tabs: [
              Tab(text: weekStart1),
              if (weekStart2.isNotEmpty) Tab(text: weekStart2),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            WeeklyTimesheetScreen(
              studentUid: studentUid,
              teacherUid: teacherUid,
              weekStart: weekStart1,
              readOnly: true, // lärare kan inte skriva i tider
            ),
            if (weekStart2.isNotEmpty)
              WeeklyTimesheetScreen(
                studentUid: studentUid,
                teacherUid: teacherUid,
                weekStart: weekStart2,
                readOnly: true,
              ),
          ],
        ),
      ),
    );
  }
}


class StudentHome extends StatefulWidget {
  const StudentHome({super.key});

  @override
  State<StudentHome> createState() => _StudentHomeState();
}

class _StudentHomeState extends State<StudentHome> {
  final _codeCtrl = TextEditingController();
  String? _msg;
  bool _loading = false;

  @override
  void dispose() {
    _codeCtrl.dispose();
    super.dispose();
  }

  Future<void> _connectToTeacher() async {
    setState(() {
      _loading = true;
      _msg = null;
    });

    try {
      final studentUid = FirebaseAuth.instance.currentUser!.uid;
      final code = _codeCtrl.text.trim().toUpperCase();

      if (code.isEmpty) {
        setState(() => _msg = 'Skriv en kod.');
        return;
      }

      final inviteRef = FirebaseFirestore.instance.collection('invites').doc(code);

      await FirebaseFirestore.instance.runTransaction((tx) async {
        final inviteSnap = await tx.get(inviteRef);
        if (!inviteSnap.exists) throw Exception('Koden finns inte.');

        final data = inviteSnap.data() as Map<String, dynamic>;
        final used = (data['used'] ?? false) as bool;
        if (used) throw Exception('Koden är redan använd.');

        final teacherUid = (data['teacherUid'] ?? '').toString();
        if (teacherUid.isEmpty) throw Exception('Koden är trasig (saknar lärare).');

        // 1) Koppla eleven till läraren
        final studentRef = FirebaseFirestore.instance.collection('users').doc(studentUid);
        tx.update(studentRef, {'teacherUid': teacherUid});

        // 2) Markera koden som använd
        tx.update(inviteRef, {
          'used': true,
          'usedBy': studentUid,
          'usedAt': FieldValue.serverTimestamp(),
        });
      });

      setState(() => _msg = 'Klart! Du är nu kopplad till din lärare.');
    } catch (e) {
      setState(() => _msg = 'Fel: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Elev'),
        actions: [
          IconButton(
            tooltip: 'Logga ut',
            onPressed: () => FirebaseAuth.instance.signOut(),
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('Ange kopplingskod från din lärare', style: TextStyle(fontSize: 18)),
                const SizedBox(height: 12),
                TextField(
                  controller: _codeCtrl,
                  textCapitalization: TextCapitalization.characters,
                  decoration: const InputDecoration(
                    labelText: 'Kod (t.ex. 7F3K2Q)',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _loading ? null : _connectToTeacher,
                    child: _loading
                        ? const SizedBox(
                            height: 18,
                            width: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Koppla'),
                  ),
                ),
                const SizedBox(height: 12),
                if (_msg != null) Text(_msg!, textAlign: TextAlign.center),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class AdminHome extends StatefulWidget {
  const AdminHome({super.key});

  @override
  State<AdminHome> createState() => _AdminHomeState();
}

class _AdminHomeState extends State<AdminHome> {
  final _emailCtrl = TextEditingController();
  String _role = 'teacher';
  String? _msg;
  bool _loading = false;

  @override
  void dispose() {
    _emailCtrl.dispose();
    super.dispose();
  }

  Future<void> _setRoleByEmail() async {
    setState(() {
      _loading = true;
      _msg = null;
    });

    try {
      final email = _emailCtrl.text.trim().toLowerCase();
      if (email.isEmpty) {
        setState(() => _msg = 'Skriv en e-post först.');
        return;
      }

      final q = await FirebaseFirestore.instance
          .collection('users')
          .where('email', isEqualTo: email)
          .limit(1)
          .get();

      if (q.docs.isEmpty) {
        setState(() => _msg = 'Hittade ingen användare med den e-posten.');
        return;
      }

      await q.docs.first.reference.update({'role': _role});
      setState(() => _msg = 'Klart! Satte rollen ${_role == 'teacher' ? 'lärare' : 'elev'} för $email');
    } catch (e) {
      setState(() => _msg = 'Fel: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
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
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Sätt roll för användare',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _emailCtrl,
                  decoration: const InputDecoration(
                    labelText: 'E-post (måste finnas i users)',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: _role,
                  decoration: const InputDecoration(
                    labelText: 'Roll',
                    border: OutlineInputBorder(),
                  ),
                  items: const [
                    DropdownMenuItem(value: 'teacher', child: Text('Lärare')),
                    DropdownMenuItem(value: 'student', child: Text('Elev')),
                  ],
                  onChanged: (v) => setState(() => _role = v ?? 'teacher'),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _loading ? null : _setRoleByEmail,
                    child: _loading
                        ? const SizedBox(
                            height: 18,
                            width: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Spara roll'),
                  ),
                ),
                const SizedBox(height: 12),
                if (_msg != null) Text(_msg!, textAlign: TextAlign.center),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class StudentTimesheetOverview extends StatelessWidget {
  const StudentTimesheetOverview({super.key});

  int _sumEntries(Map<String, dynamic> entries) {
    int sum = 0;
    for (final row in entries.values) {
      if (row is Map) {
        for (final v in row.values) {
          sum += (v is int) ? v : int.tryParse(v.toString()) ?? 0;
        }
      }
    }
    return sum;
  }

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser!;
    final q = FirebaseFirestore.instance
        .collection('timesheets')
        .where('studentUid', isEqualTo: user.uid);

    return Scaffold(
      appBar: AppBar(title: const Text('Tidkort')),
      body: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
        stream: q.snapshots(),
        builder: (BuildContext context,
            AsyncSnapshot<QuerySnapshot<Map<String, dynamic>>> snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return Center(child: Text('Fel: ${snap.error}'));
          }

          final docs = snap.data?.docs ?? [];

          int totalHours = 0;
          int approvedCount = 0;

          final weekStarts = <String>[];

          for (final d in docs) {
            final data = d.data();
            final entries =
                (data['entries'] as Map?)?.cast<String, dynamic>() ?? {};
            totalHours += _sumEntries(entries);
            if ((data['approved'] ?? false) == true) approvedCount++;

            // Hämta weekStart från fält, annars från doc-id: studentUid_YYYY-MM-DD
            String ws = (data['weekStart'] ?? '').toString().trim();
            if (ws.isEmpty) {
              final id = d.id;
              final parts = id.split('_');
              if (parts.isNotEmpty) {
                final last = parts.last.trim();
                if (last.length == 10 && last[4] == '-' && last[7] == '-') {
                  ws = last;
                }
              }
            }
            if (ws.isNotEmpty) weekStarts.add(ws);
          }

          // sortera nyast först
          weekStarts.sort((a, b) => b.compareTo(a));

          // Para ihop 2 och 2 (två veckor per "period")
          final periods = <List<String>>[];
          for (int i = 0; i < weekStarts.length; i += 2) {
            final w1 = weekStarts[i];
            final w2 = (i + 1 < weekStarts.length) ? weekStarts[i + 1] : '';
            periods.add([w1, w2]);
          }

          return Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Total-summering
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Totalt: $totalHours h',
                          style: const TextStyle(
                              fontSize: 18, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 6),
                        Text('Inlämnade veckor: ${docs.length}'),
                        Text('Godkända: $approvedCount'),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  'Tidkort (2 veckor)',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),

                Expanded(
                  child: periods.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Text('Inga tidkort ännu.'),
                              const SizedBox(height: 12),
                              ElevatedButton(
                                onPressed: () {
                                  final now = DateTime.now();
                                  final monday = now.subtract(Duration(
                                      days: now.weekday - DateTime.monday));
                                  final nextMonday =
                                      monday.add(const Duration(days: 7));

                                  String ymd(DateTime d) =>
                                      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) => TimesheetPeriodScreen(
                                        weekStart1: ymd(monday),
                                        weekStart2: ymd(nextMonday),
                                      ),
                                    ),
                                  );
                                },
                                child: const Text(
                                    'Skapa/öppna tidkort för denna period'),
                              ),
                            ],
                          ),
                        )
                      : ListView.separated(
                          itemCount: periods.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 8),
                          itemBuilder: (context, i) {
                            final w1 = periods[i][0];
                            final w2 = periods[i][1];

                            final d1 = _parseYmd(w1);
                            final w1num = _isoWeekNumber(d1);

                            String title;
                            String subtitle;

                            if (w2.isEmpty) {
                              final start = d1;
                              final end = d1.add(const Duration(days: 4));
                              title = 'Vecka $w1num';
                              subtitle =
                                  '${_formatDateShort(start)}–${_formatDateShort(end)}';
                            } else {
                              final d2 = _parseYmd(w2);
                              final w2num = _isoWeekNumber(d2);
                              final start = d1;
                              final end = d2.add(const Duration(days: 4));
                              title = 'Vecka $w1num–$w2num';
                              subtitle =
                                  '${_formatDateShort(start)}–${_formatDateShort(end)}';
                            }

                            return Card(
                              child: ListTile(
                                title: Text(title),
                                subtitle: Text(subtitle),
                                trailing: const Icon(Icons.chevron_right),
                                onTap: () {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) => TimesheetPeriodScreen(
                                        weekStart1: w1,
                                        weekStart2: w2,
                                      ),
                                    ),
                                  );
                                },
                              ),
                            );
                          },
                        ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class TimesheetPeriodScreen extends StatelessWidget {
  final String weekStart1;
  final String weekStart2; // kan vara '' om bara en vecka

  const TimesheetPeriodScreen({
    super.key,
    required this.weekStart1,
    required this.weekStart2,
  });

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser!;
    final userDocStream =
        FirebaseFirestore.instance.collection('users').doc(user.uid).snapshots();

    return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      stream: userDocStream,
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Scaffold(body: Center(child: CircularProgressIndicator()));
        }

        final data = snap.data?.data() ?? {};
        final teacherUid = (data['teacherUid'] ?? '').toString().trim();

        if (teacherUid.isEmpty) {
          return const Scaffold(body: Center(child: Text('Ingen lärare kopplad.')));
        }

        return DefaultTabController(
          length: weekStart2.isEmpty ? 1 : 2,
          child: Scaffold(
            appBar: AppBar(
              title: const Text('Tidkort'),
              bottom: TabBar(
                tabs: [
                  Tab(text: weekStart1),
                  if (weekStart2.isNotEmpty) Tab(text: weekStart2),
                ],
              ),
            ),
            body: TabBarView(
              children: [
                WeeklyTimesheetScreen(
                  studentUid: user.uid,
                  teacherUid: teacherUid,
                  weekStart: weekStart1,
                  readOnly: false,
                ),
                if (weekStart2.isNotEmpty)
                  WeeklyTimesheetScreen(
                    studentUid: user.uid,
                    teacherUid: teacherUid,
                    weekStart: weekStart2,
                    readOnly: false,
                  ),
              ],
            ),
          ),
        );
      },
    );
  }
}
DateTime _parseYmd(String ymd) {
  // ymd: "YYYY-MM-DD"
  final parts = ymd.split('-');
  return DateTime(
    int.parse(parts[0]),
    int.parse(parts[1]),
    int.parse(parts[2]),
  );
}

int _isoWeekNumber(DateTime date) {
  // ISO 8601 week number (weeks start Monday, week 1 has Jan 4)
  final d = DateTime(date.year, date.month, date.day);
  final thursday = d.add(Duration(days: 4 - (d.weekday == 7 ? 7 : d.weekday)));
  final firstThursday = DateTime(thursday.year, 1, 4);
  final firstThursdayAdjusted =
      firstThursday.add(Duration(days: 4 - (firstThursday.weekday == 7 ? 7 : firstThursday.weekday)));
  final week = 1 + ((thursday.difference(firstThursdayAdjusted).inDays) ~/ 7);
  return week;
}

String _formatDateShort(DateTime d) {
  String two(int n) => n.toString().padLeft(2, '0');
  return '${d.day}/${two(d.month)}';
}


String generateInviteCode({int length = 6}) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // inga O/0, I/1
  final rnd = Random.secure();
  return List.generate(length, (_) => chars[rnd.nextInt(chars.length)]).join();
}


class MainNavigation extends StatefulWidget {
  const MainNavigation({super.key});

  @override
  State<MainNavigation> createState() => _MainNavigationState();
}

class _MainNavigationState extends State<MainNavigation> {
  int _currentIndex = 0;

final List<Widget> _screens = const [
  StudentTimesheetOverview(),
  Center(child: Text('Bedömning', style: TextStyle(fontSize: 24))),
  Center(child: Text('Lunch / Reseersättning', style: TextStyle(fontSize: 24))),
];


  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('APL-appen'),
        actions: [
          IconButton(
            tooltip: 'Logga ut',
            onPressed: () => FirebaseAuth.instance.signOut(),
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: _screens[_currentIndex],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) => setState(() => _currentIndex = index),
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.access_time),
            label: 'Tidkort',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.checklist),
            label: 'Bedömning',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.restaurant),
            label: 'Lunch/Resa',
          ),
        ],
      ),
    );
  }
}
