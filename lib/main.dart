import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'dart:math';
import 'dart:async';
import 'firebase_options.dart';
import 'Screens/tidkort_screen.dart';
import 'Screens/start_screen.dart';
import 'Screens/student_registration_screen.dart';
import 'Screens/approval_and_assessment_screen.dart';
import 'Screens/teacher_dashboard_screen.dart';
import 'Screens/week_management_screen.dart';
import 'Screens/statistics_screen.dart';
import 'Screens/supervisor_assessment_page.dart';
import 'Screens/bedomning_screen.dart';
import 'Screens/ersattning_screen.dart';
import 'Screens/admin_screen.dart';
import 'Screens/schools_screen.dart';
import 'Screens/settings_screen.dart';

// Tidkortmallar för olika specialiseringar
const activityTemplateTrabetare = <Map<String, dynamic>>[
  {
    "group": "Formsättning",
    "items": ["Formbyggnad", "Elementform", "Demontering"],
  },
  {
    "group": "Armering och betong",
    "items": ["Armering", "Betong"],
  },
  {
    "group": "Utvändigt arbete",
    "items": ["Utvändig beklädnad", "Tak", "Dörrar & Fönster"],
  },
  {
    "group": "Stomme och beklädnad",
    "items": ["Stolpverk", "Bjälklag"],
  },
  {
    "group": "Invändigt arbete",
    "items": [
      "Inredning",
      "Snickerier",
      "Invändig beklädnad",
      "Dörrar",
      "Golv",
    ],
  },
  {
    "group": "Isolering",
    "items": ["Värme/ljud/brand", "Fuktisolering"],
  },
  {
    "group": "Reparationer",
    "items": ["Demontering/Rivning", "Återmontering"],
  },
  {
    "group": "Miljö / Övrigt",
    "items": ["Miljö", "Hjälparbeten", "Skyddsarbeten", "Övrigt"],
  },
];

// TODO: Lägg till mallar för andra specialiseringar
const activityTemplateMurare = <Map<String, dynamic>>[
  {
    "group": "Murning",
    "items": ["Tegel", "Betongblock", "Lättbetong"],
  },
  {
    "group": "Puts",
    "items": ["Grovputs", "Finputs", "Puts övrigt"],
  },
  {
    "group": "Övrigt",
    "items": ["Byggnadsställning", "Hjälparbeten", "Övrigt"],
  },
];

const activityTemplateMalare = <Map<String, dynamic>>[
  {
    "group": "Invändig målning - Snickerier m.m.",
    "items": ["Underbehandling", "Målning"],
  },
  {
    "group": "Invändig målning - Tak & Väggar",
    "items": ["Underbehandling", "Målning", "Tapetsering", "Vävsättning"],
  },
  {
    "group": "Utvändig målning - Trä & mineraliska ytor",
    "items": ["Underbehandling", "Målning"],
  },
  {
    "group": "Utvändig målning - Fönster",
    "items": ["Underbehandling", "Målning"],
  },
  {
    "group": "Övrigt",
    "items": ["Övrigt"],
  },
];

const activityTemplateAnlaggare = <Map<String, dynamic>>[
  {
    "group": "Anläggning och vägbyggnad",
    "items": [
      "Vägarbeten",
      "Beläggningar",
      "Gångbanor",
      "Grundläggningar",
      "Ledningsbyggnad",
      "Gröna ytor",
      "Maskiner",
      "Markbyggnad",
      "Rörläggning",
    ],
  },
  {
    "group": "Armering och betong",
    "items": ["Armering", "Betong"],
  },
  {
    "group": "Miljö",
    "items": ["Hjälparbeten", "Skyddsarbeten"],
  },
  {
    "group": "Övrigt",
    "items": ["Övrigt"],
  },
];

const activityTemplateVVS = <Map<String, dynamic>>[
  {
    "group": "VVS-installationer",
    "items": [
      "Radiatorer och övriga värmare",
      "Sanitära apparater",
      "Installation i pannapparat och fläktrum",
      "Värmeledningar",
      "Kall- och varmvattenledningar",
      "Avloppsledningar inomhus",
      "Utomhusledningar",
      "Reparations- och servicearbeten",
      "Svetsning av rör",
      "Övrigt",
    ],
  },
];

const activityTemplatePlatslagare = <Map<String, dynamic>>[
  {
    "group": "Plåtarbete",
    "items": [
      "Verkstadsarbete",
      "Ventilation - tillverkning",
      "Ventilation - montering",
      "Ventilation - service",
      "Takarbete",
      "Garneringsarbete",
      "Fasadarbete",
      "Profilerad plåt",
    ],
  },
  {
    "group": "Övrigt",
    "items": ["Övrigt"],
  },
  {
    "group": "Miljö",
    "items": ["Hjälparbeten", "Skyddsarbeten"],
  },
];

const activityTemplateDefault = <Map<String, dynamic>>[
  {
    "group": "Arbetsuppgifter",
    "items": ["Uppgift 1", "Uppgift 2", "Uppgift 3"],
  },
  {
    "group": "Övrigt",
    "items": ["Hjälparbeten", "Övrigt"],
  },
];

// Funktion för att hämta rätt tidkortmall baserat på specialisering
List<Map<String, dynamic>> getActivityTemplate(String? specialization) {
  switch (specialization) {
    case 'Träarbetare':
      return activityTemplateTrabetare;
    case 'Murare':
      return activityTemplateMurare;
    case 'Målare':
      return activityTemplateMalare;
    case 'Anläggare':
      return activityTemplateAnlaggare;
    case 'VVS':
      return activityTemplateVVS;
    case 'Plåtslagare':
      return activityTemplatePlatslagare;
    case 'Elektriker':
      // TODO: Lägg till specifik mall för elektriker
      return activityTemplateDefault;
    default:
      return activityTemplateTrabetare; // Fallback till Träarbetare
  }
}

// Bakåtkompatibilitet - använd Träarbetare som default
const activityTemplate = activityTemplateTrabetare;

String _ymd(DateTime d) {
  String two(int n) => n.toString().padLeft(2, '0');
  return '${d.year}-${two(d.month)}-${two(d.day)}';
}

class WeeklyTimesheetScreen extends StatefulWidget {
  final String studentUid;
  final String teacherUid;
  final String? classId; // Optional - hämtas från användarens profil om saknas
  final String weekStart; // YYYY-MM-DD
  final bool readOnly; // true för lärare-läge
  final String? lockedMessage; // Meddelande om tidkortet är låst
  final String? specialization; // Elevens specialisering för rätt tidkortmall

  const WeeklyTimesheetScreen({
    super.key,
    required this.studentUid,
    required this.teacherUid,
    this.classId,
    required this.weekStart,
    required this.readOnly,
    this.lockedMessage,
    this.specialization,
  });

  @override
  State<WeeklyTimesheetScreen> createState() => _WeeklyTimesheetScreenState();
}

class _WeeklyTimesheetScreenState extends State<WeeklyTimesheetScreen> {
  final _controllers = <String, Map<String, TextEditingController>>{};
  final _commentControllers = <String, TextEditingController>{}; // For "Övrigt" comments
  bool _saving = false;
  String? _msg;
  List<Map<String, dynamic>>? _activityTemplate;
  bool _controllersInitialized = false;
  bool _hydratedFromFirestore = false;

  static const _days = ['mon', 'tue', 'wed', 'thu', 'fri'];
  static const _activityKeySeparator = '::';

  String _buildActivityKey(String group, String item) =>
      '$group$_activityKeySeparator$item';

  String _activityItemFromKey(String activityKey) {
    final separatorIndex = activityKey.indexOf(_activityKeySeparator);
    if (separatorIndex < 0) return activityKey;
    return activityKey.substring(separatorIndex + _activityKeySeparator.length);
  }

  List<String> _findScopedKeysForItem(String item) {
    return _controllers.keys
        .where((key) => _activityItemFromKey(key) == item)
        .toList();
  }

  Future<void> _initializeTemplate() async {
    if (_controllersInitialized) return;

    String? specialization = widget.specialization;

    // Hämta specialisering från Firestore om inte angiven
    if (specialization == null) {
      try {
        final userDoc = await FirebaseFirestore.instance
            .collection('users')
            .doc(widget.studentUid)
            .get();
        specialization = userDoc.data()?['specialization'] as String?;
      } catch (e) {
        print('Kunde inte hämta specialisering: $e');
      }
    }

    _activityTemplate = getActivityTemplate(specialization);

    // Skapa controllers för alla rader/dagar (tomma istället för '0')
    for (final g in _activityTemplate!) {
      final group = (g['group'] ?? '').toString();
      for (final item in (g['items'] as List)) {
        final name = item.toString();
        final activityKey = _buildActivityKey(group, name);
        _controllers[activityKey] = {
          for (final day in _days) day: TextEditingController(),
        };
        // Create comment controller for "Övrigt" items
        if (name == 'Övrigt') {
          _commentControllers[activityKey] = TextEditingController();
        }
      }
    }

    _controllersInitialized = true;
  }

  @override
  void dispose() {
    for (final row in _controllers.values) {
      for (final c in row.values) {
        c.dispose();
      }
    }
    for (final c in _commentControllers.values) {
      c.dispose();
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
        // Bara lägg till värden som faktiskt har värde (inte 0 eller null)
        if (val != null && val > 0) {
          dayMap[day] = val;
        }
      }
      // Bara lägg till aktiviteten om den har minst en dag med tid
      if (dayMap.isNotEmpty) {
        out[activity] = dayMap;
      }
    }
    print('DEBUG _buildEntries: Sparar ${out.length} aktiviteter');
    print('DEBUG _buildEntries: Data = $out');
    return out;
  }

  Map<String, dynamic> _buildComments() {
    final out = <String, dynamic>{};
    for (final entry in _commentControllers.entries) {
      final activity = entry.key;
      final comment = entry.value.text.trim();
      if (comment.isNotEmpty) {
        out[activity] = comment;
      }
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
    final snap = await FirebaseFirestore.instance
        .collection('timesheets')
        .doc(docId)
        .get();
    final approved = (snap.data()?['approved'] ?? false) == true;
    final locked = (snap.data()?['locked'] ?? false) == true;
    
    if (approved || locked) {
      setState(() {
        _msg = 'Tidkortet är godkänt och låst.';
        _saving = false;
      });
      return;
    }

    try {
      // Hämta classId från användarens profil om det inte finns i parametern
      String classId = widget.classId ?? '';
      if (classId.isEmpty) {
        final userDoc = await FirebaseFirestore.instance
            .collection('users')
            .doc(widget.studentUid)
            .get();
        classId = userDoc.data()?['classId'] ?? '';
      }

      final docId = '${widget.studentUid}_${widget.weekStart}';
      
      // Debug: Logga vad vi försöker spara
      print('DEBUG: Försöker spara tidkort');
      print('  docId: $docId');
      print('  studentUid: ${widget.studentUid}');
      print('  auth.uid: ${FirebaseAuth.instance.currentUser?.uid}');
      print('  classId: $classId');
      
      // Hämta befintlig data för att behålla approved/locked status
      final existingDoc = await FirebaseFirestore.instance
          .collection('timesheets')
          .doc(docId)
          .get();
      
      final existingData = existingDoc.data() ?? {};
      
      await FirebaseFirestore.instance.collection('timesheets').doc(docId).set(
        {
          'studentUid': widget.studentUid,
          'teacherUid': widget.teacherUid,
          'classId': classId,
          'weekStart': widget.weekStart,
          'entries': _buildEntries(), // Skriv över helt - tar bort gamla 0:or
          'comments': _buildComments(),
          'updatedAt': FieldValue.serverTimestamp(),
          // Behåll approved/locked status om de finns
          if (existingData.containsKey('approved')) 
            'approved': existingData['approved'],
          if (existingData.containsKey('locked'))
            'locked': existingData['locked'],
        },
        SetOptions(merge: true),
      );

      setState(() => _msg = 'Sparat ✅');
    } catch (e) {
      // Visa tydligare felmeddelande för permission-denied
      String errorMsg = 'Fel: $e';
      if (e.toString().contains('permission-denied')) {
        errorMsg = 'Kan inte spara: Du saknar rättigheter att redigera detta tidkort. Kontakta din lärare.';
      }
      setState(() => _msg = errorMsg);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder(
      future: _initializeTemplate(),
      builder: (outerContext, snapshot) {
        if (!_controllersInitialized) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        final docId = '${widget.studentUid}_${widget.weekStart}';
        final docStream = FirebaseFirestore.instance
            .collection('timesheets')
            .doc(docId)
            .snapshots();

        return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
          stream: docStream,
          builder: (innerContext, snap) {
            final data = snap.data?.data();
            final entries = (data?['entries'] as Map?)?.cast<String, dynamic>();
            final approved = (data?['approved'] ?? false) as bool;
            final locked = (data?['locked'] ?? false) as bool;
            final effectiveReadOnly = widget.readOnly || approved || locked;

            // Hydrera endast en gång från Firestore så vi inte skriver över
            // användarens inmatning vid rebuilds under redigering.
            if (!_hydratedFromFirestore) {
              if (entries != null) {
                for (final e in entries.entries) {
                  final activity = e.key;
                  final dayMap = (e.value as Map?)?.cast<String, dynamic>() ?? {};
                  final targetRows = <Map<String, TextEditingController>>[];

                  final scopedRow = _controllers[activity];
                  if (scopedRow != null) {
                    targetRows.add(scopedRow);
                  } else {
                    final legacyMatches = _findScopedKeysForItem(activity);
                    if (legacyMatches.isNotEmpty) {
                      targetRows.add(_controllers[legacyMatches.first]!);
                    }
                  }

                  for (final row in targetRows) {
                    for (final day in _days) {
                      final rawValue = dayMap[day];
                      if (rawValue != null && rawValue != 0) {
                        final v = rawValue.toString();
                        if (row[day]!.text != v) row[day]!.text = v;
                      }
                    }
                  }
                }
              }

              final comments =
                  (data?['comments'] as Map?)?.cast<String, dynamic>();
              if (comments != null) {
                for (final c in comments.entries) {
                  final activity = c.key;
                  final comment = c.value.toString();
                  final targets = <TextEditingController>[];

                  final scopedController = _commentControllers[activity];
                  if (scopedController != null) {
                    targets.add(scopedController);
                  } else {
                    final legacyMatches = _commentControllers.entries
                        .where(
                          (entry) => _activityItemFromKey(entry.key) == activity,
                        )
                        .map((entry) => entry.value)
                        .toList();
                    if (legacyMatches.isNotEmpty) {
                      targets.add(legacyMatches.first);
                    }
                  }

                  for (final controller in targets) {
                    if (controller.text != comment) {
                      controller.text = comment;
                    }
                  }
                }
              }

              _hydratedFromFirestore = true;
            }

            // Beräkna veckonummer från weekStart
            int weekNumber = 1;
            try {
              final parts = widget.weekStart.split('-');
              if (parts.length == 3) {
                final year = int.parse(parts[0]);
                final month = int.parse(parts[1]);
                final day = int.parse(parts[2]);
                final startDate = DateTime(year, month, day);
                final jan4 = DateTime(startDate.year, 1, 4);
                final monday = jan4.subtract(
                  Duration(days: jan4.weekday - DateTime.monday),
                );
                weekNumber = startDate.difference(monday).inDays ~/ 7 + 1;
              }
            } catch (e) {
              // Använd default om parsning misslyckas
            }

            return Scaffold(
              appBar: AppBar(
                title: Text('Tidkort vecka $weekNumber'),
                elevation: 0,
                actions: [
                  if (!effectiveReadOnly)
                    IconButton(
                      tooltip: 'Spara',
                      onPressed: _saving ? null : _save,
                      icon: const Icon(Icons.save),
                    ),
                  if (widget.readOnly)
                    IconButton(
                      tooltip: approved
                          ? 'Avmarkera godkänd'
                          : 'Markera godkänd',
                      onPressed: () async {
                        await FirebaseFirestore.instance
                            .collection('timesheets')
                            .doc(docId)
                            .set({
                              'approved': !approved,
                            }, SetOptions(merge: true));
                      },
                      icon: Icon(
                        approved
                            ? Icons.check_circle
                            : Icons.check_circle_outline,
                      ),
                    ),
                ],
              ),
              body: SingleChildScrollView(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Status card
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              Colors.orange.shade400,
                              Colors.orange.shade600,
                            ],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text(
                                      'Denna vecka',
                                      style: TextStyle(
                                        color: Colors.white70,
                                        fontSize: 12,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      '${_sumWeek()} timmar',
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 28,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ],
                                ),
                                if (approved)
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 12,
                                      vertical: 8,
                                    ),
                                    decoration: BoxDecoration(
                                      color: Colors.green.shade400,
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: const Text(
                                      'GODKÄND ✅',
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontWeight: FontWeight.bold,
                                        fontSize: 12,
                                      ),
                                    ),
                                  )
                                else
                                  Container(
                                    padding: const EdgeInsets.all(10),
                                    decoration: BoxDecoration(
                                      color: Colors.white.withOpacity(0.2),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: const Icon(
                                      Icons.edit,
                                      color: Colors.white,
                                    ),
                                  ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Visa låst-meddelande om tidkortet är låst
                      if (widget.lockedMessage != null) ...[
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.red.shade50,
                            border: Border.all(color: Colors.red.shade200),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Row(
                            children: [
                              Icon(Icons.lock, color: Colors.red.shade700),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  widget.lockedMessage!,
                                  style: TextStyle(
                                    color: Colors.red.shade700,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],

                      if (_msg != null) ...[
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: _msg!.contains('Sparat')
                                ? Colors.green.shade50
                                : Colors.orange.shade50,
                            border: Border.all(
                              color: _msg!.contains('Sparat')
                                  ? Colors.green.shade200
                                  : Colors.orange.shade200,
                            ),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            _msg!,
                            style: TextStyle(
                              color: _msg!.contains('Sparat')
                                  ? Colors.green.shade700
                                  : Colors.orange.shade700,
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],

                      const Text(
                        'Arbetssyssla',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 12),

                      // Aktiviteter grupperade
                      for (final g in _activityTemplate!) ...[
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 8,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade100,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            g['group'].toString(),
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: Colors.grey.shade800,
                            ),
                          ),
                        ),
                        const SizedBox(height: 10),
                        for (final item in (g['items'] as List)) ...[
                          (() {
                            final itemName = item.toString();
                            final activityKey = _buildActivityKey(
                              g['group'].toString(),
                              itemName,
                            );

                            return _TimesheetRow(
                              label: itemName,
                              controllers: _controllers[activityKey]!,
                              readOnly: effectiveReadOnly,
                              commentController: itemName == 'Övrigt'
                                  ? _commentControllers[activityKey]
                                  : null,
                            );
                          })(),
                          const SizedBox(height: 10),
                        ],
                        const SizedBox(height: 8),
                      ],

                      if (!effectiveReadOnly)
                        Padding(
                          padding: const EdgeInsets.only(top: 16, bottom: 32),
                          child: SizedBox(
                            width: double.infinity,
                            child: ElevatedButton.icon(
                              onPressed: _saving ? null : _save,
                              icon: const Icon(Icons.save),
                              label: const Text('Spara tidkort'),
                              style: ElevatedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(
                                  vertical: 16,
                                ),
                              ),
                            ),
                          ),
                        ),
                      const SizedBox(height: 20),
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

class _TimesheetRow extends StatelessWidget {
  final String label;
  final Map<String, TextEditingController> controllers;
  final bool readOnly;
  final TextEditingController? commentController;

  const _TimesheetRow({
    required this.label,
    required this.controllers,
    required this.readOnly,
    this.commentController,
  });

  static const _days = ['mon', 'tue', 'wed', 'thu', 'fri'];
  static const _dayLabel = {
    'mon': 'Mån',
    'tue': 'Tis',
    'wed': 'Ons',
    'thu': 'Tor',
    'fri': 'Fre',
  };

  int _getRowSum() {
    int sum = 0;
    for (final day in _days) {
      sum += int.tryParse(controllers[day]!.text.trim()) ?? 0;
    }
    return sum;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey.shade200, width: 1),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    label,
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.orange.shade50,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    '${_getRowSum()}h',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: Colors.orange.shade700,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            // Dag-headers
            Row(
              children: [
                for (final day in _days) ...[
                  Expanded(
                    child: Text(
                      _dayLabel[day]!,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: Colors.grey.shade600,
                      ),
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 8),
            // Input-fält
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
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 14,
                        ),
                        decoration: InputDecoration(
                          isDense: true,
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 10,
                          ),
                          hintText: '0',
                          hintStyle: TextStyle(color: Colors.grey.shade300),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(6),
                            borderSide: BorderSide(color: Colors.grey.shade300),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(6),
                            borderSide: BorderSide(color: Colors.grey.shade300),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(6),
                            borderSide: BorderSide(
                              color: Colors.orange.shade400,
                              width: 2,
                            ),
                          ),
                          disabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(6),
                            borderSide: BorderSide(color: Colors.grey.shade200),
                          ),
                          filled: readOnly,
                          fillColor: readOnly
                              ? Colors.grey.shade100
                              : Colors.white,
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
            // Comment field for "Övrigt"
            if (commentController != null) ...[
              const SizedBox(height: 12),
              TextField(
                controller: commentController,
                readOnly: readOnly,
                maxLines: 3,
                style: const TextStyle(fontSize: 13),
                decoration: InputDecoration(
                  labelText: 'Kommentar - Vad gjorde du?',
                  labelStyle: TextStyle(
                    fontSize: 12,
                    color: Colors.grey.shade600,
                  ),
                  hintText: 'Beskriv vad denna övrigt-tid användes till',
                  hintStyle: TextStyle(color: Colors.grey.shade300),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(6),
                    borderSide: BorderSide(color: Colors.grey.shade300),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(6),
                    borderSide: BorderSide(color: Colors.grey.shade300),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(6),
                    borderSide: BorderSide(
                      color: Colors.orange.shade400,
                      width: 2,
                    ),
                  ),
                  disabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(6),
                    borderSide: BorderSide(color: Colors.grey.shade200),
                  ),
                  filled: readOnly,
                  fillColor: readOnly ? Colors.grey.shade100 : Colors.white,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                ),
              ),
            ],
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
      // ...lägg till logik för att spara bedömning här...
    } catch (e) {
      setState(() {
        _error = 'Fel: $e';
        _loading = false;
      });
    } finally {
      setState(() {
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    // TODO: Bygg UI för AssessmentFormPage här
    return Scaffold(
      appBar: AppBar(title: const Text('Bedömning')),
      body: Center(child: Text('AssessmentFormPage UI här')),
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
        primarySwatch: Colors.orange,
        colorScheme: ColorScheme.fromSeed(
          seedColor: Colors.orange,
          primary: Colors.orange,
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.orange,
          foregroundColor: Colors.white,
        ),
        floatingActionButtonTheme: const FloatingActionButtonThemeData(
          backgroundColor: Colors.orange,
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
  String? _selectedSpecialization;
  bool _loading = false;
  String? _error;
  int _step = 1; // 1 = klasskod, 2 = yrkesutgång

  final specializations = [
    'Träarbetare',
    'Murare',
    'Målare',
    'Plåtslagare',
    'Elektriker',
    'VVS',
    'Anläggare',
  ];

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
      await FirebaseFirestore.instance.collection('users').doc(user.uid).update(
        {
          'classId': classId,
          'teacherUid': teacherUid,
          'teacherId': teacherUid,
          if (teacherSchool.isNotEmpty) 'school': teacherSchool,
        },
      );

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

      // Gå vidare till specialiseringsval
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

  Future<void> _submitSpecialization() async {
    if (_selectedSpecialization == null) {
      setState(() => _error = 'Välj en yrkesutgång');
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final user = FirebaseAuth.instance.currentUser!;

      // Uppdatera med yrkesutgång och markera onboarding som klar
      await FirebaseFirestore.instance.collection('users').doc(user.uid).update(
        {'specialization': _selectedSpecialization, 'onboardingComplete': true},
      );

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
                : _buildSpecializationStep(),
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

  Widget _buildSpecializationStep() {
    return LayoutBuilder(
      builder: (context, constraints) {
        return SingleChildScrollView(
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: constraints.maxHeight),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
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
                const Text(
                  'Din yrkesutgång avgör vilka arbetsmoment du ser i tidkorten',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.grey),
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
                              _submitSpecialization();
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

            if (data != null && data['role'] == 'teacher' && data['approved'] != true) {
              return ApprovalPendingScreen(user: user);
            }

            switch (role) {
              case 'admin':
                return const AdminScreen();

              case 'teacher':
                return const MainNavigation();

              default: // student
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

  Future<void> _showRegisterDialog() async {
    // Först välja roll
    final role = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Skapa konto'),
        content: const Text('Välj din roll:'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Avbryt'),
          ),
          ElevatedButton.icon(
            onPressed: () => Navigator.pop(ctx, 'student'),
            icon: const Icon(Icons.school),
            label: const Text('Elev'),
          ),
          ElevatedButton.icon(
            onPressed: () {
              print('Lärarknapp tryckt');
              Navigator.pop(ctx, 'teacher');
            },
            icon: const Icon(Icons.person),
            label: const Text('Lärare'),
          ),
        ],
      ),
    );

    if (role == null) return;

    if (role == 'student') {
      await _showStudentRegisterDialog();
    } else {
      print('Försöker visa lärarregistreringsdialog');
      try {
        await _showTeacherRegisterDialog();
      } catch (e) {
        print('Kunde inte visa lärarregistreringsdialog: $e');
        if (context.mounted) {
          showDialog(
            context: context,
            builder: (ctx) => AlertDialog(
              title: const Text('Fel'),
              content: Text('Kunde inte visa lärarregistreringsdialog: $e'),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('OK'),
                ),
              ],
            ),
          );
        }
      }
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
                          .map((s) => DropdownMenuItem(
                                value: s,
                                child: Text(s),
                              ))
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
                      const SnackBar(
                        content: Text(
                          'Fyll i alla fält',
                        ),
                      ),
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
        print('🔄 Attempting to send verification email to: ${cred.user!.email}');
        
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
        'role': 'teacher',
        'school': school,
        'approved': false, // Väntar på admin-godkännande
        'createdAt': FieldValue.serverTimestamp(),
      });

      // Skapa notis till admin
      await FirebaseFirestore.instance.collection('adminNotifications').add({
        'type': 'newTeacher',
        'teacherId': uid,
        'teacherName': fullName,
        'teacherEmail': email,
        'school': school,
        'createdAt': FieldValue.serverTimestamp(),
        'resolved': false,
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
                      const SizedBox(height: 32),

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

// skärm som visas när användarens e-post inte är verifierad
class EmailVerificationScreen extends StatefulWidget {
  final User user;
  const EmailVerificationScreen({required this.user, super.key});

  @override
  State<EmailVerificationScreen> createState() => _EmailVerificationScreenState();
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
          _message = 'E-post verifierad! Loggar ut - logga in igen för att fortsätta.';
        });
        await Future.delayed(const Duration(seconds: 2));
        await FirebaseAuth.instance.signOut();
      } else {
        setState(() {
          _message = 'E-posten är fortfarande inte verifierad. Kontrollera din inkorg och klicka på länken.';
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
        url: 'https://apl-appen-aa472.firebaseapp.com',
        handleCodeInApp: false,
        androidPackageName: 'com.example.apl_appen',
        androidInstallApp: false,
      );
      await widget.user.sendEmailVerification(actionCodeSettings);
      setState(() {
        _message = 'Verifieringsmejl skickat igen. Kontrollera även spam-mappen.';
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

// Dialog som hanterar elevregistrering internt för att undvika race conditions
class _StudentRegistrationDialog extends StatefulWidget {
  const _StudentRegistrationDialog();

  @override
  State<_StudentRegistrationDialog> createState() => _StudentRegistrationDialogState();
}

class _StudentRegistrationDialogState extends State<_StudentRegistrationDialog> {
  final _firstNameCtrl = TextEditingController();
  final _lastNameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  bool _loading = false;
  String? _error;

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

    if (firstName.isEmpty || lastName.isEmpty || email.isEmpty || password.isEmpty) {
      setState(() => _error = 'Alla fält måste fyllas i.');
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
                  border: OutlineInputBorder(),
                ),
                obscureText: true,
                enabled: !_loading,
              ),
              const SizedBox(height: 8),
              const Text(
                'Du kommer att ange klasskod och yrkesutgång efter att kontot skapats',
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
      final userDoc = await FirebaseFirestore.instance
          .collection('users')
          .doc(widget.user.uid)
          .get();

      if (!mounted) return;
      setState(() {
        _emailVerified = currentUser?.emailVerified == true;
        _approved = userDoc.data()?['approved'] == true;
        _statusMessage = 'Senast uppdaterad: ${TimeOfDay.now().format(context)}';
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
                  pendingText: 'Väntar: En administratör behöver godkänna ditt konto.',
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
                    label: Text(_checking ? 'Uppdaterar...' : 'Uppdatera status'),
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
      final teacherSchool =
          (currentTeacherDoc.data()?['school'] ?? '').toString().trim();

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
        final teacherSchool =
            (teacherSnap.data()?['school'] ?? '').toString().trim();

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
  final monday = jan4.subtract(
    Duration(days: jan4.weekday - DateTime.monday),
  );
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

    // Spara det i Firestore som en platshållare
    await FirebaseFirestore.instance.collection('assessments').doc(newId).set({
      'timesheetId': timesheetId,
      'studentUid': FirebaseAuth.instance.currentUser!.uid,
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
    print('DEBUG: initState() called for MainNavigation');
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
    print('DEBUG: Checking user role for ${user?.uid}');

    if (user != null) {
      try {
        // Läs användarens roll från Firestore
        final doc = await FirebaseFirestore.instance
            .collection('users')
            .doc(user.uid)
            .get();

        final userData = doc.data();
        print('DEBUG: User document data: $userData');

        final role = (userData?['role'] as String? ?? '').trim().toLowerCase();
        print('DEBUG: Extracted role: "$role" (length: ${role.length})');

        final isTeacher = role == 'teacher';
        final isAdmin = role == 'admin';
        print('DEBUG: isTeacher = $isTeacher, isAdmin = $isAdmin');

        if (mounted) {
          setState(() {
            _isTeacher = isTeacher;
            _isAdmin = isAdmin;
            _isLoading = false;
            print('DEBUG: setState called, _isTeacher is now $_isTeacher, _isAdmin is now $_isAdmin');
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
        print('DEBUG: Error getting user role: $e');
        if (mounted) {
          setState(() {
            _isLoading = false;
          });
        }
      }
    } else {
      print('DEBUG: No current user');
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
    print('DEBUG: _getScreens() called, _isTeacher=$_isTeacher, _isAdmin=$_isAdmin');
    if (_isTeacher || _isAdmin) {
      print('DEBUG: Returning TEACHER/ADMIN screens');
      return [
        TeacherDashboardScreen(
          onNavigateToApproval: () {
            setState(() {
              _currentIndex = 2; // Index för Statistik-skärmen
            });
          },
        ),
        const StudentRegistrationScreen(),
        // ApprovalAndAssessmentScreen borttagen från navigation men filen finns kvar för framtida bruk
        const StatisticsScreen(),
        const WeekManagementScreen(),
        if (_isAdmin) SchoolsScreen(), // Skolor-flik för admin
        SettingsScreen(),
      ];
    } else {
      print('DEBUG: Returning STUDENT screens');
      return const [
        StartScreen(),
        TidkortScreen(),
        BedomningScreen(),
        ErsattningScreen(),
      ];
    }
  }

  @override
  Widget build(BuildContext context) {
    print(
      'DEBUG: MainNavigation.build() called, _isTeacher=$_isTeacher, _isLoading=$_isLoading',
    );

    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(title: const Text('APL-appen')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    final screens = _getScreens();
    return Scaffold(
      appBar: AppBar(
        title: const Text('APL-appen'),
        actions: [
          // DEBUG: Visa aktuell roll
          Tooltip(
            message: _isTeacher ? 'Du är lärare' : _isAdmin ? 'Du är admin' : 'Du är elev',
            child: Padding(
              padding: const EdgeInsets.all(8.0),
              child: Center(
                child: Text(
                  _isTeacher ? '👨‍🏫' : _isAdmin ? '🛠️' : '👨‍🎓',
                  style: const TextStyle(fontSize: 20),
                ),
              ),
            ),
          ),
          IconButton(
            tooltip: 'Logga ut',
            onPressed: () => FirebaseAuth.instance.signOut(),
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: screens[_currentIndex],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) => setState(() => _currentIndex = index),
        type: BottomNavigationBarType.fixed,
        showUnselectedLabels: true,
        items: (_isTeacher || _isAdmin)
            ? [
                const BottomNavigationBarItem(
                  icon: Icon(Icons.dashboard),
                  label: 'Hem',
                ),
                const BottomNavigationBarItem(
                  icon: Icon(Icons.person_add),
                  label: 'Elever',
                ),
                const BottomNavigationBarItem(
                  icon: Icon(Icons.analytics),
                  label: 'Statistik',
                ),
                const BottomNavigationBarItem(
                  icon: Icon(Icons.calendar_today),
                  label: 'Veckor',
                ),
                if (_isAdmin)
                  const BottomNavigationBarItem(
                    icon: Icon(Icons.school),
                    label: 'Skolor',
                  ),
                const BottomNavigationBarItem(
                  icon: Icon(Icons.settings),
                  label: 'Inställningar',
                ),
              ]
            : [
                const BottomNavigationBarItem(
                  icon: Icon(Icons.home),
                  label: 'Hem',
                ),
                const BottomNavigationBarItem(
                  icon: Icon(Icons.access_time),
                  label: 'Tidkort',
                ),
                const BottomNavigationBarItem(
                  icon: Icon(Icons.checklist),
                  label: 'Bedömning',
                ),
                const BottomNavigationBarItem(
                  icon: Icon(Icons.analytics),
                  label: 'Statistik',
                ),
              ],
      ),
    );
  }
}
