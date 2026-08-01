import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:url_launcher/url_launcher.dart';
import 'dart:math';
import 'dart:async';
import 'core/program_catalog.dart';
import 'firebase_options.dart';
import 'Screens/tidkort_screen.dart';
import 'Screens/start_screen.dart';
import 'Screens/student_registration_screen.dart';
import 'Screens/teacher_dashboard_screen.dart';
import 'Screens/week_management_screen.dart';
import 'Screens/statistics_screen.dart';
import 'Screens/supervisor_assessment_page.dart';
import 'Screens/bedomning_screen.dart';
import 'Screens/ersattning_screen.dart';
import 'Screens/admin_screen.dart';
import 'Screens/schools_screen.dart';
import 'Screens/settings_screen.dart';
import 'Screens/assignments_screen.dart';
import 'Screens/weekly_timesheet_screen.dart';
import 'Screens/gdpr_consent_screen.dart';
import 'Screens/deletion_pending_screen.dart';

const kCurrentGdprConsentVersion = '2026-03-25';

// Bakåtkompatibilitet för tester/importer som läser template från main.dart.
const activityTemplate = activityTemplateTrabetare;

String _ymd(DateTime d) {
  String two(int n) => n.toString().padLeft(2, '0');
  return '${d.year}-${two(d.month)}-${two(d.day)}';
}

class StudentWeeklyTimesheetHome extends StatelessWidget {
  const StudentWeeklyTimesheetHome({super.key});

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser!;
    final userDocStream = FirebaseFirestore.instance
        .collection('users')
        .doc(user.uid)
        .snapshots();

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
        final monday = now.subtract(
          Duration(days: now.weekday - DateTime.monday),
        );
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

class AssessmentFormPageFromDeepLink extends StatelessWidget {
  final String assessmentId;

  const AssessmentFormPageFromDeepLink({super.key, required this.assessmentId});

  @override
  Widget build(BuildContext context) {
    // Försök att hitta timesheetId från assessmentId i Firestore
    // Om dokumentet redan finns, använd det, annars skapa en placeholder
    return Scaffold(
      appBar: AppBar(title: const Text('Bedömning'), centerTitle: true),
      body: FutureBuilder<String?>(
        future: _getTimesheetIdForAssessment(assessmentId),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          // Även om vi inte hittar timesheetId, kan vi fortsätta
          // eftersom AssessmentFormPage lagrar det baserat på assessmentId
          return AssessmentFormPage(
            assessmentId: assessmentId,
            timesheetId: snapshot.data ?? '',
          );
        },
      ),
    );
  }

  Future<String?> _getTimesheetIdForAssessment(String assessmentId) async {
    try {
      final snap = await FirebaseFirestore.instance
          .collection('assessments')
          .doc(assessmentId)
          .get();

      if (snap.exists) {
        return (snap.data()?['timesheetId'] as String?);
      }
    } catch (e) {
      // Tyst fel — vi skapar nytt dokument
    }
    return null;
  }
}

class AssessmentFormPage extends StatefulWidget {
  final String assessmentId;
  final String timesheetId;

  const AssessmentFormPage({
    super.key,
    required this.assessmentId,
    required this.timesheetId,
  });

  @override
  State<AssessmentFormPage> createState() => _AssessmentFormPageState();
}

class _AssessmentFormPageState extends State<AssessmentFormPage> {
  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _companyCtrl = TextEditingController();
  final _feedbackCtrl = TextEditingController();
  bool _loading = false;
  String? _error;
  String? _success;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _companyCtrl.dispose();
    _feedbackCtrl.dispose();
    super.dispose();
  }

  Future<void> _submitAssessment() async {
    setState(() {
      _loading = true;
      _error = null;
      _success = null;
    });

    try {
      final name = _nameCtrl.text.trim();
      final phone = _phoneCtrl.text.trim();
      final company = _companyCtrl.text.trim();
      final feedback = _feedbackCtrl.text.trim();

      if (name.isEmpty || phone.isEmpty || company.isEmpty) {
        setState(() {
          _error = 'Namn, mobilnummer och företag är obligatoriska.';
        });
        return;
      }
      await FirebaseFirestore.instance
          .collection('assessments')
          .doc(widget.assessmentId)
          .set({
            'supervisorName': name,
            'supervisorPhone': phone,
            'supervisorCompany': company,
            'feedback': feedback,
            'status': 'completed',
            'submittedAt': FieldValue.serverTimestamp(),
            if (widget.timesheetId.isNotEmpty)
              'timesheetId': widget.timesheetId,
          }, SetOptions(merge: true));

      setState(() {
        _success = 'Bedömningen har skickats in!';
      });
    } catch (e) {
      setState(() {
        _error = 'Fel: $e';
      });
    } finally {
      setState(() {
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFFF8F2),
      appBar: AppBar(
        title: const Text('Bedömning'),
        centerTitle: true,
        backgroundColor: const Color(0xFFFF6B35),
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: _success != null
          ? _buildSuccessView()
          : SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Handledarens uppgifter',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF1A1A1A),
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Fyll i dina uppgifter för att bekräfta bedömningen',
                    style: TextStyle(fontSize: 13, color: Colors.grey),
                  ),
                  const SizedBox(height: 20),
                  _buildCard([
                    _buildField(
                      controller: _nameCtrl,
                      label: 'Namn *',
                      icon: Icons.person_outline,
                    ),
                    const SizedBox(height: 16),
                    _buildField(
                      controller: _phoneCtrl,
                      label: 'Mobilnummer *',
                      icon: Icons.phone_outlined,
                      keyboardType: TextInputType.phone,
                    ),
                    const SizedBox(height: 16),
                    _buildField(
                      controller: _companyCtrl,
                      label: 'Företag *',
                      icon: Icons.business_outlined,
                    ),
                  ]),
                  const SizedBox(height: 20),
                  const Text(
                    'Feedback',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF1A1A1A),
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Valfri kommentar om elevens prestation',
                    style: TextStyle(fontSize: 13, color: Colors.grey),
                  ),
                  const SizedBox(height: 12),
                  _buildCard([
                    _buildField(
                      controller: _feedbackCtrl,
                      label: 'Kommentar (valfritt)',
                      icon: Icons.comment_outlined,
                      maxLines: 4,
                    ),
                  ]),
                  if (_error != null) ...[
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.red.shade50,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.red.shade200),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.error_outline, color: Colors.red.shade400),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _error!,
                              style: TextStyle(color: Colors.red.shade700),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 28),
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton.icon(
                      onPressed: _loading ? null : _submitAssessment,
                      icon: _loading
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                color: Colors.white,
                                strokeWidth: 2,
                              ),
                            )
                          : const Icon(Icons.send_rounded),
                      label: Text(_loading ? 'Skickar...' : 'Skicka bedömning'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFFF6B35),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                        textStyle: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 32),
                ],
              ),
            ),
    );
  }

  Widget _buildSuccessView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: const Color(0xFFFF6B35).withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.check_circle_rounded,
                size: 48,
                color: Color(0xFFFF6B35),
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              'Tack!',
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.bold,
                color: Color(0xFF1A1A1A),
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'Bedömningen har skickats in.\nEleven kommer att se den i sin app.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 16, color: Colors.grey),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCard(List<Widget> children) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(children: children),
    );
  }

  Widget _buildField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    TextInputType keyboardType = TextInputType.text,
    int maxLines = 1,
  }) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      maxLines: maxLines,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon, color: const Color(0xFFFF6B35)),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: Colors.grey.shade300),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: Colors.grey.shade300),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFFF6B35), width: 2),
        ),
        filled: true,
        fillColor: const Color(0xFFFAFAFA),
      ),
    );
  }
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

  // Aktivera offline persistence för bättre användarupplevelse
  FirebaseFirestore.instance.settings = const Settings(
    persistenceEnabled: true,
    cacheSizeBytes: Settings.CACHE_SIZE_UNLIMITED,
  );

  runApp(const AplApp());
}

class AplApp extends StatelessWidget {
  const AplApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFFFF8A00),
          primary: const Color(0xFFFF6A00),
          secondary: const Color(0xFF5A3D33),
          surface: const Color(0xFFFFF8F2),
        ),
        scaffoldBackgroundColor: const Color(0xFFFFF8F2),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFFFFF8F2),
          foregroundColor: Color(0xFF2A2421),
          centerTitle: false,
          elevation: 0,
          scrolledUnderElevation: 0,
          surfaceTintColor: Colors.transparent,
        ),
        cardTheme: CardThemeData(
          color: Colors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 12,
            vertical: 12,
          ),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: BorderSide(color: Colors.grey.shade300),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: BorderSide(color: Colors.grey.shade300),
          ),
          focusedBorder: const OutlineInputBorder(
            borderRadius: BorderRadius.all(Radius.circular(14)),
            borderSide: BorderSide(color: Color(0xFFFF6A00), width: 1.6),
          ),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFFFF6A00),
            foregroundColor: Colors.white,
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: const Color(0xFF9A4E00),
            side: const BorderSide(color: Color(0xFFFFC38D)),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
            ),
          ),
        ),
        dialogTheme: DialogThemeData(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
          ),
        ),
        snackBarTheme: SnackBarThemeData(
          backgroundColor: const Color(0xFF2E2723),
          contentTextStyle: const TextStyle(color: Colors.white),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          behavior: SnackBarBehavior.floating,
        ),
        progressIndicatorTheme: const ProgressIndicatorThemeData(
          color: Color(0xFFFF6A00),
        ),
        bottomNavigationBarTheme: const BottomNavigationBarThemeData(
          backgroundColor: Color(0xFFFFF8F2),
          selectedItemColor: Color(0xFFFF6A00),
          unselectedItemColor: Color(0xFF8B837D),
          type: BottomNavigationBarType.fixed,
        ),
        floatingActionButtonTheme: const FloatingActionButtonThemeData(
          backgroundColor: Color(0xFFFF6A00),
          foregroundColor: Colors.white,
        ),
      ),
      home: AuthGate(),
      onGenerateRoute: (settings) {
        // Hantera handledarlänkar: /supervisor/{requestId}?token={token}
        if (settings.name?.startsWith('/supervisor/') ?? false) {
          final parts = settings.name!
              .replaceFirst('/supervisor/', '')
              .split('?');
          final requestId = parts[0];
          String? token;

          if (parts.length > 1) {
            final queryParams = Uri.parse(
              'http://dummy?${parts[1]}',
            ).queryParameters;
            token = queryParams['token'];
          }

          if (token != null) {
            return MaterialPageRoute(
              builder: (context) => SupervisorAssessmentPage(
                requestId: requestId,
                token: token!, // Assert non-null since we checked above
              ),
            );
          }
        }

        // Hantera deep links: apl://assess/{assessmentId}
        if (settings.name?.startsWith('/assess/') ?? false) {
          final assessmentId = settings.name!.replaceFirst('/assess/', '');
          // Vi hämtar timesheetId från assessments collection senare
          return MaterialPageRoute(
            builder: (context) =>
                AssessmentFormPageFromDeepLink(assessmentId: assessmentId),
          );
        }
        return null;
      },
    );
  }
}

class StudentOnboardingScreen extends StatefulWidget {
  const StudentOnboardingScreen({super.key});

  @override
  State<StudentOnboardingScreen> createState() =>
      _StudentOnboardingScreenState();
}

class _StudentOnboardingScreenState extends State<StudentOnboardingScreen> {
  final _classCodeCtrl = TextEditingController();
  late final Future<List<ProgramOption>> _programOptionsFuture;
  String? _selectedProgram;
  String? _selectedSpecialization;
  bool _loading = false;
  String? _error;
  int _step = 1; // 1 = klasskod, 2 = program, 3 = yrkesutgång

  @override
  void initState() {
    super.initState();
    _programOptionsFuture = loadProgramOptions();
  }

  @override
  void dispose() {
    _classCodeCtrl.dispose();
    super.dispose();
  }

  Future<void> _submitClassCode() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    final classCode = _classCodeCtrl.text.trim();
    if (classCode.isEmpty) {
      setState(() {
        _error = 'Ange en klasskod';
        _loading = false;
      });
      return;
    }

    try {
      final user = FirebaseAuth.instance.currentUser!;

      // Verifiera klasskod
      final classDoc = await FirebaseFirestore.instance
          .collection('classes')
          .doc(classCode)
          .get();

      if (!classDoc.exists) {
        setState(() => _error = 'Ogiltig klasskod');
        return;
      }

      final classId = classDoc.id;
      final teacherUid = classDoc.data()?['teacherUid'] as String?;
      String teacherSchool = '';

      if (teacherUid != null && teacherUid.isNotEmpty) {
        final teacherDoc = await FirebaseFirestore.instance
            .collection('users')
            .doc(teacherUid)
            .get();
        teacherSchool = (teacherDoc.data()?['school'] ?? '').toString().trim();
      }

      final userName =
          (await FirebaseFirestore.instance
                  .collection('users')
                  .doc(user.uid)
                  .get())
              .data()?['name'] ??
          '';

      // Uppdatera användare med klasskod
      await FirebaseFirestore.instance
          .collection('users')
          .doc(user.uid)
          .update({
            'classId': classId,
            'teacherUid': teacherUid,
            'teacherId': teacherUid,
            if (teacherSchool.isNotEmpty) 'school': teacherSchool,
          });

      // Lägg till i klassens students-subcollection
      await FirebaseFirestore.instance
          .collection('classes')
          .doc(classId)
          .collection('students')
          .doc(user.uid)
          .set({
            'name': userName,
            'email': user.email ?? '',
            'addedAt': FieldValue.serverTimestamp(),
          });

      // Gå vidare till programval
      setState(() {
        _step = 2;
        _loading = false;
        _error = null;
      });
    } catch (e) {
      setState(() {
        _error = 'Fel: $e';
        _loading = false;
      });
    }
  }

  Future<void> _submitProgram(List<ProgramOption> availablePrograms) async {
    if (_selectedProgram == null) {
      setState(() => _error = 'Välj ett program');
      return;
    }

    final specializations = getSpecializationsForProgram(
      _selectedProgram,
      options: availablePrograms,
    );

    if (specializations.isEmpty) {
      await _completeOnboarding(availablePrograms);
      return;
    }

    setState(() {
      _selectedSpecialization = null;
      _error = null;
      _step = 3;
    });
  }

  Future<void> _completeOnboarding(
    List<ProgramOption> availablePrograms,
  ) async {
    if (_selectedProgram == null) {
      setState(() => _error = 'Välj ett program');
      return;
    }

    final requiresSpecialization = programRequiresSpecialization(
      _selectedProgram,
      options: availablePrograms,
    );
    if (requiresSpecialization && _selectedSpecialization == null) {
      setState(() => _error = 'Välj en yrkesutgång');
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final user = FirebaseAuth.instance.currentUser!;

      final updateData = <String, dynamic>{
        'program': _selectedProgram,
        'onboardingComplete': true,
      };
      if (_selectedSpecialization != null) {
        updateData['specialization'] = _selectedSpecialization;
      }

      // Uppdatera med program och ev. yrkesutgång och markera onboarding som klar
      await FirebaseFirestore.instance
          .collection('users')
          .doc(user.uid)
          .update(updateData);

      // Appen kommer automatiskt uppdatera sig via StreamBuilder
    } catch (e) {
      setState(() {
        _error = 'Fel: $e';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_step == 1 ? 'Välkommen!' : 'Nästan klar'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Logga ut',
            onPressed: () => FirebaseAuth.instance.signOut(),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 500),
            child: _step == 1
                ? _buildClassCodeStep()
                : FutureBuilder<List<ProgramOption>>(
                    future: _programOptionsFuture,
                    builder: (context, snapshot) {
                      if (snapshot.connectionState == ConnectionState.waiting) {
                        return const Center(child: CircularProgressIndicator());
                      }

                      final availablePrograms = snapshot.data ?? programOptions;
                      return _step == 2
                          ? _buildProgramStep(availablePrograms)
                          : _buildSpecializationStep(availablePrograms);
                    },
                  ),
          ),
        ),
      ),
    );
  }

  Widget _buildClassCodeStep() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Icon(Icons.school, size: 80, color: Colors.orange),
        const SizedBox(height: 24),
        const Text(
          'Ange din klasskod',
          style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 16),
        const Text(
          'Få klasskoden från din lärare för att komma igång',
          textAlign: TextAlign.center,
          style: TextStyle(color: Colors.grey),
        ),
        const SizedBox(height: 32),
        TextField(
          controller: _classCodeCtrl,
          decoration: const InputDecoration(
            labelText: 'Klasskod',
            border: OutlineInputBorder(),
            prefixIcon: Icon(Icons.vpn_key),
          ),
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 18, letterSpacing: 2),
          textCapitalization: TextCapitalization.characters,
        ),
        const SizedBox(height: 16),
        OutlinedButton.icon(
          onPressed: _loading
              ? null
              : () async {
                  final result = await Navigator.push<String>(
                    context,
                    MaterialPageRoute(
                      builder: (context) => const ClassCodeScannerPage(),
                    ),
                  );

                  if (!mounted) return;

                  final scannedCode = (result ?? '').trim();
                  if (scannedCode.isEmpty) return;

                  setState(() {
                    _classCodeCtrl.text = scannedCode;
                  });

                  await _submitClassCode();
                },
          icon: const Icon(Icons.qr_code_scanner),
          label: const Text('Skanna QR-kod istället'),
        ),
        if (_error != null) ...[
          const SizedBox(height: 16),
          Text(
            _error!,
            style: const TextStyle(color: Colors.red),
            textAlign: TextAlign.center,
          ),
        ],
        const SizedBox(height: 24),
        ElevatedButton(
          onPressed: _loading ? null : _submitClassCode,
          style: ElevatedButton.styleFrom(
            padding: const EdgeInsets.symmetric(vertical: 16),
          ),
          child: _loading
              ? const CircularProgressIndicator()
              : const Text('Fortsätt', style: TextStyle(fontSize: 16)),
        ),
      ],
    );
  }

  Widget _buildProgramStep(List<ProgramOption> availablePrograms) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final bottomInset = MediaQuery.of(context).viewPadding.bottom;
        return SingleChildScrollView(
          padding: EdgeInsets.only(bottom: 24 + bottomInset),
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: constraints.maxHeight),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.start,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Icon(
                  Icons.school_outlined,
                  size: 80,
                  color: Colors.orange,
                ),
                const SizedBox(height: 24),
                const Text(
                  'Välj ditt program',
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                const Text(
                  'Programvalet hjälper oss att senare visa rätt yrkesutgång och rätt innehåll.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.grey),
                ),
                const SizedBox(height: 32),
                ...availablePrograms.map((program) {
                  final hasSpecializations = program.specializations.isNotEmpty;
                  return Card(
                    margin: const EdgeInsets.only(bottom: 12),
                    child: RadioListTile<String>(
                      value: program.name,
                      groupValue: _selectedProgram,
                      onChanged: _loading
                          ? null
                          : (value) {
                              setState(() {
                                _selectedProgram = value;
                                _error = null;
                              });
                            },
                      title: Text(
                        program.name,
                        style: const TextStyle(fontSize: 16),
                      ),
                      subtitle: Text(
                        hasSpecializations
                            ? 'Yrkesutgång väljs i nästa steg'
                            : 'Yrkesutgång läggs till senare',
                      ),
                      controlAffinity: ListTileControlAffinity.trailing,
                      activeColor: Colors.orange,
                    ),
                  );
                }),
                if (_error != null) ...[
                  const SizedBox(height: 16),
                  Text(
                    _error!,
                    style: const TextStyle(color: Colors.red),
                    textAlign: TextAlign.center,
                  ),
                ],
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: _loading
                      ? null
                      : () => _submitProgram(availablePrograms),
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  child: _loading
                      ? const CircularProgressIndicator()
                      : Text(
                          programRequiresSpecialization(
                                _selectedProgram,
                                options: availablePrograms,
                              )
                              ? 'Fortsätt'
                              : 'Slutför',
                          style: const TextStyle(fontSize: 16),
                        ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildSpecializationStep(List<ProgramOption> availablePrograms) {
    final specializations = getSpecializationsForProgram(
      _selectedProgram,
      options: availablePrograms,
    );

    return LayoutBuilder(
      builder: (context, constraints) {
        final bottomInset = MediaQuery.of(context).viewPadding.bottom;
        return SingleChildScrollView(
          padding: EdgeInsets.only(bottom: 24 + bottomInset),
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: constraints.maxHeight),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.start,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Icon(Icons.construction, size: 80, color: Colors.orange),
                const SizedBox(height: 24),
                const Text(
                  'Välj din yrkesutgång',
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                Text(
                  'Din yrkesutgång avgör vilka arbetsmoment du ser i tidkorten',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.grey),
                ),
                const SizedBox(height: 32),
                ...specializations.map((spec) {
                  return Card(
                    margin: const EdgeInsets.only(bottom: 12),
                    child: RadioListTile<String>(
                      value: spec,
                      groupValue: _selectedSpecialization,
                      onChanged: _loading
                          ? null
                          : (value) {
                              setState(() {
                                _selectedSpecialization = value;
                                _error = null;
                              });
                              _completeOnboarding(availablePrograms);
                            },
                      title: Text(spec, style: const TextStyle(fontSize: 16)),
                      controlAffinity: ListTileControlAffinity.trailing,
                      activeColor: Colors.orange,
                    ),
                  );
                }),
                if (_error != null) ...[
                  const SizedBox(height: 16),
                  Text(
                    _error!,
                    style: const TextStyle(color: Colors.red),
                    textAlign: TextAlign.center,
                  ),
                ],
                if (_loading) ...[
                  const SizedBox(height: 24),
                  const Center(child: CircularProgressIndicator()),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}

class ClassCodeScannerPage extends StatefulWidget {
  const ClassCodeScannerPage({super.key});

  @override
  State<ClassCodeScannerPage> createState() => _ClassCodeScannerPageState();
}

class _ClassCodeScannerPageState extends State<ClassCodeScannerPage> {
  final MobileScannerController _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates,
  );
  bool _hasScanned = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _handleDetect(BarcodeCapture capture) {
    if (_hasScanned) return;
    if (capture.barcodes.isEmpty) return;
    final code = capture.barcodes.first.rawValue;
    if (code == null || code.trim().isEmpty) return;

    _hasScanned = true;
    Navigator.pop(context, code.trim());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Skanna QR-kod')),
      body: Stack(
        fit: StackFit.expand,
        children: [
          MobileScanner(controller: _controller, onDetect: _handleDetect),
          Align(
            alignment: Alignment.bottomCenter,
            child: Container(
              width: double.infinity,
              margin: const EdgeInsets.all(16),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.black.withOpacity(0.6),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Text(
                'Rikta kameran mot klassens QR-kod',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<User?>(
      stream: FirebaseAuth.instance.idTokenChanges(),
      builder: (authContext, authSnap) {
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
          builder: (profileContext, profileSnap) {
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

            // Bara lärare behöver e-postverifiering, elever använder klasskod.
            if (role == 'teacher' && !user.emailVerified) {
              return EmailVerificationScreen(user: user);
            }

            if (data != null &&
                data['role'] == 'teacher' &&
                data['approved'] != true) {
              return ApprovalPendingScreen(user: user);
            }

            switch (role) {
              case 'admin':
                return const AdminScreen();

              case 'teacher':
                return const MainNavigation();

              default: // student
                if (!user.emailVerified) {
                  return StudentEmailVerificationScreen(user: user);
                }

                // Kolla om eleven har begärt radering
                final deletionRequested =
                    data?['deletionRequested'] as bool? ?? false;
                if (deletionRequested) {
                  final deletionRequestedAt =
                      (data?['deletionRequestedAt'] as Timestamp?)?.toDate();
                  return DeletionPendingScreen(
                    user: user,
                    deletionRequestedAt: deletionRequestedAt,
                  );
                }

                final gdprConsentVersion = (data?['gdprConsentVersion'] ?? '')
                    .toString()
                    .trim();
                if (gdprConsentVersion != kCurrentGdprConsentVersion) {
                  return GdprConsentScreen(
                    user: user,
                    consentVersion: kCurrentGdprConsentVersion,
                  );
                }

                // Kolla om eleven har genomfört onboarding
                final onboardingComplete =
                    data?['onboardingComplete'] as bool? ?? false;
                if (!onboardingComplete) {
                  return const StudentOnboardingScreen();
                }

                final teacherUid = (data?['teacherUid'] ?? '')
                    .toString()
                    .trim();

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
    if (!mounted) return;
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
      if (!mounted) return;
      setState(() => _error = e.message ?? 'Inloggning misslyckades.');
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Ett oväntat fel uppstod: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _showForgotPasswordDialog() async {
    final initialEmail = _emailCtrl.text.trim().toLowerCase();
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ForgotPasswordScreen(initialEmail: initialEmail),
      ),
    );
  }

  Future<void> _showRegisterDialog() async {
    final shouldCreateStudent = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Skapa elevkonto'),
        content: const Text(
          'I appen kan du skapa elevkonto.\n\nLärare ansluter sig till appen via hemsidan.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Avbryt'),
          ),
          ElevatedButton.icon(
            onPressed: () => Navigator.pop(ctx, true),
            icon: const Icon(Icons.school),
            label: const Text('Fortsätt som elev'),
          ),
        ],
      ),
    );

    if (shouldCreateStudent == true) {
      await _showStudentRegisterDialog();
    }
  }

  Future<void> _showStudentRegisterDialog() async {
    await showDialog(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => _StudentRegistrationDialog(),
    );
  }

  Future<void> _showTeacherRegisterDialog() async {
    print('Inne i _showTeacherRegisterDialog');
    final firstNameCtrl = TextEditingController();
    final lastNameCtrl = TextEditingController();
    final passCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    String? selectedSchool;

    // Hämta skolor från Firestore
    final schoolsSnap = await FirebaseFirestore.instance
        .collection('schools')
        .orderBy('name')
        .get();
    final schools = schoolsSnap.docs.map((d) => d['name'].toString()).toList();

    Map<String, String>? result;

    try {
      result = await showDialog<Map<String, String>>(
        context: context,
        builder: (dialogContext) => StatefulBuilder(
          builder: (context, setState) => AlertDialog(
            title: const Text('Skapa lärarkonto'),
            content: SingleChildScrollView(
              child: SizedBox(
                width: 400,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    TextField(
                      controller: firstNameCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Namn',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: lastNameCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Efternamn',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: passCtrl,
                      obscureText: true,
                      decoration: const InputDecoration(
                        labelText: 'Lösenord',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: emailCtrl,
                      decoration: const InputDecoration(
                        labelText: 'E-post',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      value: selectedSchool,
                      items: schools
                          .map(
                            (s) => DropdownMenuItem(value: s, child: Text(s)),
                          )
                          .toList(),
                      onChanged: (v) => setState(() => selectedSchool = v),
                      decoration: const InputDecoration(
                        labelText: 'Skola',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Admin kommer att granska din ansökan innan du får tillgång',
                      style: TextStyle(fontSize: 12, color: Colors.grey),
                    ),
                  ],
                ),
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(dialogContext).pop(),
                child: const Text('Avbryt'),
              ),
              ElevatedButton(
                onPressed: () {
                  // Spara värden
                  final firstName = firstNameCtrl.text.trim();
                  final lastName = lastNameCtrl.text.trim();
                  final password = passCtrl.text;
                  final email = emailCtrl.text.trim();
                  final school = selectedSchool ?? '';

                  if (firstName.isEmpty ||
                      lastName.isEmpty ||
                      password.isEmpty ||
                      email.isEmpty ||
                      school.isEmpty) {
                    ScaffoldMessenger.of(dialogContext).showSnackBar(
                      const SnackBar(content: Text('Fyll i alla fält')),
                    );
                    return;
                  }

                  // Returnera värdena och stäng dialogen
                  Navigator.of(dialogContext).pop({
                    'firstName': firstName,
                    'lastName': lastName,
                    'email': email,
                    'password': password,
                    'school': school,
                  });
                },
                child: const Text('Skapa konto'),
              ),
            ],
          ),
        ),
      );
    } finally {
      // Controllers dispos:as EFTER att showDialog returnerat
      firstNameCtrl.dispose();
      lastNameCtrl.dispose();
      passCtrl.dispose();
      emailCtrl.dispose();
    }

    // Kör async operation EFTER dialogen är helt stängd och disposed
    if (result != null) {
      await _registerTeacher(
        firstName: result['firstName']!,
        lastName: result['lastName']!,
        email: result['email']!,
        password: result['password']!,
        school: result['school']!,
      );
    }
  }

  Future<void> _registerTeacher({
    required String firstName,
    required String lastName,
    required String email,
    required String password,
    required String school,
  }) async {
    if (!mounted) return;

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final cred = await FirebaseAuth.instance.createUserWithEmailAndPassword(
        email: email,
        password: password,
      );

      final uid = cred.user!.uid;
      final fullName = '$firstName $lastName'.trim();

      await cred.user!.updateDisplayName(fullName);

      // Skicka verifieringsmejl innan vi väntar på admin
      try {
        print(
          '🔄 Attempting to send verification email to: ${cred.user!.email}',
        );

        // Försök först utan ActionCodeSettings
        await cred.user!.sendEmailVerification();

        print('✅ Firebase reported: Verification email sent successfully');
        print('📧 Check these locations:');
        print('   - Inbox for: ${cred.user!.email}');
        print('   - Spam/Junk folder');
        print('   - Promotions tab (Gmail)');
        print('⏱️ Email may take 1-5 minutes to arrive');
        print('🔍 If no email after 5 min, check Firebase Console:');
        print('   Authentication > Settings > Authorized domains');
        print('   Authentication > Templates > Email verification');
      } catch (e) {
        print('❌ FAILED to send verification email!');
        print('   Error type: ${e.runtimeType}');
        print('   Error message: $e');
        if (e is FirebaseAuthException) {
          print('   Error code: ${e.code}');
          print('   Error message: ${e.message}');
        }
        print('⚠️ IMPORTANT: User created but email NOT sent!');
        print('   You must manually verify or resend from Firebase Console');
      }

      // Skapa lärarkonto med pending-status
      await FirebaseFirestore.instance.collection('users').doc(uid).set({
        'name': fullName,
        'displayName': fullName,
        'firstName': firstName,
        'lastName': lastName,
        'email': email.toLowerCase(),
        'emailVerified': false,
        'role': 'teacher',
        'school': school,
        'approved': false, // Väntar på admin-godkännande
        'createdAt': FieldValue.serverTimestamp(),
      });

      if (mounted) {
        setState(() {
          _error = null;
          _loading = false;
        });

        // Visa meddelande om att de måste vänta på godkännande
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Ditt lärarkonto har skapats men väntar på godkännande. Kontrollera e-post och klicka på verifieringslänken. Om mejlet inte syns, kontrollera skräppost/spam.',
            ),
          ),
        );

        // Logga ut tills kontot godkänns
        await FirebaseAuth.instance.signOut();
      }
    } on FirebaseAuthException catch (e) {
      if (mounted) {
        setState(() => _error = e.message ?? 'Konto kunde inte skapas.');
      }
    } catch (e) {
      if (mounted) {
        setState(() => _error = 'Fel: $e');
      }
    }
  }

  Future<void> _openWebsite() async {
    final uri = Uri.parse('https://www.apl-appen.com');
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Color(0xFFFFF7ED), // orange-50
              Color(0xFFFFEDD5), // orange-100
            ],
          ),
        ),
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Card(
                elevation: 8,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(32),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Rubrik
                      const Text(
                        'APL-appen',
                        style: TextStyle(
                          fontSize: 32,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFFEA580C), // orange-600
                        ),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Logga in',
                        style: TextStyle(
                          fontSize: 16,
                          color: Color(0xFF6B7280), // gray-600
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Informationsruta för elever innan de fortsätter i appen.
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFF7ED), // orange-50
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                            color: const Color(0xFFFDBA74), // orange-300
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Icon(
                                  Icons.info_outline,
                                  color: Color(0xFFEA580C), // orange-600
                                  size: 20,
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      RichText(
                                        text: const TextSpan(
                                          style: TextStyle(
                                            fontSize: 13,
                                            height: 1.35,
                                            color: Color(
                                              0xFF9A3412,
                                            ), // orange-800
                                          ),
                                          children: [
                                            TextSpan(text: 'Appen fungerar '),
                                            TextSpan(
                                              text: 'BARA',
                                              style: TextStyle(
                                                fontWeight: FontWeight.w700,
                                              ),
                                            ),
                                            TextSpan(
                                              text: ' om du är elev till en ',
                                            ),
                                            TextSpan(
                                              text: 'lärare',
                                              style: TextStyle(
                                                fontWeight: FontWeight.w700,
                                              ),
                                            ),
                                            TextSpan(
                                              text:
                                                  ' som är ansluten till appen via appens hemsida',
                                            ),
                                          ],
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      TextButton(
                                        onPressed: _openWebsite,
                                        style: TextButton.styleFrom(
                                          foregroundColor: const Color(
                                            0xFFEA580C,
                                          ),
                                          padding: EdgeInsets.zero,
                                          minimumSize: const Size(0, 0),
                                          tapTargetSize:
                                              MaterialTapTargetSize.shrinkWrap,
                                          alignment: Alignment.centerLeft,
                                        ),
                                        child: const Text(
                                          'www.apl-appen.com',
                                          style: TextStyle(
                                            decoration:
                                                TextDecoration.underline,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            const Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Icon(
                                  Icons.info_outline,
                                  color: Color(0xFFEA580C), // orange-600
                                  size: 20,
                                ),
                                SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    'Lärare ansluter sig till appen via hemsidan.',
                                    style: TextStyle(
                                      fontSize: 13,
                                      height: 1.35,
                                      color: Color(0xFF9A3412), // orange-800
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),

                      // E-post fält
                      TextField(
                        controller: _emailCtrl,
                        keyboardType: TextInputType.emailAddress,
                        decoration: InputDecoration(
                          labelText: 'E-post',
                          hintText: 'din@email.se',
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: const BorderSide(
                              color: Color(0xFFEA580C), // orange-600
                              width: 2,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Lösenord fält
                      TextField(
                        controller: _passCtrl,
                        obscureText: true,
                        decoration: InputDecoration(
                          labelText: 'Lösenord',
                          hintText: '••••••••',
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: const BorderSide(
                              color: Color(0xFFEA580C), // orange-600
                              width: 2,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),

                      Align(
                        alignment: Alignment.centerRight,
                        child: TextButton(
                          onPressed: _loading
                              ? null
                              : _showForgotPasswordDialog,
                          style: TextButton.styleFrom(
                            foregroundColor: const Color(0xFFEA580C),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 4,
                              vertical: 2,
                            ),
                            minimumSize: const Size(0, 0),
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          ),
                          child: const Text('Glömt lösenord?'),
                        ),
                      ),
                      const SizedBox(height: 8),

                      // Felmeddelande
                      if (_error != null) ...[
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEF2F2), // red-50
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Row(
                            children: [
                              const Icon(
                                Icons.error_outline,
                                color: Color(0xFFDC2626), // red-600
                                size: 20,
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  _error!,
                                  style: const TextStyle(
                                    color: Color(0xFFDC2626), // red-600
                                    fontSize: 14,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],

                      // Logga in knapp
                      SizedBox(
                        width: double.infinity,
                        height: 48,
                        child: ElevatedButton(
                          onPressed: _loading ? null : _signIn,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(
                              0xFFEA580C,
                            ), // orange-600
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8),
                            ),
                            elevation: 0,
                          ),
                          child: _loading
                              ? const SizedBox(
                                  height: 20,
                                  width: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    valueColor: AlwaysStoppedAnimation<Color>(
                                      Colors.white,
                                    ),
                                  ),
                                )
                              : const Text(
                                  'Logga in',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Skapa konto knapp
                      SizedBox(
                        width: double.infinity,
                        height: 48,
                        child: OutlinedButton(
                          onPressed: _loading ? null : _showRegisterDialog,
                          style: OutlinedButton.styleFrom(
                            foregroundColor: const Color(
                              0xFFEA580C,
                            ), // orange-600
                            side: const BorderSide(
                              color: Color(0xFFEA580C), // orange-600
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8),
                            ),
                          ),
                          child: const Text(
                            'Skapa konto',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class ForgotPasswordScreen extends StatefulWidget {
  final String initialEmail;

  const ForgotPasswordScreen({required this.initialEmail, super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  late final TextEditingController _emailCtrl;
  bool _sending = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _emailCtrl = TextEditingController(text: widget.initialEmail);
  }

  @override
  void dispose() {
    _emailCtrl.dispose();
    super.dispose();
  }

  String _mapPasswordResetError(FirebaseAuthException error) {
    switch (error.code) {
      case 'invalid-email':
      case 'auth/invalid-email':
        return 'Ange en giltig e-postadress.';
      case 'too-many-requests':
      case 'auth/too-many-requests':
        return 'För många försök. Vänta en stund och försök igen.';
      case 'network-request-failed':
      case 'auth/network-request-failed':
        return 'Nätverksfel. Kontrollera din anslutning och försök igen.';
      default:
        return error.message ??
            'Kunde inte skicka återställningslänken just nu.';
    }
  }

  Future<void> _sendResetLink() async {
    final email = _emailCtrl.text.trim().toLowerCase();
    if (email.isEmpty) {
      setState(() {
        _error = 'Ange din e-postadress för att återställa lösenordet.';
      });
      return;
    }

    setState(() {
      _sending = true;
      _error = null;
    });

    try {
      await FirebaseAuth.instance.sendPasswordResetEmail(email: email);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Om adressen finns registrerad har vi skickat en återställningslänk till din e-post. Kontrollera även skräppost.',
          ),
        ),
      );
      Navigator.of(context).pop();
    } on FirebaseAuthException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = _mapPasswordResetError(e);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Kunde inte skicka återställningslänken just nu.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _sending = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFFF8F2),
      appBar: AppBar(
        title: const Text('Glömt lösenord'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        foregroundColor: const Color(0xFF1A1A2E),
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Card(
              elevation: 8,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Återställ lösenord',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFFEA580C),
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Fyll i din e-post så skickar vi en länk för att återställa lösenordet.',
                      style: TextStyle(color: Color(0xFF6B7280), fontSize: 14),
                    ),
                    const SizedBox(height: 20),
                    TextField(
                      controller: _emailCtrl,
                      keyboardType: TextInputType.emailAddress,
                      autocorrect: false,
                      decoration: InputDecoration(
                        labelText: 'E-post',
                        hintText: 'din@email.se',
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                          borderSide: const BorderSide(
                            color: Color(0xFFEA580C),
                            width: 2,
                          ),
                        ),
                      ),
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 12),
                      Text(
                        _error!,
                        style: const TextStyle(
                          color: Color(0xFFDC2626),
                          fontSize: 13,
                        ),
                      ),
                    ],
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: ElevatedButton(
                        onPressed: _sending ? null : _sendResetLink,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFEA580C),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                          elevation: 0,
                        ),
                        child: _sending
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  valueColor: AlwaysStoppedAnimation<Color>(
                                    Colors.white,
                                  ),
                                ),
                              )
                            : const Text(
                                'Skicka återställningslänk',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// skärm som visas när användarens e-post inte är verifierad
class EmailVerificationScreen extends StatefulWidget {
  final User user;
  const EmailVerificationScreen({required this.user, super.key});

  @override
  State<EmailVerificationScreen> createState() =>
      _EmailVerificationScreenState();
}

class _EmailVerificationScreenState extends State<EmailVerificationScreen> {
  bool _sending = false;
  String? _message;

  Future<void> _reload() async {
    setState(() {
      _message = 'Kontrollerar...';
    });

    try {
      await widget.user.reload();
      final currentUser = FirebaseAuth.instance.currentUser;

      if (currentUser != null && currentUser.emailVerified) {
        // Verifieringen lyckades! Logga ut och låt användaren logga in igen
        setState(() {
          _message =
              'E-post verifierad! Loggar ut - logga in igen för att fortsätta.';
        });
        await Future.delayed(const Duration(seconds: 2));
        await FirebaseAuth.instance.signOut();
      } else {
        setState(() {
          _message =
              'E-posten är fortfarande inte verifierad. Kontrollera din inkorg och klicka på länken.';
        });
      }
    } catch (e) {
      setState(() {
        _message = 'Fel vid kontroll: $e';
      });
    }
  }

  Future<void> _resend() async {
    setState(() {
      _sending = true;
      _message = null;
    });
    try {
      final actionCodeSettings = ActionCodeSettings(
        url: 'https://www.apl-appen.com',
        handleCodeInApp: false,
        androidPackageName: 'com.aplappen.app',
        androidInstallApp: false,
      );
      await widget.user.sendEmailVerification(actionCodeSettings);
      setState(() {
        _message =
            'Verifieringsmejl skickat igen. Kontrollera även spam-mappen.';
      });
      print('✅ Verification email re-sent to: ${widget.user.email}');
    } catch (e) {
      setState(() {
        _message = 'Kunde inte skicka mejl: $e';
      });
      print('❌ Error sending verification email: $e');
    } finally {
      setState(() {
        _sending = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Verifiera e-post'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Logga ut',
            onPressed: () => FirebaseAuth.instance.signOut(),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text(
              'Ett verifieringsmejl har skickats till din adress. Klicka på länken i mejlet för att aktivera kontot.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 16),
            ),
            const SizedBox(height: 24),
            if (_message != null) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.orange.shade50,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  _message!,
                  style: TextStyle(color: Colors.orange.shade900),
                  textAlign: TextAlign.center,
                ),
              ),
              const SizedBox(height: 16),
            ],
            ElevatedButton(
              onPressed: _sending ? null : _resend,
              child: _sending
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Skicka om e-post'),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _reload,
              child: const Text('Jag har verifierat – uppdatera'),
            ),
          ],
        ),
      ),
    );
  }
}

class StudentEmailVerificationScreen extends StatefulWidget {
  final User user;
  const StudentEmailVerificationScreen({required this.user, super.key});

  @override
  State<StudentEmailVerificationScreen> createState() =>
      _StudentEmailVerificationScreenState();
}

class _StudentEmailVerificationScreenState
    extends State<StudentEmailVerificationScreen> {
  bool _sending = false;
  String? _message;

  Future<void> _reloadAndContinue() async {
    setState(() {
      _message = 'Kontrollerar verifiering...';
    });

    try {
      await widget.user.reload();
      final currentUser = FirebaseAuth.instance.currentUser;

      if (currentUser != null && currentUser.emailVerified) {
        setState(() {
          _message =
              'E-post verifierad! Du skickas vidare till klasskodssidan.';
        });
        await Future.delayed(const Duration(milliseconds: 600));
        if (!mounted) return;
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const StudentOnboardingScreen()),
          (route) => false,
        );
      } else {
        setState(() {
          _message =
              'Kontot är fortfarande inte verifierat. Kontrollera din e-post och klicka på verifieringslänken.';
        });
      }
    } catch (e) {
      setState(() {
        _message = 'Fel vid kontroll: $e';
      });
    }
  }

  Future<void> _resend() async {
    setState(() {
      _sending = true;
      _message = null;
    });

    try {
      final actionCodeSettings = ActionCodeSettings(
        url: 'https://www.apl-appen.com',
        handleCodeInApp: false,
        androidPackageName: 'com.aplappen.app',
        androidInstallApp: false,
      );
      await widget.user.sendEmailVerification(actionCodeSettings);
      setState(() {
        _message =
            'Verifieringsmejl skickat igen. Kontrollera även skräppost.';
      });
    } catch (e) {
      setState(() {
        _message = 'Kunde inte skicka mejl: $e';
      });
    } finally {
      if (mounted) {
        setState(() {
          _sending = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Verifiera din e-post'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Logga ut',
            onPressed: () => FirebaseAuth.instance.signOut(),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text(
              'Ditt konto är skapat men inte verifierat ännu. Vi har skickat ett verifieringsmejl till din e-post.\n\nNär du verifierat mejlen släpps du vidare till klasskodssidan.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 16),
            ),
            const SizedBox(height: 24),
            if (_message != null) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.orange.shade50,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  _message!,
                  style: TextStyle(color: Colors.orange.shade900),
                  textAlign: TextAlign.center,
                ),
              ),
              const SizedBox(height: 16),
            ],
            ElevatedButton(
              onPressed: _sending ? null : _resend,
              child: _sending
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Skicka om e-post'),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _reloadAndContinue,
              child: const Text('Jag har verifierat - fortsätt'),
            ),
          ],
        ),
      ),
    );
  }
}

// Dialog som hanterar elevregistrering internt för att undvika race conditions
class _StudentRegistrationDialog extends StatefulWidget {
  const _StudentRegistrationDialog();

  @override
  State<_StudentRegistrationDialog> createState() =>
      _StudentRegistrationDialogState();
}

class _StudentRegistrationDialogState
    extends State<_StudentRegistrationDialog> {
  final _firstNameCtrl = TextEditingController();
  final _lastNameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  bool _loading = false;
  String? _error;

  bool get _hasMinLength => _passCtrl.text.length >= 8;
  bool get _hasUppercase => RegExp(r'[A-Z]').hasMatch(_passCtrl.text);
  bool get _hasDigit => RegExp(r'\d').hasMatch(_passCtrl.text);
  bool get _hasLowercase => RegExp(r'[a-z]').hasMatch(_passCtrl.text);
  bool get _hasSpecial => RegExp(r'[^A-Za-z0-9]').hasMatch(_passCtrl.text);

  int get _passwordStrengthScore {
    final password = _passCtrl.text;
    if (password.isEmpty) return 0;

    var score = 0;
    if (_hasMinLength) score += 1;
    if (_hasUppercase) score += 1;
    if (_hasDigit) score += 1;
    if (_hasLowercase) score += 1;
    if (_hasSpecial || password.length >= 12) score += 1;
    return score;
  }

  String get _passwordStrengthLabel {
    final score = _passwordStrengthScore;
    if (score == 0) return 'Ej angivet';
    if (score <= 2) return 'Svagt';
    if (score <= 4) return 'Medel';
    return 'Starkt';
  }

  Color get _passwordStrengthColor {
    final score = _passwordStrengthScore;
    if (score == 0) return Colors.grey;
    if (score <= 2) return Colors.red;
    if (score <= 4) return Colors.orange;
    return Colors.green;
  }

  String? _validatePassword(String password) {
    if (password.length < 8) {
      return 'Lösenordet måste vara minst 8 tecken.';
    }
    if (!RegExp(r'[A-Z]').hasMatch(password)) {
      return 'Lösenordet måste innehålla minst en stor bokstav.';
    }
    if (!RegExp(r'\d').hasMatch(password)) {
      return 'Lösenordet måste innehålla minst en siffra.';
    }
    return null;
  }

  Widget _buildPasswordRule(String text, bool passed) {
    return Row(
      children: [
        Icon(
          passed ? Icons.check_circle : Icons.radio_button_unchecked,
          size: 16,
          color: passed ? Colors.green : Colors.grey,
        ),
        const SizedBox(width: 6),
        Text(
          text,
          style: TextStyle(
            fontSize: 12,
            color: passed ? Colors.green.shade700 : Colors.grey.shade700,
          ),
        ),
      ],
    );
  }

  Widget _buildPasswordStrengthIndicator() {
    final score = _passwordStrengthScore;
    final color = _passwordStrengthColor;
    final progress = score / 5;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Lösenordsstyrka',
              style: TextStyle(fontSize: 12, color: Colors.black87),
            ),
            Text(
              _passwordStrengthLabel,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: color,
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: LinearProgressIndicator(
            minHeight: 8,
            value: progress,
            backgroundColor: Colors.grey.shade300,
            valueColor: AlwaysStoppedAnimation<Color>(color),
          ),
        ),
      ],
    );
  }

  @override
  void dispose() {
    _firstNameCtrl.dispose();
    _lastNameCtrl.dispose();
    _emailCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  Future<void> _register() async {
    final firstName = _firstNameCtrl.text.trim();
    final lastName = _lastNameCtrl.text.trim();
    final email = _emailCtrl.text.trim();
    final password = _passCtrl.text;

    if (firstName.isEmpty ||
        lastName.isEmpty ||
        email.isEmpty ||
        password.isEmpty) {
      setState(() => _error = 'Alla fält måste fyllas i.');
      return;
    }

    final passwordError = _validatePassword(password);
    if (passwordError != null) {
      setState(() => _error = passwordError);
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final cred = await FirebaseAuth.instance.createUserWithEmailAndPassword(
        email: email,
        password: password,
      );

      final uid = cred.user!.uid;
      final fullName = '$firstName $lastName'.trim();

      await cred.user!.updateDisplayName(fullName);

      final actionCodeSettings = ActionCodeSettings(
        url: 'https://www.apl-appen.com',
        handleCodeInApp: false,
        androidPackageName: 'com.aplappen.app',
        androidInstallApp: false,
      );
      await cred.user!.sendEmailVerification(actionCodeSettings);

      await FirebaseFirestore.instance.collection('users').doc(uid).set({
        'name': fullName,
        'displayName': fullName,
        'firstName': firstName,
        'lastName': lastName,
        'email': email.toLowerCase(),
        'role': 'student',
        'createdAt': FieldValue.serverTimestamp(),
        'onboardingComplete': false,
      });

      // createUserWithEmailAndPassword loggar in användaren automatiskt
      // AuthGate kommer visa StudentOnboardingScreen
      if (mounted) Navigator.pop(context);
    } on FirebaseAuthException catch (e) {
      if (mounted) {
        setState(() {
          _error = e.message ?? 'Konto kunde inte skapas.';
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Fel: $e';
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Skapa elevkonto'),
      content: SingleChildScrollView(
        child: SizedBox(
          width: 400,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              TextField(
                controller: _firstNameCtrl,
                decoration: const InputDecoration(
                  labelText: 'Namn',
                  border: OutlineInputBorder(),
                ),
                enabled: !_loading,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _lastNameCtrl,
                decoration: const InputDecoration(
                  labelText: 'Efternamn',
                  border: OutlineInputBorder(),
                ),
                enabled: !_loading,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _emailCtrl,
                decoration: const InputDecoration(
                  labelText: 'E-post',
                  border: OutlineInputBorder(),
                ),
                keyboardType: TextInputType.emailAddress,
                enabled: !_loading,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _passCtrl,
                decoration: const InputDecoration(
                  labelText: 'Lösenord',
                  hintText: 'Minst 8 tecken, 1 stor bokstav, 1 siffra',
                  border: OutlineInputBorder(),
                ),
                onChanged: (_) => setState(() {}),
                obscureText: true,
                enabled: !_loading,
              ),
              const SizedBox(height: 8),
              _buildPasswordStrengthIndicator(),
              const SizedBox(height: 8),
              _buildPasswordRule('Minst 8 tecken', _hasMinLength),
              const SizedBox(height: 4),
              _buildPasswordRule('Minst 1 stor bokstav', _hasUppercase),
              const SizedBox(height: 4),
              _buildPasswordRule('Minst 1 siffra', _hasDigit),
              const SizedBox(height: 8),
              const Text(
                'Du kommer att ange klasskod, program och yrkesutgång efter att din e-mail har verifierats.',
                style: TextStyle(fontSize: 12, color: Colors.grey),
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(
                  _error!,
                  style: const TextStyle(color: Colors.red, fontSize: 12),
                ),
              ],
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _loading ? null : () => Navigator.pop(context),
          child: const Text('Avbryt'),
        ),
        ElevatedButton(
          onPressed: _loading ? null : _register,
          child: _loading
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Skapa konto'),
        ),
      ],
    );
  }
}

class ApprovalPendingScreen extends StatefulWidget {
  final User user;
  const ApprovalPendingScreen({required this.user, super.key});

  @override
  State<ApprovalPendingScreen> createState() => _ApprovalPendingScreenState();
}

class _ApprovalPendingScreenState extends State<ApprovalPendingScreen> {
  bool _emailVerified = false;
  bool _approved = false;
  bool _checking = false;
  String? _statusMessage;

  @override
  void initState() {
    super.initState();
    _refreshStatus();
  }

  Future<void> _refreshStatus() async {
    if (!mounted) return;

    setState(() {
      _checking = true;
      _statusMessage = 'Uppdaterar status...';
    });

    try {
      await widget.user.reload();
      final currentUser = FirebaseAuth.instance.currentUser;
      final userRef = FirebaseFirestore.instance
          .collection('users')
          .doc(widget.user.uid);
      final emailVerified = currentUser?.emailVerified == true;
      var userDoc = await userRef.get();

      if (emailVerified && userDoc.data()?['emailVerified'] != true) {
        await userRef.update({
          'emailVerified': true,
          'emailVerifiedAt': FieldValue.serverTimestamp(),
        });
        userDoc = await userRef.get();
      }

      if (!mounted) return;
      setState(() {
        _emailVerified = emailVerified;
        _approved = userDoc.data()?['approved'] == true;
        _statusMessage =
            'Senast uppdaterad: ${TimeOfDay.now().format(context)}';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _statusMessage = 'Kunde inte uppdatera status: $e';
      });
    } finally {
      if (!mounted) return;
      setState(() {
        _checking = false;
      });
    }
  }

  Widget _statusTile({
    required IconData icon,
    required String title,
    required bool done,
    required String doneText,
    required String pendingText,
  }) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: done ? Colors.green.shade50 : Colors.orange.shade50,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: done ? Colors.green.shade200 : Colors.orange.shade200,
        ),
      ),
      child: Row(
        children: [
          Icon(
            done ? Icons.check_circle : icon,
            color: done ? Colors.green.shade700 : Colors.orange.shade700,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 4),
                Text(done ? doneText : pendingText),
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Konto väntar på godkännande'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Logga ut',
            onPressed: () => FirebaseAuth.instance.signOut(),
          ),
        ],
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 520),
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.hourglass_top, size: 56, color: Colors.orange),
                const SizedBox(height: 16),
                const Text(
                  'Nästan klart!',
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Ditt lärarkonto är registrerat. Nedan ser du aktuell status för aktivering.',
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                _statusTile(
                  icon: Icons.mark_email_unread,
                  title: '1. E-postverifiering',
                  done: _emailVerified,
                  doneText: 'Klar: Din e-post är verifierad.',
                  pendingText:
                      'Väntar: Verifiera din e-post via länken i mejlet (kolla även spam).',
                ),
                _statusTile(
                  icon: Icons.admin_panel_settings,
                  title: '2. Admin-godkännande',
                  done: _approved,
                  doneText: 'Klar: Administratören har godkänt ditt konto.',
                  pendingText:
                      'Väntar: En administratör behöver godkänna ditt konto.',
                ),
                const SizedBox(height: 12),
                if (_statusMessage != null)
                  Text(
                    _statusMessage!,
                    style: TextStyle(color: Colors.grey.shade700),
                    textAlign: TextAlign.center,
                  ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _checking ? null : _refreshStatus,
                    icon: _checking
                        ? const SizedBox(
                            height: 16,
                            width: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.refresh),
                    label: Text(
                      _checking ? 'Uppdaterar...' : 'Uppdatera status',
                    ),
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

  Future<void> _addStudentToClass(
    String teacherUid,
    List<String> classNames,
  ) async {
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
      final role = (userDoc.data()['role'] ?? 'student')
          .toString()
          .trim()
          .toLowerCase();
      if (role != 'student') {
        setState(() => _msg = 'Användaren är inte en elev.');
        return;
      }

      final classId = (_addStudentClass == 'NONE') ? '' : _addStudentClass;
      final currentTeacherDoc = await FirebaseFirestore.instance
          .collection('users')
          .doc(teacherUid)
          .get();
      final teacherSchool = (currentTeacherDoc.data()?['school'] ?? '')
          .toString()
          .trim();

      await userDoc.reference.set({
        'teacherUid': teacherUid,
        'teacherId': teacherUid,
        'classId': classId,
        if (teacherSchool.isNotEmpty) 'school': teacherSchool,
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
            final classNames =
                classDocs
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
                          .map(
                            (c) => DropdownMenuItem(
                              value: c,
                              child: Text(c == 'ALL' ? 'Alla klasser' : c),
                            ),
                          )
                          .toList(),
                      onChanged: (v) =>
                          setState(() => _filterClass = v ?? 'ALL'),
                    ),
                  ],
                ),

                const SizedBox(height: 12),
                const Text(
                  'Lägg till elev via e-post',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
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
                          const DropdownMenuItem(
                            value: 'NONE',
                            child: Text('Ingen'),
                          ),
                          ...classNames.map(
                            (c) => DropdownMenuItem(value: c, child: Text(c)),
                          ),
                        ],
                        onChanged: (v) =>
                            setState(() => _addStudentClass = v ?? 'NONE'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    ElevatedButton(
                      onPressed: () =>
                          _addStudentToClass(teacherUid, classNames),
                      child: const Text('Lägg till'),
                    ),
                  ],
                ),
                if (_msg != null) ...[
                  const SizedBox(height: 8),
                  Text(_msg!, style: const TextStyle(color: Colors.green)),
                ],
                const SizedBox(height: 12),
                const Text(
                  'Generera kopplingskod',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
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
                          const DropdownMenuItem(
                            value: 'NONE',
                            child: Text('Ingen'),
                          ),
                          ...classNames.map(
                            (c) => DropdownMenuItem(value: c, child: Text(c)),
                          ),
                        ],
                        onChanged: (v) =>
                            setState(() => _inviteForClass = v ?? 'NONE'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    ElevatedButton(
                      onPressed: () => _createInvite(teacherUid, classNames),
                      child: const Text('Generera kod'),
                    ),
                    const SizedBox(width: 12),
                    if (_lastInviteCode != null)
                      SelectableText('Kod: $_lastInviteCode'),
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
                      if (studentSnap.connectionState ==
                          ConnectionState.waiting) {
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
                        final classId = (d.data()['classId'] ?? '')
                            .toString()
                            .trim();
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
                          final name = (data['displayName'] ?? '')
                              .toString()
                              .trim();
                          final currentClass = (data['classId'] ?? '')
                              .toString()
                              .trim();

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
                                      builder: (_) => StudentDetailScreen(
                                        studentUid: studentUid,
                                      ),
                                    ),
                                  );
                                },

                                trailing: SizedBox(
                                  width: 170,
                                  child: DropdownButtonFormField<String>(
                                    initialValue: currentClass.isEmpty
                                        ? 'NONE'
                                        : currentClass,
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
                                      final newClass =
                                          (v == null || v == 'NONE') ? null : v;
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

  const StudentDetailScreen({super.key, required this.studentUid});

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

          return SingleChildScrollView(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Header
                  Text(
                    name.isEmpty ? 'Okänt namn' : name,
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  if (email.isNotEmpty) Text('E-post: $email'),
                  const SizedBox(height: 6),
                  Text('Klass: ${classId.isEmpty ? 'Ingen' : classId}'),
                  const SizedBox(height: 18),
                  const Divider(),
                  const SizedBox(height: 12),

                  // Tidkort-knapp
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () {
                        final now = DateTime.now();
                        final monday = now.subtract(
                          Duration(days: now.weekday - DateTime.monday),
                        );
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
                      child: const Text('Se tidkort'),
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Bedömningar-sektion
                  const Text(
                    'Bedömningar',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 12),

                  StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
                    stream: FirebaseFirestore.instance
                        .collection('assessments')
                        .where('studentUid', isEqualTo: studentUid)
                        .where(
                          'teacherUid',
                          isEqualTo: FirebaseAuth.instance.currentUser?.uid ?? '',
                        )
                        .orderBy('submittedAt', descending: true)
                        .snapshots(),
                    builder: (context, assessmentSnap) {
                      if (assessmentSnap.connectionState ==
                          ConnectionState.waiting) {
                        return const Center(child: CircularProgressIndicator());
                      }

                      final assessments = assessmentSnap.data?.docs ?? [];

                      if (assessments.isEmpty) {
                        return Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade100,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Text(
                            'Inga bedömningar än.',
                            style: TextStyle(color: Colors.grey),
                          ),
                        );
                      }

                      return ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: assessments.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (context, i) {
                          final assessment = assessments[i].data();
                          final supervisorName =
                              (assessment['supervisorName'] ?? '').toString();
                          final supervisorCompany =
                              (assessment['supervisorCompany'] ?? '')
                                  .toString();
                          final feedback = (assessment['feedback'] ?? '')
                              .toString();
                          final phone = (assessment['supervisorPhone'] ?? '')
                              .toString();
                          final submittedAt =
                              (assessment['submittedAt'] as Timestamp?)
                                  ?.toDate();

                          return Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              border: Border.all(color: Colors.green.shade200),
                              borderRadius: BorderRadius.circular(8),
                              color: Colors.green.shade50,
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          supervisorName,
                                          style: const TextStyle(
                                            fontWeight: FontWeight.bold,
                                            fontSize: 14,
                                          ),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          supervisorCompany,
                                          style: TextStyle(
                                            fontSize: 12,
                                            color: Colors.grey.shade600,
                                          ),
                                        ),
                                      ],
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 8,
                                        vertical: 4,
                                      ),
                                      decoration: BoxDecoration(
                                        color: Colors.green.shade400,
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: const Text(
                                        'Godkänd ✅',
                                        style: TextStyle(
                                          color: Colors.white,
                                          fontSize: 11,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                if (feedback.isNotEmpty)
                                  Text(
                                    feedback,
                                    style: TextStyle(
                                      fontSize: 13,
                                      color: Colors.grey.shade700,
                                    ),
                                  ),
                                const SizedBox(height: 8),
                                Row(
                                  children: [
                                    Icon(
                                      Icons.phone,
                                      size: 14,
                                      color: Colors.grey.shade600,
                                    ),
                                    const SizedBox(width: 6),
                                    Text(
                                      phone,
                                      style: TextStyle(
                                        fontSize: 12,
                                        color: Colors.grey.shade600,
                                      ),
                                    ),
                                  ],
                                ),
                                if (submittedAt != null) ...[
                                  const SizedBox(height: 6),
                                  Text(
                                    'Inlämnad: ${submittedAt.day}/${submittedAt.month.toString().padLeft(2, '0')}',
                                    style: TextStyle(
                                      fontSize: 11,
                                      color: Colors.grey.shade500,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          );
                        },
                      );
                    },
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      onPressed: () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Bedömning kommer snart 🙂'),
                          ),
                        );
                      },
                      child: const Text('Exportera bedömningar'),
                    ),
                  ),
                ],
              ),
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

      final inviteRef = FirebaseFirestore.instance
          .collection('invites')
          .doc(code);

      await FirebaseFirestore.instance.runTransaction((tx) async {
        final inviteSnap = await tx.get(inviteRef);
        if (!inviteSnap.exists) throw Exception('Koden finns inte.');

        final data = inviteSnap.data() as Map<String, dynamic>;
        final used = (data['used'] ?? false) as bool;
        if (used) throw Exception('Koden är redan använd.');

        final teacherUid = (data['teacherUid'] ?? '').toString();
        if (teacherUid.isEmpty) {
          throw Exception('Koden är trasig (saknar lärare).');
        }

        final teacherRef = FirebaseFirestore.instance
            .collection('users')
            .doc(teacherUid);
        final teacherSnap = await tx.get(teacherRef);
        final teacherSchool = (teacherSnap.data()?['school'] ?? '')
            .toString()
            .trim();

        // 1) Koppla eleven till läraren
        final studentRef = FirebaseFirestore.instance
            .collection('users')
            .doc(studentUid);
        tx.update(studentRef, {
          'teacherUid': teacherUid,
          'teacherId': teacherUid,
          if (teacherSchool.isNotEmpty) 'school': teacherSchool,
        });

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
                const Text(
                  'Ange kopplingskod från din lärare',
                  style: TextStyle(fontSize: 18),
                ),
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
    final userDocStream = FirebaseFirestore.instance
        .collection('users')
        .doc(user.uid)
        .snapshots();

    return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      stream: userDocStream,
      builder: (outerUserContext, userSnap) {
        if (userSnap.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        final userData = userSnap.data?.data() ?? {};
        final displayName = (userData['displayName'] ?? '').toString().trim();

        final timesheetQuery = FirebaseFirestore.instance
            .collection('timesheets')
            .where('studentUid', isEqualTo: user.uid);

        return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
          stream: timesheetQuery.snapshots(),
          builder: (innerTimesheetContext, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return const Scaffold(
                body: Center(child: CircularProgressIndicator()),
              );
            }

            final docs = snap.data?.docs ?? [];

            // Beräkna denna veckas timmar
            final now = DateTime.now();
            final monday = now.subtract(
              Duration(days: now.weekday - DateTime.monday),
            );
            final weekStart = _ymd(monday);

            int thisWeekHours = 0;
            int approvedCount = 0;
            bool thisWeekExists = false;

            for (final d in docs) {
              final data = d.data();
              final entries =
                  (data['entries'] as Map?)?.cast<String, dynamic>() ?? {};
              final sum = _sumEntries(entries);
              final approved = (data['approved'] ?? false) == true;

              if (approved) {
                approvedCount++;
              }

              String ws = (data['weekStart'] ?? '').toString().trim();
              if (ws == weekStart) {
                thisWeekHours = sum;
                thisWeekExists = true;
              }
            }

            return Scaffold(
              body: SingleChildScrollView(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Välkomsthälsning
                      Text(
                        'Hej ${displayName.isEmpty ? 'där' : displayName}! 👋',
                        style: const TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Här är din vecka',
                        style: TextStyle(
                          fontSize: 16,
                          color: Colors.grey.shade600,
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Denna veckas status — stor kort
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              Colors.orange.shade400,
                              Colors.orange.shade600,
                            ],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.orange.shade200,
                              blurRadius: 8,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Denna vecka',
                              style: TextStyle(
                                color: Colors.white70,
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      '$thisWeekHours h',
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 36,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    Container(
                                      padding: const EdgeInsets.all(12),
                                      decoration: BoxDecoration(
                                        color: Colors.white.withOpacity(0.2),
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      child: const Icon(
                                        Icons.timer,
                                        color: Colors.white,
                                        size: 28,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 12),
                                Text(
                                  thisWeekExists
                                      ? 'Tidkort påstartat'
                                      : 'Deadline: Fredag kl 23:59',
                                  style: const TextStyle(
                                    color: Colors.white70,
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Snabbgenvägar — 3 stora knappar
                      const Text(
                        'Snabbgenvägar',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Column(
                        children: [
                          _QuickActionButton(
                            icon: Icons.edit_calendar,
                            color: Colors.orange,
                            title: 'Logga tid nu',
                            onPressed: () {
                              final now = DateTime.now();
                              final monday = now.subtract(
                                Duration(days: now.weekday - DateTime.monday),
                              );
                              final nextMonday = monday.add(
                                const Duration(days: 7),
                              );

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
                          ),
                          const SizedBox(height: 10),
                          _QuickActionButton(
                            icon: Icons.checklist,
                            color: Colors.orange,
                            title: 'Se bedömning',
                            onPressed: () {
                              // Navigera till bedömnings-flik
                              // TODO: Implementera navigation till bedömnings-flik
                            },
                          ),
                          const SizedBox(height: 10),
                          _QuickActionButton(
                            icon: Icons.restaurant,
                            color: Colors.green,
                            title: 'Lunch och reseersättning',
                            onPressed: () {
                              // Navigera till ersättnings-flik
                            },
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),

                      // Denna veckan — progress card
                      if (thisWeekExists) ...[
                        const Text(
                          'Denna veckans tidkort',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Card(
                          elevation: 2,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      'Vecka ${DateTime.now().day < 7 ? '1' : '2'}', // enkel veckonummer
                                      style: const TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 8,
                                        vertical: 4,
                                      ),
                                      decoration: BoxDecoration(
                                        color: Colors.orange.shade100,
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: const Text(
                                        'Pågående',
                                        style: TextStyle(
                                          fontSize: 12,
                                          color: Colors.orange,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 12),
                                Text(
                                  '$thisWeekHours av ~40 timmar',
                                  style: TextStyle(
                                    color: Colors.grey.shade600,
                                    fontSize: 13,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(8),
                                  child: LinearProgressIndicator(
                                    value: (thisWeekHours / 40).clamp(0.0, 1.0),
                                    minHeight: 8,
                                    backgroundColor: Colors.grey.shade200,
                                    valueColor: AlwaysStoppedAnimation<Color>(
                                      Colors.orange.shade500,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 24),
                      ],

                      // Notifieringar från läraren
                      if (approvedCount > 0) ...[
                        const Text(
                          'Status',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.green.shade50,
                            border: Border.all(color: Colors.green.shade200),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                Icons.check_circle,
                                color: Colors.green.shade600,
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                  '$approvedCount tidkort godkänd av läraren ✅',
                                  style: TextStyle(
                                    color: Colors.green.shade700,
                                    fontSize: 13,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 24),
                      ],
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }
}

class _QuickActionButton extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String title;
  final VoidCallback onPressed;

  const _QuickActionButton({
    required this.icon,
    required this.color,
    required this.title,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 16),
          decoration: BoxDecoration(
            border: Border.all(color: color.withOpacity(0.3)),
            borderRadius: BorderRadius.circular(12),
            color: color.withOpacity(0.08),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: color.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: color, size: 24),
              ),
              const SizedBox(width: 16),
              Text(
                title,
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: Colors.black87,
                ),
              ),
              const Spacer(),
              Icon(
                Icons.arrow_forward_ios,
                size: 14,
                color: Colors.grey.shade400,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class StudentClassView extends StatelessWidget {
  final String classId;

  const StudentClassView({super.key, required this.classId});

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser!;
    final userDocStream = FirebaseFirestore.instance
        .collection('users')
        .doc(user.uid)
        .snapshots();

    return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      stream: userDocStream,
      builder: (userContext, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        final userData = snap.data?.data() ?? {};
        final teacherUid = (userData['teacherUid'] ?? '').toString().trim();

        if (teacherUid.isEmpty) {
          return const Scaffold(
            body: Center(child: Text('Ingen lärare kopplad.')),
          );
        }

        // Hämta klassinfo
        final classDocStream = FirebaseFirestore.instance
            .collection('classes')
            .where('teacherUid', isEqualTo: teacherUid)
            .snapshots();

        return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
          stream: classDocStream,
          builder: (classContext, classSnap) {
            if (classSnap.connectionState == ConnectionState.waiting) {
              return const Scaffold(
                body: Center(child: CircularProgressIndicator()),
              );
            }

            final classDocs = classSnap.data?.docs ?? [];
            String className = classId;
            for (final doc in classDocs) {
              if (doc.id == '${teacherUid}_$classId') {
                className = (doc.data()['name'] ?? classId).toString();
                break;
              }
            }

            // Hämta alla elever i denna klass
            final studentsQuery = FirebaseFirestore.instance
                .collection('users')
                .where('teacherUid', isEqualTo: teacherUid)
                .where('classId', isEqualTo: classId);

            return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
              stream: studentsQuery.snapshots(),
              builder: (studentContext, studentSnap) {
                if (studentSnap.connectionState == ConnectionState.waiting) {
                  return const Scaffold(
                    body: Center(child: CircularProgressIndicator()),
                  );
                }

                final students = studentSnap.data?.docs ?? [];
                final studentNames = students
                    .map((d) {
                      final name = (d.data()['displayName'] ?? '')
                          .toString()
                          .trim();
                      final email = (d.data()['email'] ?? '').toString().trim();
                      return name.isEmpty ? email : name;
                    })
                    .where((s) => s.isNotEmpty)
                    .toList();

                return Scaffold(
                  appBar: AppBar(
                    title: Text('Klass: $className'),
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
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Klassmedlemmar (${studentNames.length})',
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Expanded(
                          child: studentNames.isEmpty
                              ? const Center(
                                  child: Text('Inga klassmedlemmar än.'),
                                )
                              : ListView.separated(
                                  itemCount: studentNames.length,
                                  separatorBuilder: (_, __) =>
                                      const SizedBox(height: 6),
                                  itemBuilder: (context, i) {
                                    return Card(
                                      child: Padding(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 12,
                                          vertical: 8,
                                        ),
                                        child: Text(studentNames[i]),
                                      ),
                                    );
                                  },
                                ),
                        ),
                        const SizedBox(height: 12),
                        const Divider(),
                        const SizedBox(height: 12),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: () {
                              final now = DateTime.now();
                              final monday = now.subtract(
                                Duration(days: now.weekday - DateTime.monday),
                              );
                              final nextMonday = monday.add(
                                const Duration(days: 7),
                              );

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
                            child: const Text('Öppna tidkort'),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            );
          },
        );
      },
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
    final userDocStream = FirebaseFirestore.instance
        .collection('users')
        .doc(user.uid)
        .snapshots();

    return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      stream: userDocStream,
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }

        final data = snap.data?.data() ?? {};
        final teacherUid = (data['teacherUid'] ?? '').toString().trim();

        if (teacherUid.isEmpty) {
          return const Scaffold(
            body: Center(child: Text('Ingen lärare kopplad.')),
          );
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

String generateInviteCode({int length = 6}) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // inga O/0, I/1
  final rnd = Random.secure();
  return List.generate(length, (_) => chars[rnd.nextInt(chars.length)]).join();
}

String generateAssessmentId({int length = 16}) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  final rnd = Random.secure();
  return List.generate(length, (_) => chars[rnd.nextInt(chars.length)]).join();
}

// Helper för att beräkna veckonummer
int _getWeekNumberForAssessment(DateTime date) {
  final jan4 = DateTime(date.year, 1, 4);
  final monday = jan4.subtract(Duration(days: jan4.weekday - DateTime.monday));
  final weekNum = date.difference(monday).inDays ~/ 7 + 1;
  return weekNum;
}

// Helper för att formatera kort datum
String _formatShortDateForAssessment(DateTime date) {
  return '${date.day}/${date.month}';
}

class AssessmentScreen extends StatelessWidget {
  const AssessmentScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser!;
    final timesheetsQuery = FirebaseFirestore.instance
        .collection('timesheets')
        .where('studentUid', isEqualTo: user.uid)
        .orderBy('weekStart', descending: true);

    return Scaffold(
      body: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
        stream: timesheetsQuery.snapshots(),
        builder: (outerContext, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          final timesheets = snap.data?.docs ?? [];

          if (timesheets.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Colors.orange.shade50,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      Icons.assignment,
                      size: 48,
                      color: Colors.orange.shade600,
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Inget tidkort ännu',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Bedömningar visas när du\nhar skrivit dina tidkort.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.grey),
                  ),
                ],
              ),
            );
          }

          return Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Bedömningar',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 12),
                Expanded(
                  child: ListView.separated(
                    itemCount: timesheets.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (listContext, i) {
                      final doc = timesheets[i];
                      final data = doc.data();
                      final weekStart = (data['weekStart'] ?? '').toString();
                      final approved = (data['approved'] ?? false) == true;

                      // Beräkna veckonummer och datumintervall
                      String weekDisplayTitle = 'Vecka: $weekStart';
                      String weekDisplaySubtitle = '';
                      try {
                        final weekStartDate = DateTime.parse(weekStart);
                        final weekNumber = _getWeekNumberForAssessment(
                          weekStartDate,
                        );
                        final weekEndDate = weekStartDate.add(
                          const Duration(days: 4),
                        ); // Fredag
                        final dateRange =
                            '${_formatShortDateForAssessment(weekStartDate)} - ${_formatShortDateForAssessment(weekEndDate)}';
                        weekDisplayTitle = 'V. $weekNumber';
                        weekDisplaySubtitle = dateRange;
                      } catch (e) {
                        weekDisplayTitle = 'Vecka: $weekStart';
                      }

                      return StreamBuilder<DocumentSnapshot>(
                        stream: FirebaseFirestore.instance
                            .collection('assessments')
                            .where('timesheetId', isEqualTo: doc.id)
                            .where('studentUid', isEqualTo: user.uid)
                            .limit(1)
                            .snapshots()
                            .map(
                              (snap) =>
                                  snap.docs.isNotEmpty ? snap.docs.first : null,
                            )
                            .where((doc) => doc != null)
                            .cast<DocumentSnapshot>(),
                        builder: (innerContext, assessmentSnap) {
                          final hasAssessment =
                              assessmentSnap.hasData &&
                              assessmentSnap.data != null &&
                              assessmentSnap.data!.exists;

                          // Om ingen assessment finns ännu, skapa en platshållare
                          final assessmentId =
                              assessmentSnap.hasData &&
                                  assessmentSnap.data != null &&
                                  assessmentSnap.data!.exists
                              ? assessmentSnap.data!.id
                              : null;

                          return Container(
                            decoration: BoxDecoration(
                              border: Border.all(
                                color: approved
                                    ? Colors.green.shade200
                                    : Colors.orange.shade200,
                              ),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          weekDisplayTitle,
                                          style: const TextStyle(
                                            fontSize: 16,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        if (weekDisplaySubtitle.isNotEmpty)
                                          Text(
                                            weekDisplaySubtitle,
                                            style: const TextStyle(
                                              fontSize: 12,
                                              color: Colors.grey,
                                            ),
                                          ),
                                        const SizedBox(height: 4),
                                        if (hasAssessment)
                                          Text(
                                            'Bedömd ✅',
                                            style: TextStyle(
                                              fontSize: 12,
                                              color: Colors.green.shade700,
                                              fontWeight: FontWeight.w600,
                                            ),
                                          )
                                        else
                                          const Text(
                                            'Inväntar bedömning',
                                            style: TextStyle(
                                              fontSize: 12,
                                              color: Colors.orange,
                                            ),
                                          ),
                                      ],
                                    ),
                                    if (!hasAssessment)
                                      _QRCodeDisplay(
                                        timesheetId: doc.id,
                                        studentName:
                                            user.displayName ?? 'Student',
                                        assessmentId: assessmentId,
                                      ),
                                  ],
                                ),
                              ],
                            ),
                          );
                        },
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

class _QRCodeDisplay extends StatelessWidget {
  final String timesheetId;
  final String studentName;
  final String? assessmentId; // Redan existerande assessment ID

  const _QRCodeDisplay({
    required this.timesheetId,
    required this.studentName,
    this.assessmentId,
  });

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<String>(
      future: _getOrCreateAssessmentId(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: Colors.orange.shade50,
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Center(
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          );
        }

        if (!snapshot.hasData) {
          return const SizedBox.shrink();
        }

        final finalAssessmentId = snapshot.data!;
        final qrData = 'apl://assess/$finalAssessmentId'; // Deep link format

        return GestureDetector(
          onTap: () {
            showDialog(
              context: context,
              builder: (context) => AlertDialog(
                title: const Text('QR-kod för bedömning'),
                content: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 250,
                      height: 250,
                      color: Colors.white,
                      child: CustomPaint(painter: _QrPainter(qrData)),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'ID: $finalAssessmentId',
                      style: const TextStyle(fontSize: 12, color: Colors.grey),
                    ),
                  ],
                ),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Stäng'),
                  ),
                ],
              ),
            );
          },
          child: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.orange.shade50,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Container(
              width: 80,
              height: 80,
              color: Colors.white,
              child: CustomPaint(painter: _QrPainter(qrData)),
            ),
          ),
        );
      },
    );
  }

  // Hämta eller skapa assessment ID
  Future<String> _getOrCreateAssessmentId() async {
    // Om vi redan har ett assessment ID från widget, använd det
    if (assessmentId != null && assessmentId!.isNotEmpty) {
      return assessmentId!;
    }

    // Annars, skapa ett nytt
    final newId = generateAssessmentId();
    final user = FirebaseAuth.instance.currentUser!;
    final userDoc = await FirebaseFirestore.instance
        .collection('users')
        .doc(user.uid)
        .get();
    final teacherUid = (userDoc.data()?['teacherUid'] ?? '').toString().trim();

    // Spara det i Firestore som en platshållare
    await FirebaseFirestore.instance.collection('assessments').doc(newId).set({
      'timesheetId': timesheetId,
      'studentUid': user.uid,
      'teacherUid': teacherUid,
      'createdAt': FieldValue.serverTimestamp(),
      // Övriga fält (supervisorName, etc.) fylls när handledaren skickar
    }, SetOptions(merge: true));

    return newId;
  }
}

class _QrPainter extends CustomPainter {
  final String data;

  _QrPainter(this.data);

  @override
  void paint(Canvas canvas, Size size) {
    final qrPainter = QrPainter(
      data: data,
      version: QrVersions.auto,
      emptyColor: Colors.white,
      color: Colors.black,
    );
    qrPainter.paint(canvas, size);
  }

  @override
  bool shouldRepaint(_QrPainter oldDelegate) {
    return oldDelegate.data != data;
  }
}

class MainNavigation extends StatefulWidget {
  const MainNavigation({super.key});

  @override
  State<MainNavigation> createState() => _MainNavigationState();
}

class _MainNavigationState extends State<MainNavigation> {
  int _currentIndex = 0;
  bool _isTeacher = false;
  bool _isAdmin = false;
  bool _isLoading = true;
  // int _pendingTimesheetsCount = 0; // För badge-räknare (kommenterad - ej använd)
  // StreamSubscription<QuerySnapshot>? _pendingTimesheetsSubscription; // Kommenterad - ej använd

  @override
  void initState() {
    super.initState();
    _checkUserRole();
  }

  @override
  void dispose() {
    // Avbryt StreamSubscription för att förhindra minnes-läcka
    // _pendingTimesheetsSubscription?.cancel(); // Kommenterad - ej använd
    super.dispose();
  }

  Future<void> _checkUserRole() async {
    final user = FirebaseAuth.instance.currentUser;

    if (user != null) {
      try {
        // Läs användarens roll från Firestore
        final doc = await FirebaseFirestore.instance
            .collection('users')
            .doc(user.uid)
            .get();

        final userData = doc.data();

        final role = (userData?['role'] as String? ?? '').trim().toLowerCase();

        final isTeacher = role == 'teacher';
        final isAdmin = role == 'admin';

        if (mounted) {
          setState(() {
            _isTeacher = isTeacher;
            _isAdmin = isAdmin;
            _isLoading = false;
          });

          // Om lärare eller admin, lyssna på ogranskade tidkort för badge
          // Kommenterad - ej används efter borttagning av Bedömningar-fliken
          /*
          if (isTeacher || isAdmin) {
            _listenToPendingTimesheets(user.uid);
          }
          */
        }
      } catch (e) {
        if (mounted) {
          setState(() {
            _isLoading = false;
          });
        }
      }
    } else {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  // Kommenterad - ej använd efter borttagning av Bedömningar-fliken
  /*
  void _listenToPendingTimesheets(String teacherUid) {
    // Avbryt tidigare subscription om det finns
    _pendingTimesheetsSubscription?.cancel();
    
    // Lyssna på alla tidkort som inte är godkända för denna lärare
    _pendingTimesheetsSubscription = FirebaseFirestore.instance
        .collection('timesheets')
        .where('teacherUid', isEqualTo: teacherUid)
        .where('approved', isEqualTo: false)
        .snapshots()
        .listen((snapshot) {
          if (mounted) {
            setState(() {
              _pendingTimesheetsCount = snapshot.docs.length;
            });
          }
        });
  }
  */

  // Kommenterad - ej använd efter borttagning av Bedömningar-fliken
  /*
  Widget _buildBadgeIcon(IconData icon, int count) {
    if (count == 0) {
      return Icon(icon);
    }
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Icon(icon),
        Positioned(
          right: -8,
          top: -8,
          child: Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: Colors.red,
              shape: BoxShape.circle,
            ),
            constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
            child: Center(
              child: Text(
                count > 99 ? '99+' : count.toString(),
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                ),
                textAlign: TextAlign.center,
              ),
            ),
          ),
        ),
      ],
    );
  }
  */

  List<Widget> _getScreens() {
    if (_isTeacher || _isAdmin) {
      return [
        TeacherDashboardScreen(
          onNavigateToApproval: () {
            setState(() {
              _currentIndex = 2; // Index för Statistik-skärmen
            });
          },
        ),
        const StudentRegistrationScreen(),
        const StatisticsScreen(),
        const WeekManagementScreen(),
        if (_isAdmin) SchoolsScreen(), // Skolor-flik för admin
        SettingsScreen(),
      ];
    } else {
      return const [
        StartScreen(),
        TidkortScreen(),
        BedomningScreen(),
        ErsattningScreen(),
        AssignmentsScreen(),
        SettingsScreen(),
      ];
    }
  }

  BottomNavigationBarItem _styledNavItem({
    required IconData icon,
    required String label,
  }) {
    return BottomNavigationBarItem(
      icon: _buildStyledNavIcon(icon: icon, selected: false),
      activeIcon: _buildStyledNavIcon(icon: icon, selected: true),
      label: label,
    );
  }

  Widget _buildStyledNavIcon({required IconData icon, required bool selected}) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      curve: Curves.easeOut,
      width: selected ? 44 : 36,
      height: selected ? 44 : 36,
      decoration: BoxDecoration(
        color: selected ? const Color(0xFFFF6A00) : const Color(0xFFF3F1EE),
        shape: BoxShape.circle,
        boxShadow: selected
            ? const [
                BoxShadow(
                  color: Color(0x3DFF6A00),
                  blurRadius: 14,
                  offset: Offset(0, 6),
                ),
              ]
            : const [],
      ),
      child: Icon(
        icon,
        size: selected ? 21 : 19,
        color: selected ? Colors.white : const Color(0xFF1E1A18),
      ),
    );
  }

  Widget _buildStyledBottomNavigationBar(List<BottomNavigationBarItem> items) {
    return SafeArea(
      minimum: const EdgeInsets.fromLTRB(22, 0, 22, 10),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 0),
        decoration: BoxDecoration(
          color: const Color(0xFFF8F7F5),
          borderRadius: BorderRadius.circular(24),
          boxShadow: const [
            BoxShadow(
              color: Color(0x1F000000),
              blurRadius: 22,
              offset: Offset(0, 8),
            ),
          ],
        ),
        child: SizedBox(
          height: 56,
          child: BottomNavigationBar(
            currentIndex: _currentIndex,
            onTap: (index) => setState(() => _currentIndex = index),
            type: BottomNavigationBarType.fixed,
            backgroundColor: Colors.transparent,
            elevation: 0,
            selectedItemColor: const Color(0xFFFF6A00),
            unselectedItemColor: const Color(0xFF1E1A18),
            showSelectedLabels: false,
            showUnselectedLabels: false,
            selectedFontSize: 0,
            unselectedFontSize: 0,
            items: items,
          ),
        ),
      ),
    );
  }

  Widget _buildStudentBottomNavigationBar() {
    return _buildStyledBottomNavigationBar([
      _styledNavItem(icon: Icons.home_rounded, label: 'Hem'),
      _styledNavItem(icon: Icons.access_time_rounded, label: 'Tidkort'),
      _styledNavItem(icon: Icons.checklist_rounded, label: 'Bedömning'),
      _styledNavItem(icon: Icons.bar_chart_rounded, label: 'Statistik'),
      _styledNavItem(icon: Icons.assignment_outlined, label: 'Uppgifter'),
      _styledNavItem(
        icon: Icons.person_outline_rounded,
        label: 'Inställningar',
      ),
    ]);
  }

  Widget _buildTeacherBottomNavigationBar() {
    return _buildStyledBottomNavigationBar([
      _styledNavItem(icon: Icons.home_rounded, label: 'Hem'),
      _styledNavItem(icon: Icons.person_add_alt_1_rounded, label: 'Elever'),
      _styledNavItem(icon: Icons.bar_chart_rounded, label: 'Statistik'),
      _styledNavItem(icon: Icons.calendar_today_rounded, label: 'Veckor'),
      if (_isAdmin) _styledNavItem(icon: Icons.school_rounded, label: 'Skolor'),
      _styledNavItem(icon: Icons.person_outline_rounded, label: 'Profil'),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(body: const Center(child: CircularProgressIndicator()));
    }

    final screens = _getScreens();
    return Scaffold(
      body: screens[_currentIndex],
      bottomNavigationBar: (_isTeacher || _isAdmin)
          ? _buildTeacherBottomNavigationBar()
          : _buildStudentBottomNavigationBar(),
    );
  }
}
