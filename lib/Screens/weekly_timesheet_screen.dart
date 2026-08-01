import 'dart:math';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:apl_appen/core/program_catalog.dart';

const activityTemplateTrabetare = <Map<String, dynamic>>[
  {
    'group': 'Formsättning',
    'items': ['Formbyggnad', 'Elementform', 'Demontering'],
  },
  {
    'group': 'Armering och betong',
    'items': ['Armering', 'Betong'],
  },
  {
    'group': 'Utvändigt arbete',
    'items': ['Utvändig beklädnad', 'Tak', 'Dörrar & Fönster'],
  },
  {
    'group': 'Stomme och beklädnad',
    'items': ['Stolpverk', 'Bjälklag'],
  },
  {
    'group': 'Invändigt arbete',
    'items': [
      'Inredning',
      'Snickerier',
      'Invändig beklädnad',
      'Dörrar',
      'Golv',
    ],
  },
  {
    'group': 'Isolering',
    'items': ['Värme/ljud/brand', 'Fuktisolering'],
  },
  {
    'group': 'Reparationer',
    'items': ['Demontering/Rivning', 'Återmontering'],
  },
  {
    'group': 'Miljö / Övrigt',
    'items': ['Miljö', 'Hjälparbeten', 'Skyddsarbeten', 'Övrigt'],
  },
];

const activityTemplateMurare = <Map<String, dynamic>>[
  {
    'group': 'Murning',
    'items': ['Tegel', 'Betongblock', 'Lättbetong'],
  },
  {
    'group': 'Puts',
    'items': ['Grovputs', 'Finputs', 'Puts övrigt'],
  },
  {
    'group': 'Övrigt',
    'items': ['Byggnadsställning', 'Hjälparbeten', 'Övrigt'],
  },
];

const activityTemplateMalare = <Map<String, dynamic>>[
  {
    'group': 'Invändig målning - Snickerier m.m.',
    'items': ['Underbehandling', 'Målning'],
  },
  {
    'group': 'Invändig målning - Tak & Väggar',
    'items': ['Underbehandling', 'Målning', 'Tapetsering', 'Vävsättning'],
  },
  {
    'group': 'Utvändig målning - Trä & mineraliska ytor',
    'items': ['Underbehandling', 'Målning'],
  },
  {
    'group': 'Utvändig målning - Fönster',
    'items': ['Underbehandling', 'Målning'],
  },
  {
    'group': 'Övrigt',
    'items': ['Övrigt'],
  },
];

const activityTemplateAnlaggare = <Map<String, dynamic>>[
  {
    'group': 'Anläggning och vägbyggnad',
    'items': [
      'Vägarbeten',
      'Beläggningar',
      'Gångbanor',
      'Grundläggningar',
      'Ledningsbyggnad',
      'Gröna ytor',
      'Maskiner',
      'Markbyggnad',
      'Rörläggning',
    ],
  },
  {
    'group': 'Armering och betong',
    'items': ['Armering', 'Betong'],
  },
  {
    'group': 'Miljö',
    'items': ['Hjälparbeten', 'Skyddsarbeten'],
  },
  {
    'group': 'Övrigt',
    'items': ['Övrigt'],
  },
];

const activityTemplateVVS = <Map<String, dynamic>>[
  {
    'group': 'VVS-installationer',
    'items': [
      'Radiatorer och övriga värmare',
      'Sanitära apparater',
      'Installation i pannapparat och fläktrum',
      'Värmeledningar',
      'Kall- och varmvattenledningar',
      'Avloppsledningar inomhus',
      'Utomhusledningar',
      'Reparations- och servicearbeten',
      'Svetsning av rör',
      'Övrigt',
    ],
  },
];

const activityTemplatePlatslagare = <Map<String, dynamic>>[
  {
    'group': 'Plåtarbete',
    'items': [
      'Verkstadsarbete',
      'Ventilation - tillverkning',
      'Ventilation - montering',
      'Ventilation - service',
      'Takarbete',
      'Garneringsarbete',
      'Fasadarbete',
      'Profilerad plåt',
    ],
  },
  {
    'group': 'Övrigt',
    'items': ['Övrigt'],
  },
  {
    'group': 'Miljö',
    'items': ['Hjälparbeten', 'Skyddsarbeten'],
  },
];

const activityTemplateDefault = <Map<String, dynamic>>[
  {
    'group': 'Arbetsuppgifter',
    'items': ['Uppgift 1', 'Uppgift 2', 'Uppgift 3'],
  },
  {
    'group': 'Övrigt',
    'items': ['Hjälparbeten', 'Övrigt'],
  },
];

String _buildTimesheetTemplateId(
  String teacherUid,
  String? program,
  String? specialization,
) {
  final normalizedProgram = Uri.encodeComponent((program ?? '').trim());
  final normalizedSpecialization = Uri.encodeComponent(
    (specialization ?? '').trim(),
  );
  return '${teacherUid}__${normalizedProgram}__${normalizedSpecialization}';
}

String _buildDefaultTimesheetTemplateId(
  String? program,
  String? specialization,
) {
  final normalizedProgram = Uri.encodeComponent((program ?? '').trim());
  final normalizedSpecialization = Uri.encodeComponent(
    (specialization ?? '').trim(),
  );
  return '${normalizedProgram}__${normalizedSpecialization}';
}

List<Map<String, dynamic>>? _parseStoredActivityTemplate(dynamic rawGroups) {
  if (rawGroups is! List) return null;

  final parsedGroups = <Map<String, dynamic>>[];

  for (final rawGroup in rawGroups) {
    if (rawGroup is! Map) continue;

    final groupName = (rawGroup['group'] ?? '').toString().trim();
    if (groupName.isEmpty) continue;

    final rawItems = rawGroup['items'];
    if (rawItems is! List) continue;

    final items = <String>[];
    final seenItems = <String>{};

    for (final rawItem in rawItems) {
      if (rawItem is! Map) continue;

      final enabled = rawItem['enabled'] != false;
      if (!enabled) continue;

      final itemName = (rawItem['name'] ?? '').toString().trim();
      if (itemName.isEmpty) continue;

      final normalizedItemName = itemName.toLowerCase();
      if (seenItems.contains(normalizedItemName)) continue;
      seenItems.add(normalizedItemName);
      items.add(itemName);
    }

    if (items.isEmpty) continue;

    parsedGroups.add({
      'group': groupName,
      'items': items,
    });
  }

  return parsedGroups.isEmpty ? null : parsedGroups;
}

Future<List<Map<String, dynamic>>?> loadTeacherActivityTemplate({
  required String teacherUid,
  String? program,
  String? specialization,
}) async {
  try {
    final templateId = _buildTimesheetTemplateId(
      teacherUid,
      program,
      specialization,
    );

    final doc = await FirebaseFirestore.instance
        .collection('timesheetTemplates')
        .doc(templateId)
        .get();

    if (!doc.exists) return null;

    return _parseStoredActivityTemplate(doc.data()?['groups']);
  } catch (_) {
    return null;
  }
}

Future<List<Map<String, dynamic>>?> loadDefaultActivityTemplate({
  String? program,
  String? specialization,
}) async {
  try {
    final templateId = _buildDefaultTimesheetTemplateId(program, specialization);

    final doc = await FirebaseFirestore.instance
        .collection('defaultTimesheetTemplates')
        .doc(templateId)
        .get();

    if (!doc.exists) return null;

    return _parseStoredActivityTemplate(doc.data()?['groups']);
  } catch (_) {
    return null;
  }
}

List<Map<String, dynamic>> getActivityTemplate(
  String? specialization, {
  String? program,
}) {
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
      return activityTemplateDefault;
    default:
      if (program == null || program.isEmpty) {
        return activityTemplateTrabetare;
      }
      if (program == 'Bygg- och anläggningsprogrammet') {
        return activityTemplateTrabetare;
      }
      return activityTemplateDefault;
  }
}

int _resolveWeekNumberFromWeekStart(String weekStart) {
  final parts = weekStart.split('-');
  if (parts.length != 3) return 1;

  final year = int.parse(parts[0]);
  final month = int.parse(parts[1]);
  final day = int.parse(parts[2]);
  final startDate = DateTime(year, month, day);
  final jan4 = DateTime(startDate.year, 1, 4);
  final monday = jan4.subtract(
    Duration(days: jan4.weekday - DateTime.monday),
  );
  return startDate.difference(monday).inDays ~/ 7 + 1;
}

class WeeklyTimesheetScreen extends StatefulWidget {
  final String studentUid;
  final String teacherUid;
  final String? classId;
  final String weekStart;
  final int? displayWeekNumber;
  final bool readOnly;
  final String? lockedMessage;
  final String? specialization;

  const WeeklyTimesheetScreen({
    super.key,
    required this.studentUid,
    required this.teacherUid,
    this.classId,
    required this.weekStart,
    this.displayWeekNumber,
    required this.readOnly,
    this.lockedMessage,
    this.specialization,
  });

  @override
  State<WeeklyTimesheetScreen> createState() => _WeeklyTimesheetScreenState();
}

class _WeeklyTimesheetScreenState extends State<WeeklyTimesheetScreen> {
  final _controllers = <String, Map<String, TextEditingController>>{};
  final _commentControllers = <String, TextEditingController>{};
  bool _saving = false;
  String? _msg;
  List<Map<String, dynamic>>? _activityTemplate;
  bool _controllersInitialized = false;
  bool _hydratedFromFirestore = false;
  bool _isProgrammaticControllerUpdate = false;
  bool _hasUnsavedChanges = false;
  Map<String, dynamic> _lastSavedEntries = {};
  Map<String, dynamic> _lastSavedComments = {};

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

  bool _mapsDeepEqual(Map<String, dynamic> a, Map<String, dynamic> b) {
    if (a.length != b.length) return false;

    for (final key in a.keys) {
      if (!b.containsKey(key)) return false;
      final av = a[key];
      final bv = b[key];

      if (av is Map<String, dynamic> && bv is Map<String, dynamic>) {
        if (!_mapsDeepEqual(av, bv)) return false;
      } else if (av is Map && bv is Map) {
        if (!_mapsDeepEqual(av.cast<String, dynamic>(), bv.cast<String, dynamic>())) {
          return false;
        }
      } else if (av != bv) {
        return false;
      }
    }

    return true;
  }

  Map<String, dynamic> _normalizeEntries(Map<String, dynamic>? rawEntries) {
    if (rawEntries == null) return {};

    final normalized = <String, dynamic>{};
    for (final entry in rawEntries.entries) {
      final row = (entry.value as Map?)?.cast<String, dynamic>() ?? {};
      final normalizedRow = <String, int>{};

      for (final day in _days) {
        final rawValue = row[day];
        final hours = (rawValue is int)
            ? rawValue
            : int.tryParse(rawValue?.toString() ?? '');
        if (hours != null && hours > 0) {
          normalizedRow[day] = hours;
        }
      }

      if (normalizedRow.isNotEmpty) {
        normalized[entry.key] = normalizedRow;
      }
    }

    return normalized;
  }

  Map<String, dynamic> _normalizeComments(Map<String, dynamic>? rawComments) {
    if (rawComments == null) return {};

    final normalized = <String, dynamic>{};
    for (final entry in rawComments.entries) {
      final value = entry.value.toString().trim();
      if (value.isNotEmpty) {
        normalized[entry.key] = value;
      }
    }

    return normalized;
  }

  bool _computeHasUnsavedChanges() {
    final currentEntries = _buildEntries();
    final currentComments = _buildComments();
    return !_mapsDeepEqual(currentEntries, _lastSavedEntries) ||
        !_mapsDeepEqual(currentComments, _lastSavedComments);
  }

  void _recomputeUnsavedState() {
    if (_isProgrammaticControllerUpdate) return;

    final hasChanges = _computeHasUnsavedChanges();

    if (hasChanges != _hasUnsavedChanges && mounted) {
      setState(() {
        _hasUnsavedChanges = hasChanges;
      });
    }
  }

  Future<bool> _confirmDiscardIfNeeded({required bool effectiveReadOnly}) async {
    if (effectiveReadOnly || !_computeHasUnsavedChanges()) return true;

    final shouldLeave =
        await showDialog<bool>(
          context: context,
          builder: (dialogContext) {
            return AlertDialog(
              title: const Text('Du har osparade ändringar'),
              content: const Text(
                'Du har ändrat tidkortet men inte sparat. Vill du lämna utan att spara?',
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(dialogContext).pop(false),
                  child: const Text('Stanna kvar'),
                ),
                FilledButton(
                  onPressed: () => Navigator.of(dialogContext).pop(true),
                  child: const Text('Lämna utan att spara'),
                ),
              ],
            );
          },
        ) ??
        false;

    return shouldLeave;
  }

  Future<void> _initializeTemplate() async {
    if (_controllersInitialized) return;

    String? specialization = widget.specialization;
    String? program;

    if (specialization == null) {
      try {
        final userDoc = await FirebaseFirestore.instance
            .collection('users')
            .doc(widget.studentUid)
            .get();
        specialization = userDoc.data()?['specialization'] as String?;
        program =
            (userDoc.data()?['program'] as String?) ??
            inferProgramFromSpecialization(specialization);
      } catch (e) {
        print('Kunde inte hämta specialisering: $e');
      }
    }

    final customTemplate = await loadTeacherActivityTemplate(
      teacherUid: widget.teacherUid,
      program: program,
      specialization: specialization,
    );

    final defaultTemplate = await loadDefaultActivityTemplate(
      program: program,
      specialization: specialization,
    );

    _activityTemplate =
        customTemplate ??
        defaultTemplate ??
        getActivityTemplate(specialization, program: program);

    for (final g in _activityTemplate!) {
      final group = (g['group'] ?? '').toString();
      for (final item in (g['items'] as List)) {
        final name = item.toString();
        final activityKey = _buildActivityKey(group, name);
        final rowControllers = <String, TextEditingController>{
          for (final day in _days)
            day: TextEditingController()..addListener(_recomputeUnsavedState),
        };
        _controllers[activityKey] = {
          ...rowControllers,
        };
        if (name == 'Övrigt') {
          _commentControllers[activityKey] =
              TextEditingController()..addListener(_recomputeUnsavedState);
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
        if (val != null && val > 0) {
          dayMap[day] = val;
        }
      }
      if (dayMap.isNotEmpty) {
        out[activity] = dayMap;
      }
    }
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

    try {
      String classId = widget.classId ?? '';
      if (classId.isEmpty) {
        final userDoc = await FirebaseFirestore.instance
            .collection('users')
            .doc(widget.studentUid)
            .get();
        classId = userDoc.data()?['classId'] ?? '';
      }

      final builtEntries = _buildEntries();
      final builtComments = _buildComments();
      final resolvedWeekNumber =
          widget.displayWeekNumber ?? _resolveWeekNumberFromWeekStart(widget.weekStart);

      final updatedData = <String, dynamic>{
        'studentUid': widget.studentUid,
        'teacherUid': widget.teacherUid,
        'classId': classId,
        'weekStart': widget.weekStart,
        'weekNumber': resolvedWeekNumber,
        'entries': builtEntries,
        'comments': builtComments,
        'updatedAt': FieldValue.serverTimestamp(),
      };

      final docRef = FirebaseFirestore.instance
          .collection('timesheets')
          .doc(docId);

      final existingDoc = await docRef.get();

      if (existingDoc.exists) {
        await docRef.update(updatedData);
      } else {
        await docRef.set(updatedData);
      }

      _lastSavedEntries = _normalizeEntries(builtEntries);
      _lastSavedComments = _normalizeComments(builtComments);
      final hasUnsavedChanges = _computeHasUnsavedChanges();

      setState(() {
        _msg = 'Sparat ✅';
        _hasUnsavedChanges = hasUnsavedChanges;
      });
    } catch (e) {
      var errorMsg = 'Fel: $e';
      if (e.toString().contains('permission-denied')) {
        errorMsg =
            'Kan inte spara tidkortet just nu. Om problemet kvarstår behöver Firestore-reglerna uppdateras för elevens egna tidkort.';
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
            final comments = (data?['comments'] as Map?)?.cast<String, dynamic>();
            final approved = (data?['approved'] ?? false) as bool;
            final locked = (data?['locked'] ?? false) as bool;
            final effectiveReadOnly = widget.readOnly || approved || locked;

            if (!_hydratedFromFirestore && snap.hasData) {
              _isProgrammaticControllerUpdate = true;
              try {
                if (entries != null) {
                  for (final e in entries.entries) {
                    final activity = e.key;
                    final dayMap =
                        (e.value as Map?)?.cast<String, dynamic>() ?? {};
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
                            (entry) =>
                                _activityItemFromKey(entry.key) == activity,
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
              } finally {
                _isProgrammaticControllerUpdate = false;
              }

              _lastSavedEntries = _normalizeEntries(entries);
              _lastSavedComments = _normalizeComments(comments);
              _hasUnsavedChanges = false;

              _hydratedFromFirestore = true;
            }

            var weekNumber = widget.displayWeekNumber ?? 1;
            if (widget.displayWeekNumber == null) {
              try {
                weekNumber =
                    (data?['weekNumber'] as num?)?.toInt() ??
                    _resolveWeekNumberFromWeekStart(widget.weekStart);
              } catch (_) {}
            }

            final weekHours = _sumWeek();
            final progress = (weekHours / 40).clamp(0.0, 1.0).toDouble();
            final remainingHours = max(0, 40 - weekHours);
            final parsedWeekStart = DateTime.tryParse(widget.weekStart);
            var daysLeft = 0;
            if (parsedWeekStart != null) {
              final nowDate = DateTime.now();
              final today = DateTime(nowDate.year, nowDate.month, nowDate.day);
              final weekEnd = parsedWeekStart.add(const Duration(days: 4));
              daysLeft = (weekEnd.difference(today).inDays + 1).clamp(0, 5);
            }

            return WillPopScope(
              onWillPop: () =>
                  _confirmDiscardIfNeeded(effectiveReadOnly: effectiveReadOnly),
              child: Scaffold(
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
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(24),
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [
                                Color(0xFFFF8A00),
                                Color(0xFFFF6A00),
                                Color(0xFFE65A00),
                              ],
                              stops: [0.0, 0.68, 1.0],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(26),
                            boxShadow: const [
                              BoxShadow(
                                color: Color(0x52FF8A00),
                                blurRadius: 30,
                                offset: Offset(0, 14),
                              ),
                            ],
                          ),
                          child: Stack(
                            children: [
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Denna vecka',
                                    style: TextStyle(
                                      color: Colors.white.withValues(alpha: 0.82),
                                      fontSize: 12,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                  const SizedBox(height: 12),
                                  Row(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              '$weekHours timmar',
                                              style: const TextStyle(
                                                color: Colors.white,
                                                fontSize: 34,
                                                fontWeight: FontWeight.w800,
                                                height: 1.0,
                                              ),
                                            ),
                                            const SizedBox(height: 8),
                                            Text(
                                              approved
                                                  ? 'Godkänd av handledare'
                                                  : 'Fortsätt fylla i veckan',
                                              style: TextStyle(
                                                color: Colors.white.withValues(
                                                  alpha: 0.82,
                                                ),
                                                fontSize: 13,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      const SizedBox(width: 16),
                                      SizedBox(
                                        width: 72,
                                        height: 72,
                                        child: TweenAnimationBuilder<double>(
                                          tween: Tween<double>(
                                            begin: 0,
                                            end: progress,
                                          ),
                                          duration: const Duration(
                                            milliseconds: 700,
                                          ),
                                          builder: (context, animatedValue, _) {
                                            return Stack(
                                              fit: StackFit.expand,
                                              children: [
                                                CircularProgressIndicator(
                                                  value: animatedValue,
                                                  strokeWidth: 6,
                                                  backgroundColor: Colors.white
                                                      .withValues(alpha: 0.22),
                                                  valueColor:
                                                      const AlwaysStoppedAnimation(
                                                        Colors.white,
                                                      ),
                                                ),
                                                Center(
                                                  child: Text(
                                                    '${(progress * 100).round()}%',
                                                    style: const TextStyle(
                                                      color: Colors.white,
                                                      fontSize: 12,
                                                      fontWeight: FontWeight.w700,
                                                    ),
                                                  ),
                                                ),
                                              ],
                                            );
                                          },
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 16),
                                  Text(
                                    remainingHours == 0
                                        ? 'Målet är uppnått denna vecka'
                                        : '$remainingHours timmar kvar till 40 h',
                                    style: TextStyle(
                                      color: Colors.white.withValues(alpha: 0.90),
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    daysLeft > 0
                                        ? '$daysLeft dagar kvar denna vecka'
                                        : 'Veckan är avslutad',
                                    style: TextStyle(
                                      color: Colors.white.withValues(alpha: 0.74),
                                      fontSize: 12,
                                    ),
                                  ),
                                  const SizedBox(height: 12),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 12,
                                      vertical: 8,
                                    ),
                                    decoration: BoxDecoration(
                                      color: Colors.white.withValues(alpha: 0.18),
                                      borderRadius: BorderRadius.circular(999),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(
                                          approved
                                              ? Icons.verified_rounded
                                              : Icons.edit_rounded,
                                          color: Colors.white,
                                          size: 14,
                                        ),
                                        const SizedBox(width: 6),
                                        Text(
                                          approved ? 'Bedömd' : 'Redigerbar',
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 11,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
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
    var sum = 0;
    for (final day in _days) {
      sum += int.tryParse(controllers[day]!.text.trim()) ?? 0;
    }
    return sum;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
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
                          fillColor:
                              readOnly ? Colors.grey.shade100 : Colors.white,
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
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