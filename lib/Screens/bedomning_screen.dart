import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:math';
import 'dart:io';

// Helper för att beräkna veckonummer
int _getWeekNumber(DateTime date) {
  final jan4 = DateTime(date.year, 1, 4);
  final monday = jan4.subtract(Duration(days: jan4.weekday - DateTime.monday));
  final weekNum = date.difference(monday).inDays ~/ 7 + 1;
  return weekNum;
}

// Helper för att formatera kort datum
String _formatShortDate(DateTime date) {
  return '${date.day}/${date.month}';
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
      appBar: AppBar(
        title: const Text('Skapa bedömning'),
      ),
      body: const _CreateAssessmentTab(),
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
  final TextEditingController _selfAssessment1Controller = TextEditingController(); // Vad har du fått göra?
  final TextEditingController _selfAssessment2Controller = TextEditingController(); // Vad var positivt?
  final TextEditingController _selfAssessment3Controller = TextEditingController(); // Vad kunde varit bättre?
  final TextEditingController _selfAssessment4Controller = TextEditingController(); // Vad kunde du gjort annorlunda?
  final TextEditingController _selfAssessment5Controller = TextEditingController(); // Vilket betyg?
  final List<XFile> _selectedImages = [];
  final ImagePicker _picker = ImagePicker();
  bool _isUploading = false;

  @override
  void dispose() {
    _lunchController.dispose();
    _travelController.dispose();
    _selfAssessment1Controller.dispose();
    _selfAssessment2Controller.dispose();
    _selfAssessment3Controller.dispose();
    _selfAssessment4Controller.dispose();
    _selfAssessment5Controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser!;

    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance
          .collection('timesheets')
          .where('studentUid', isEqualTo: user.uid)
          .orderBy('weekStart', descending: true)
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
                Icon(Icons.info_outline, size: 64, color: Colors.orange.shade300),
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
                    'Välj tidkort att bedöma',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Välj ett eller flera tidkort som ska ingå i bedömningen',
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
                      final weekNumber = _getWeekNumber(weekStartDate);
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

                    return CheckboxListTile(
                      value: isSelected,
                      enabled: !isLocked, // Inaktivera om låst
                      onChanged: isLocked
                          ? null
                          : (selected) {
                              setState(() {
                                if (selected == true) {
                                  _selectedTimesheetIds.add(doc.id);
                                } else {
                                  _selectedTimesheetIds.remove(doc.id);
                                }
                              });
                            },
                      title: Text(
                        weekDisplay,
                        style: TextStyle(
                          color: isLocked ? Colors.grey : null,
                        ),
                      ),
                      subtitle: Text(
                        statusText,
                        style: TextStyle(
                          color: isLocked
                              ? Colors.grey
                              : (isApproved ? Colors.green : Colors.orange),
                          fontWeight:
                              isLocked ? FontWeight.bold : FontWeight.normal,
                        ),
                      ),
                      secondary: Icon(
                        isLocked
                            ? Icons.lock
                            : (isApproved ? Icons.check_circle : Icons.schedule),
                        color: isLocked
                            ? Colors.grey
                            : (isApproved ? Colors.green : Colors.orange),
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
                      color: Colors.orange.shade50,
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                const Icon(
                                  Icons.event_note,
                                  color: Colors.orange,
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
                                  color: Colors.orange,
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

                    // Fråga 1
                    TextField(
                      controller: _selfAssessment1Controller,
                      maxLines: 3,
                      decoration: InputDecoration(
                        labelText: '1. Vad har du fått göra?',
                        hintText: 'Beskriv de arbetsuppgifter du utförde...',
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                        prefixIcon: const Icon(Icons.work),
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Fråga 2
                    TextField(
                      controller: _selfAssessment2Controller,
                      maxLines: 3,
                      decoration: InputDecoration(
                        labelText: '2. Vad har varit positivt med APLen?',
                        hintText: 'Vad har varit bra? Vad har du lärt dig?',
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                        prefixIcon: const Icon(Icons.thumb_up),
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Fråga 3
                    TextField(
                      controller: _selfAssessment3Controller,
                      maxLines: 3,
                      decoration: InputDecoration(
                        labelText: '3. Vad skulle kunnat vara bättre?',
                        hintText: 'Vad var utmanande? Vad skulle förbättras?',
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                        prefixIcon: const Icon(Icons.lightbulb),
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Fråga 4
                    TextField(
                      controller: _selfAssessment4Controller,
                      maxLines: 3,
                      decoration: InputDecoration(
                        labelText: '4. Vad kunde du som elev gjort annorlunda?',
                        hintText: 'Hur kunde du bidra mer? Vad kunde du förbättra?',
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                        prefixIcon: const Icon(Icons.psychology),
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Fråga 5
                    TextField(
                      controller: _selfAssessment5Controller,
                      keyboardType: TextInputType.number,
                      maxLines: 2,
                      decoration: InputDecoration(
                        labelText: '5. Vilket betyg för din APL-period? (1-10)',
                        hintText: '1=mindre bra, 10=fantastiskt',
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                        prefixIcon: const Icon(Icons.star),
                      ),
                    ),
                    const SizedBox(height: 24),

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
                      backgroundColor: Colors.orange,
                      foregroundColor: Colors.white,
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
        final weekNumber = _getWeekNumber(weekStartDate);
        weeks.add('V. $weekNumber');
      } catch (e) {
        weeks.add(weekStart);
      }
    }

    // Generera unik token
    final token = _generateToken();
    final expiresAt = DateTime.now().add(const Duration(days: 14));

    setState(() {
      _isUploading = true;
    });

    try {
      // Ladda upp bilder till Firebase Storage
      final List<Map<String, dynamic>> uploadedImages = [];
      
      for (int i = 0; i < _selectedImages.length; i++) {
        final image = _selectedImages[i];
        final fileName = '${user.uid}_${DateTime.now().millisecondsSinceEpoch}_$i.jpg';
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
            'uploadedAt': Timestamp.now(), // Använd Timestamp.now() istället för FieldValue.serverTimestamp()
            'fileName': fileName,
          });
        } catch (uploadError) {
          // Om en bild misslyckas, fortsätt med nästa
          print('Fel vid uppladdning av bild $i: $uploadError');
          if (!context.mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Varning: Bild ${i + 1} kunde inte laddas upp'),
              backgroundColor: Colors.orange,
              duration: const Duration(seconds: 2),
            ),
          );
        }
      }

      // Skapa bedömningsförfrågan
      final docRef = await FirebaseFirestore.instance
          .collection('assessmentRequests')
          .add({
            'studentUid': user.uid,
            'studentName': user.displayName ?? 'Elev',
            'timesheetIds': _selectedTimesheetIds.toList(),
            'weeks': weeks,
            'totalHours': totalHours,
            'lunchCount': lunchCount,
            'travelCount': travelCount,
            'status': 'pending',
            'createdAt': FieldValue.serverTimestamp(),
            'token': token,
            'expiresAt': Timestamp.fromDate(expiresAt),
            'images': uploadedImages,
            // Selfassessment
            'studentSelfAssessment': {
              'whatDidYouDo': _selfAssessment1Controller.text.trim(),
              'whatWasPositive': _selfAssessment2Controller.text.trim(),
              'whatCouldBeBetter': _selfAssessment3Controller.text.trim(),
              'whatCouldYouDoDifferently': _selfAssessment4Controller.text.trim(),
              'overallRating': _selfAssessment5Controller.text.trim(),
            },
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
        _selfAssessment1Controller.clear();
        _selfAssessment2Controller.clear();
        _selfAssessment3Controller.clear();
        _selfAssessment4Controller.clear();
        _selfAssessment5Controller.clear();
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
        errorMessage = 'Saknar behörighet. Kontrollera att appen har tillgång till internet.';
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
        content: Column(
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
            const Text('Länk:', style: TextStyle(fontWeight: FontWeight.bold)),
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
              'Länken är giltig i 14 dagar',
              style: TextStyle(
                fontSize: 12,
                color: Colors.grey,
                fontStyle: FontStyle.italic,
              ),
            ),
          ],
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
