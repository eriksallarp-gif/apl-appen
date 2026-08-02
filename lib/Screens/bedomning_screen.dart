import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:math';
import 'dart:io';
import '../core/assessment_templates.dart';

// Helper för att beräkna veckonummer
int _getWeekNumber(DateTime date) {
  final jan4 = DateTime(date.year, 1, 4);
  final monday = jan4.subtract(Duration(days: jan4.weekday - DateTime.monday));
  final weekNum = date.difference(monday).inDays ~/ 7 + 1;
  return weekNum;
}

int? _readStoredWeekNumber(Map<String, dynamic> data) {
  final rawWeekNumber = data['weekNumber'];
  return rawWeekNumber is num ? rawWeekNumber.toInt() : null;
}

// Helper för att formatera kort datum
String _formatShortDate(DateTime date) {
  return '${date.day}/${date.month}';
}

String _formatWeekLabel(Map<String, dynamic> data) {
  final weekStart = (data['weekStart'] ?? '').toString();
  try {
    final weekStartDate = DateTime.parse(weekStart);
    final weekNumber =
        _readStoredWeekNumber(data) ?? _getWeekNumber(weekStartDate);
    return 'V. $weekNumber';
  } catch (_) {
    return weekStart;
  }
}

List<Map<String, dynamic>> _buildTimesheetSummaries(
  List<QueryDocumentSnapshot<Map<String, dynamic>>> availableTimesheets,
  Set<String> selectedTimesheetIds,
) {
  final summaries = <Map<String, dynamic>>[];

  for (final id in selectedTimesheetIds) {
    final matchingDocs = availableTimesheets.where((d) => d.id == id);
    if (matchingDocs.isEmpty) continue;

    final doc = matchingDocs.first;
    final data = doc.data();
    final entries = (data['entries'] as Map<String, dynamic>?) ?? {};
    final activities = <Map<String, dynamic>>[];
    var timesheetTotalHours = 0;

    for (final entry in entries.entries) {
      final activityName = entry.key.toString().trim();
      if (activityName.isEmpty) continue;

      var activityHours = 0;
      final dayMap = entry.value;
      if (dayMap is Map<String, dynamic>) {
        for (final rawHours in dayMap.values) {
          activityHours += (rawHours as num?)?.toInt() ?? 0;
        }
      }

      if (activityHours <= 0) continue;

      timesheetTotalHours += activityHours;
      activities.add({
        'name': activityName,
        'hours': activityHours,
      });
    }

    if (activities.isEmpty) continue;

    summaries.add({
      'timesheetId': doc.id,
      'weekLabel': _formatWeekLabel(data),
      'totalHours': timesheetTotalHours,
      'activities': activities,
    });
  }

  return summaries;
}

Future<String> _findLinkedCompanyNameForStudent(String studentUid) async {
  final companiesRef = FirebaseFirestore.instance.collection('companies');

  try {
    final byStudentId = await companiesRef
        .where('studentId', isEqualTo: studentUid)
        .limit(1)
        .get();

    if (byStudentId.docs.isNotEmpty) {
      final data = byStudentId.docs.first.data();
      final companyName = (data['name'] ?? '').toString().trim();
      if (companyName.isNotEmpty) return companyName;
    }
  } catch (_) {
    // Ignore and continue with fallback query.
  }

  try {
    final byStudentIds = await companiesRef
        .where('studentIds', arrayContains: studentUid)
        .limit(1)
        .get();

    if (byStudentIds.docs.isNotEmpty) {
      final data = byStudentIds.docs.first.data();
      final companyName = (data['name'] ?? '').toString().trim();
      if (companyName.isNotEmpty) return companyName;
    }
  } catch (_) {
    // Ignore and return empty value below.
  }

  return '';
}

class BedomningScreen extends StatefulWidget {
  const BedomningScreen({super.key});

  @override
  State<BedomningScreen> createState() => _BedomningScreenState();
}

class _BedomningScreenState extends State<BedomningScreen> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SafeArea(
            bottom: false,
            child: Padding(
              padding: EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: Text(
                'Bedömning',
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
              ),
            ),
          ),
          const Expanded(child: _CreateAssessmentTab()),
        ],
      ),
    );
  }
}

// ==================== SKAPA BEDÖMNING FLIK ====================
class _CreateAssessmentTab extends StatefulWidget {
  const _CreateAssessmentTab();

  @override
  State<_CreateAssessmentTab> createState() => _CreateAssessmentTabState();
}

class _CreateAssessmentTabState extends State<_CreateAssessmentTab> {
  final Set<String> _selectedTimesheetIds = {};
  final TextEditingController _lunchController = TextEditingController();
  final TextEditingController _travelController = TextEditingController();
  AssessmentTemplateConfig _assessmentTemplateConfig =
      defaultAssessmentTemplateConfig;
  List<SelfAssessmentField> _selfAssessmentFields =
      defaultAssessmentTemplateConfig.selfAssessmentFields;
  Map<String, TextEditingController> _selfAssessmentControllers = {};
  final List<XFile> _selectedImages = [];
  final ImagePicker _picker = ImagePicker();
  bool _isUploading = false;

  @override
  void initState() {
    super.initState();
    _applyAssessmentTemplateConfig(defaultAssessmentTemplateConfig);
    _loadAssessmentTemplateConfig();
  }

  @override
  void dispose() {
    _lunchController.dispose();
    _travelController.dispose();
    for (final controller in _selfAssessmentControllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  void _applyAssessmentTemplateConfig(AssessmentTemplateConfig config) {
    final nextControllers = <String, TextEditingController>{};

    for (final field in config.selfAssessmentFields) {
      nextControllers[field.key] =
          _selfAssessmentControllers[field.key] ?? TextEditingController();
    }

    for (final entry in _selfAssessmentControllers.entries) {
      if (!nextControllers.containsKey(entry.key)) {
        entry.value.dispose();
      }
    }

    _selfAssessmentControllers = nextControllers;
    _selfAssessmentFields = config.selfAssessmentFields;
    _assessmentTemplateConfig = config;
  }

  Future<void> _loadAssessmentTemplateConfig() async {
    final studentUid = FirebaseAuth.instance.currentUser?.uid ?? '';
    final config = await loadAssessmentTemplateConfigForStudent(studentUid);
    if (!mounted) return;

    setState(() {
      _applyAssessmentTemplateConfig(config);
    });
  }

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser!;

    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance
          .collection('timesheets')
          .where('studentUid', isEqualTo: user.uid)
          .snapshots(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }

        final timesheets = snapshot.data?.docs ?? [];

        // Visa alla tidkort (även låsta) men inaktivera låsta tidkort
        final availableTimesheets = timesheets;

        if (availableTimesheets.isEmpty) {
          return Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.info_outline,
                  size: 64,
                  color: Colors.orange.shade300,
                ),
                const SizedBox(height: 16),
                const Text(
                  'Inga tidkort',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Skapa ett tidkort först för att kunna\nbegära bedömning från din handledare',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.grey),
                ),
              ],
            ),
          );
        }

        // Beräkna total arbetstid från valda tidkort
        int totalHours = 0;
        for (final id in _selectedTimesheetIds) {
          final matchingDocs = availableTimesheets.where((doc) => doc.id == id);
          if (matchingDocs.isEmpty) continue;
          final doc = matchingDocs.first;
          final data = doc.data();
          final entries = (data['entries'] as Map<String, dynamic>?) ?? {};
          for (var entry in entries.values) {
            if (entry is Map<String, dynamic>) {
              for (var hours in entry.values) {
                totalHours += (hours as num).toInt();
              }
            }
          }
        }

        return Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  const Text(
                    'Välj tidkort för att skapa en bedömning',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Välj ett eller flera tidkort som ska ingå i bedömningen, när du valt tidkort kan du välja att lägga till information om ersättning, självskattning och bilder från din APL-period.',
                    style: TextStyle(color: Colors.grey),
                  ),
                  const SizedBox(height: 16),

                  // Lista med tidkort
                  ...availableTimesheets.map((doc) {
                    final data = doc.data();
                    final weekStart = data['weekStart'] as String? ?? '';
                    final isSelected = _selectedTimesheetIds.contains(doc.id);
                    final isApproved = (data['approved'] as bool?) == true;
                    final isLocked = (data['locked'] as bool?) == true;

                    // Beräkna veckonummer
                    String weekDisplay = weekStart;
                    try {
                      final weekStartDate = DateTime.parse(weekStart);
                      final weekNumber =
                          _readStoredWeekNumber(data) ??
                          _getWeekNumber(weekStartDate);
                      final weekEndDate = weekStartDate.add(
                        const Duration(days: 4),
                      );
                      weekDisplay =
                          'V. $weekNumber (${_formatShortDate(weekStartDate)} - ${_formatShortDate(weekEndDate)})';
                    } catch (e) {
                      weekDisplay = 'Vecka: $weekStart';
                    }

                    // Status text
                    String statusText;
                    if (isLocked) {
                      statusText = 'Låst (Bedömning inskickad)';
                    } else if (isApproved) {
                      statusText = 'Godkänd';
                    } else {
                      statusText = 'Inväntar godkännande';
                    }

                    return GestureDetector(
                      onTap: isLocked
                          ? null
                          : () {
                              setState(() {
                                if (isSelected) {
                                  _selectedTimesheetIds.remove(doc.id);
                                } else {
                                  _selectedTimesheetIds.add(doc.id);
                                }
                              });
                            },
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        margin: const EdgeInsets.symmetric(vertical: 6),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? const Color(
                                  0xFFE56A00,
                                ) // Orange highlight when selected
                              : Colors.white, // White when not selected
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: isLocked
                                ? Colors.grey.shade300
                                : (isSelected
                                      ? const Color(0xFFE56A00)
                                      : Colors.grey.shade300),
                            width: 2,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.04),
                              blurRadius: 4,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    weekDisplay,
                                    style: TextStyle(
                                      color: isLocked
                                          ? Colors.grey
                                          : (isSelected
                                                ? Colors.white
                                                : Colors.black),
                                      fontWeight: FontWeight.w600,
                                      fontSize: 16,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    statusText,
                                    style: TextStyle(
                                      color: isLocked
                                          ? Colors.grey
                                          : (isApproved
                                                ? Colors.green
                                                : (isSelected
                                                      ? Colors.white
                                                      : Colors.orange)),
                                      fontWeight: isLocked
                                          ? FontWeight.bold
                                          : FontWeight.normal,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Icon(
                              isLocked
                                  ? Icons.lock_outline_rounded
                                  : (isApproved
                                        ? Icons.check_circle_rounded
                                        : Icons.schedule_rounded),
                              color: isLocked
                                  ? Colors.grey
                                  : (isApproved
                                        ? Colors.green
                                        : (isSelected
                                              ? Colors.white
                                              : Colors.orange)),
                            ),
                          ],
                        ),
                      ),
                    );
                  }),

                  if (_selectedTimesheetIds.isNotEmpty) ...[
                    const SizedBox(height: 24),
                    const Divider(),
                    const SizedBox(height: 16),

                    // Sammanfattning
                    const Text(
                      'Sammanfattning',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Card(
                      color: const Color(0xFFFFF1E5),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                const Icon(
                                  Icons.event_note,
                                  color: Color(0xFFE56A00),
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  'Antal veckor: ${_selectedTimesheetIds.length}',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                const Icon(
                                  Icons.access_time,
                                  color: Color(0xFFE56A00),
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  'Total arbetstid: $totalHours timmar',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Ersättning
                    const Text(
                      'Ersättning',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _lunchController,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Antal luncher',
                        hintText: 'Ange antal luncher',
                        prefixIcon: Icon(Icons.lunch_dining),
                        border: OutlineInputBorder(),
                      ),
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _travelController,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Antal kilometer (km)',
                        hintText: 'Ange antal kilometer',
                        prefixIcon: Icon(Icons.directions_car),
                        border: OutlineInputBorder(),
                      ),
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    ),
                    const SizedBox(height: 24),

                    // Självskattning
                    const Text(
                      'Självskattning - Reflektera över din APL',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Berätta om dina erfarenheter från APL-perioden',
                      style: TextStyle(color: Colors.grey),
                    ),
                    const SizedBox(height: 16),

                    ..._selfAssessmentFields.asMap().entries.expand((entry) {
                      final index = entry.key;
                      final field = entry.value;
                      final controller = _selfAssessmentControllers[field.key]!;
                      return [
                        TextField(
                          controller: controller,
                          keyboardType: field.inputType == 'number'
                              ? TextInputType.number
                              : TextInputType.multiline,
                          maxLines: field.inputType == 'number' ? 1 : 3,
                          inputFormatters: field.inputType == 'number'
                              ? [FilteringTextInputFormatter.digitsOnly]
                              : null,
                          decoration: InputDecoration(
                            labelText: '${index + 1}. ${field.label}',
                            hintText: field.placeholder,
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                            ),
                            prefixIcon: Icon(
                              field.inputType == 'number'
                                  ? Icons.star
                                  : Icons.notes,
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                      ];
                    }).toList(),
                    const SizedBox(height: 12),

                    // Bilder
                    const Text(
                      'Bilder från APL',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Bifoga bilder från ditt arbete under APL',
                      style: TextStyle(color: Colors.grey),
                    ),
                    const SizedBox(height: 12),

                    // Bildgalleri
                    if (_selectedImages.isNotEmpty)
                      SizedBox(
                        height: 120,
                        child: ListView.builder(
                          scrollDirection: Axis.horizontal,
                          itemCount: _selectedImages.length,
                          itemBuilder: (context, index) {
                            return Padding(
                              padding: const EdgeInsets.only(right: 8),
                              child: Stack(
                                children: [
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(8),
                                    child: Image.file(
                                      File(_selectedImages[index].path),
                                      width: 120,
                                      height: 120,
                                      fit: BoxFit.cover,
                                    ),
                                  ),
                                  Positioned(
                                    top: 4,
                                    right: 4,
                                    child: IconButton(
                                      onPressed: () {
                                        setState(() {
                                          _selectedImages.removeAt(index);
                                        });
                                      },
                                      icon: const Icon(Icons.close),
                                      style: IconButton.styleFrom(
                                        backgroundColor: Colors.red,
                                        foregroundColor: Colors.white,
                                        padding: const EdgeInsets.all(4),
                                        minimumSize: const Size(28, 28),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                      ),
                    const SizedBox(height: 12),

                    // Lägg till bild-knappar
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: () => _pickImages(ImageSource.camera),
                            icon: const Icon(Icons.camera_alt),
                            label: const Text('Ta foto'),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: () => _pickImages(ImageSource.gallery),
                            icon: const Icon(Icons.photo_library),
                            label: const Text('Från galleri'),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),
                  ],
                ],
              ),
            ),

            // Skapa bedömning-knapp
            if (_selectedTimesheetIds.isNotEmpty)
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.1),
                      blurRadius: 4,
                      offset: const Offset(0, -2),
                    ),
                  ],
                ),
                child: SafeArea(
                  child: ElevatedButton.icon(
                    onPressed: _isUploading
                        ? null
                        : () => _createAssessmentRequest(
                            context,
                            availableTimesheets,
                            totalHours,
                          ),
                    icon: _isUploading
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(Icons.qr_code),
                    label: Text(
                      _isUploading
                          ? 'Laddar upp bilder...'
                          : 'Skapa bedömning & visa QR-kod',
                    ),
                    style: ElevatedButton.styleFrom(
                      minimumSize: const Size.fromHeight(50),
                    ),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }

  Future<void> _pickImages(ImageSource source) async {
    try {
      if (source == ImageSource.camera) {
        final XFile? image = await _picker.pickImage(source: source);
        if (image != null) {
          setState(() {
            _selectedImages.add(image);
          });
        }
      } else {
        final List<XFile> images = await _picker.pickMultiImage();
        if (images.isNotEmpty) {
          setState(() {
            _selectedImages.addAll(images);
          });
        }
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Kunde inte välja bilder: $e'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  Future<void> _createAssessmentRequest(
    BuildContext context,
    List<QueryDocumentSnapshot<Map<String, dynamic>>> availableTimesheets,
    int totalHours,
  ) async {
    final user = FirebaseAuth.instance.currentUser!;

    // Validera ersättning
    final lunchCount = int.tryParse(_lunchController.text) ?? 0;
    final travelCount = int.tryParse(_travelController.text) ?? 0;

    if (lunchCount < 0 || travelCount < 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Ersättning kan inte vara negativ'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    // Max validering för luncher
    if (lunchCount > 1000) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Antal luncher kan max vara 1000'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    // Max validering för kilometer
    if (travelCount > 1000) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Antal kilometer kan max vara 1000'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    // Hämta veckonummer för valda tidkort
    final weeks = <String>[];
    for (final id in _selectedTimesheetIds) {
      final matchingDocs = availableTimesheets.where((d) => d.id == id);
      if (matchingDocs.isEmpty) continue;
      final doc = matchingDocs.first;
      final data = doc.data();
      final weekStart = data['weekStart'] as String? ?? '';
      try {
        final weekStartDate = DateTime.parse(weekStart);
        final weekNumber =
            _readStoredWeekNumber(data) ?? _getWeekNumber(weekStartDate);
        weeks.add('V. $weekNumber');
      } catch (e) {
        weeks.add(weekStart);
      }
    }

    final timesheetSummaries = _buildTimesheetSummaries(
      availableTimesheets,
      _selectedTimesheetIds,
    );

    // Generera unik token
    final token = _generateToken();
    final expiresAt = DateTime.now().add(const Duration(days: 1));

    setState(() {
      _isUploading = true;
    });

    try {
      final userDoc = await FirebaseFirestore.instance
          .collection('users')
          .doc(user.uid)
          .get();
      final teacherUid = (userDoc.data()?['teacherUid'] ?? '')
          .toString()
          .trim();
      if (teacherUid.isEmpty) {
        throw Exception('Kunde inte hitta elevens kopplade lärare.');
      }

      // Hämta elevens kopplade företag (stöder både studentId och studentIds)
      final linkedCompanyName = await _findLinkedCompanyNameForStudent(
        user.uid,
      );

      // Ladda upp bilder till Firebase Storage
      final List<Map<String, dynamic>> uploadedImages = [];

      for (int i = 0; i < _selectedImages.length; i++) {
        final image = _selectedImages[i];
        final fileName =
            '${user.uid}_${DateTime.now().millisecondsSinceEpoch}_$i.jpg';
        final storageRef = FirebaseStorage.instance
            .ref()
            .child('assessment_images')
            .child(fileName);

        try {
          // Läs bilden som bytes istället för File för bättre kompatibilitet
          final bytes = await image.readAsBytes();
          await storageRef.putData(bytes);
          final downloadUrl = await storageRef.getDownloadURL();

          uploadedImages.add({
            'url': downloadUrl,
            'uploadedAt':
                Timestamp.now(), // Använd Timestamp.now() istället för FieldValue.serverTimestamp()
            'fileName': fileName,
          });
        } catch (uploadError) {
          // Om en bild misslyckas, fortsätt med nästa
          print('Fel vid uppladdning av bild $i: $uploadError');
          if (!context.mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Varning: Bild ${i + 1} kunde inte laddas upp'),
              duration: const Duration(seconds: 2),
            ),
          );
        }
      }

      final studentSelfAssessment = <String, String>{
        for (final field in _selfAssessmentFields)
          field.key: _selfAssessmentControllers[field.key]?.text.trim() ?? '',
      };

      // Skapa bedömningsförfrågan
      final docRef = await FirebaseFirestore.instance
          .collection('assessmentRequests')
          .add({
            'studentUid': user.uid,
            'studentName': user.displayName ?? 'Elev',
            'teacherUid': teacherUid,
            'timesheetIds': _selectedTimesheetIds.toList(),
            'weeks': weeks,
            'totalHours': totalHours,
            'timesheetSummaries': timesheetSummaries,
            'lunchCount': lunchCount,
            'travelCount': travelCount,
            'status': 'pending',
            'createdAt': FieldValue.serverTimestamp(),
            'token': token,
            'expiresAt': Timestamp.fromDate(expiresAt),
            'images': uploadedImages,
            'linkedCompanyName': linkedCompanyName,
            'studentCompanyName': linkedCompanyName,
            'studentSelfAssessment': studentSelfAssessment,
            'assessmentTemplateSnapshot': _assessmentTemplateConfig.toJson(),
          });

      setState(() {
        _isUploading = false;
      });

      // Visa QR-kod dialog
      if (!context.mounted) return;
      _showQRCodeDialog(context, docRef.id, token);

      // Rensa formuläret
      setState(() {
        _selectedTimesheetIds.clear();
        _lunchController.clear();
        _travelController.clear();
        for (final controller in _selfAssessmentControllers.values) {
          controller.clear();
        }
        _selectedImages.clear();
      });
    } catch (e) {
      setState(() {
        _isUploading = false;
      });

      if (!context.mounted) return;

      // Visa mer detaljerat felmeddelande
      String errorMessage = 'Fel vid skapande av bedömning';
      if (e.toString().contains('permission')) {
        errorMessage =
            'Saknar behörighet. Kontrollera att appen har tillgång till internet.';
      } else if (e.toString().contains('network')) {
        errorMessage = 'Nätverksfel. Kontrollera internetanslutningen.';
      } else if (e.toString().contains('storage')) {
        errorMessage = 'Fel vid bilduppladdning. Försök igen.';
      }

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('$errorMessage\n\nDetaljer: $e'),
          backgroundColor: Colors.red,
          duration: const Duration(seconds: 5),
        ),
      );

      print('Komplett fel: $e');
    }
  }

  String _generateToken() {
    const chars =
        'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    final random = Random.secure();
    return List.generate(
      32,
      (index) => chars[random.nextInt(chars.length)],
    ).join();
  }

  void _showQRCodeDialog(BuildContext context, String requestId, String token) {
    // URL till handledarsidan - produktionsmiljö
    final url = 'https://www.apl-appen.com/supervisor/$requestId?token=$token';

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        title: const Text('Bedömning skapad!'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Visa denna QR-kod för din handledare, eller skicka länken nedan:',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.grey.shade300),
                ),
                child: SizedBox(
                  width: 200,
                  height: 200,
                  child: QrImageView(
                    data: url,
                    version: QrVersions.auto,
                    size: 200,
                  ),
                ),
              ),
              const SizedBox(height: 24),
              const Text(
                'Länk:',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Container(
                width: double.maxFinite,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.grey.shade300),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: SelectableText(
                        url,
                        style: const TextStyle(fontSize: 12),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.copy, size: 20),
                      tooltip: 'Kopiera länk',
                      onPressed: () {
                        Clipboard.setData(ClipboardData(text: url));
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Länk kopierad!'),
                            duration: Duration(seconds: 2),
                          ),
                        );
                      },
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Länken är giltig i 1 dag',
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.grey,
                  fontStyle: FontStyle.italic,
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              // Byt till "Mina bedömningar"-fliken
              DefaultTabController.of(context).animateTo(0);
            },
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }
}
