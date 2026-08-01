import 'package:cloud_firestore/cloud_firestore.dart';

const _teacherAssessmentTemplatesCollection = 'teacherAssessmentTemplates';

class SelfAssessmentField {
  final String key;
  final String label;
  final String placeholder;
  final String inputType;

  const SelfAssessmentField({
    required this.key,
    required this.label,
    this.placeholder = '',
    this.inputType = 'text',
  });

  Map<String, dynamic> toJson() => {
    'key': key,
    'label': label,
    'placeholder': placeholder,
    'inputType': inputType,
  };
}

class SupervisorCriterion {
  final String key;
  final String label;

  const SupervisorCriterion({required this.key, required this.label});

  Map<String, dynamic> toJson() => {'key': key, 'label': label};
}

class AssessmentTemplateConfig {
  final List<SelfAssessmentField> selfAssessmentFields;
  final List<SupervisorCriterion> supervisorCriteria;

  const AssessmentTemplateConfig({
    required this.selfAssessmentFields,
    required this.supervisorCriteria,
  });

  Map<String, dynamic> toJson() => {
    'selfAssessmentFields': selfAssessmentFields
        .map((field) => field.toJson())
        .toList(),
    'supervisorCriteria': supervisorCriteria
        .map((criterion) => criterion.toJson())
        .toList(),
  };
}

class TeacherAssessmentTemplateOverrides {
  final List<String> hiddenSelfAssessmentFieldKeys;
  final List<String> hiddenSupervisorCriteriaKeys;
  final List<String> selfAssessmentOrderKeys;
  final List<String> supervisorCriteriaOrderKeys;
  final List<SelfAssessmentField> additionalSelfAssessmentFields;
  final List<SupervisorCriterion> additionalSupervisorCriteria;

  const TeacherAssessmentTemplateOverrides({
    this.hiddenSelfAssessmentFieldKeys = const [],
    this.hiddenSupervisorCriteriaKeys = const [],
    this.selfAssessmentOrderKeys = const [],
    this.supervisorCriteriaOrderKeys = const [],
    this.additionalSelfAssessmentFields = const [],
    this.additionalSupervisorCriteria = const [],
  });

  bool get isEmpty =>
      hiddenSelfAssessmentFieldKeys.isEmpty &&
      hiddenSupervisorCriteriaKeys.isEmpty &&
      selfAssessmentOrderKeys.isEmpty &&
      supervisorCriteriaOrderKeys.isEmpty &&
      additionalSelfAssessmentFields.isEmpty &&
      additionalSupervisorCriteria.isEmpty;

  Map<String, dynamic> toJson() => {
    'hiddenSelfAssessmentFieldKeys': hiddenSelfAssessmentFieldKeys,
    'hiddenSupervisorCriteriaKeys': hiddenSupervisorCriteriaKeys,
    'selfAssessmentOrderKeys': selfAssessmentOrderKeys,
    'supervisorCriteriaOrderKeys': supervisorCriteriaOrderKeys,
    'additionalSelfAssessmentFields': additionalSelfAssessmentFields
        .map((field) => field.toJson())
        .toList(),
    'additionalSupervisorCriteria': additionalSupervisorCriteria
        .map((criterion) => criterion.toJson())
        .toList(),
  };
}

const defaultAssessmentTemplateConfig = AssessmentTemplateConfig(
  selfAssessmentFields: [
    SelfAssessmentField(
      key: 'whatDidYouDo',
      label: 'Vad har du fått göra?',
      placeholder: 'Beskriv de arbetsuppgifter du utförde...',
    ),
    SelfAssessmentField(
      key: 'whatWasPositive',
      label: 'Vad har varit positivt med APLen?',
      placeholder: 'Vad har varit bra? Vad har du lärt dig?',
    ),
    SelfAssessmentField(
      key: 'whatCouldBeBetter',
      label: 'Vad skulle kunnat vara bättre?',
      placeholder: 'Vad var utmanande? Vad skulle kunna förbättras?',
    ),
    SelfAssessmentField(
      key: 'whatCouldYouDoDifferently',
      label: 'Vad kunde du som elev gjort annorlunda?',
      placeholder:
          'Hur kunde du bidragit mer? Vad kan du förbättra till nästa gång?',
    ),
    SelfAssessmentField(
      key: 'overallRating',
      label: 'Vilket betyg för din APL-period? (1-10)',
      placeholder: '1=mindre bra, 10=fantastiskt',
      inputType: 'number',
    ),
  ],
  supervisorCriteria: [
    SupervisorCriterion(key: 'engagement', label: 'Engagemang'),
    SupervisorCriterion(key: 'initiative', label: 'Initiativtagande'),
    SupervisorCriterion(key: 'collaboration', label: 'Samarbetsförmåga'),
    SupervisorCriterion(key: 'problemSolving', label: 'Problemlösning'),
    SupervisorCriterion(key: 'workQuality', label: 'Kvalitet på arbete'),
  ],
);

String _sanitizeKeyPart(String value) {
  final normalized = value
      .toLowerCase()
      .replaceAll(RegExp(r'[åä]'), 'a')
      .replaceAll('ö', 'o')
      .replaceAll(RegExp(r'[^a-z0-9]+'), '_')
      .replaceAll(RegExp(r'^_+|_+$'), '');
  return normalized;
}

bool _matchesTemplateKey(String first, String second) {
  final normalizedFirst = first.trim();
  final normalizedSecond = second.trim();
  if (normalizedFirst.isEmpty || normalizedSecond.isEmpty) {
    return false;
  }

  return normalizedFirst == normalizedSecond ||
      _sanitizeKeyPart(normalizedFirst) == _sanitizeKeyPart(normalizedSecond);
}

String _ensureUniqueKey(String baseKey, Set<String> usedKeys, String fallback) {
  var key = baseKey.isNotEmpty ? baseKey : fallback;
  var suffix = 2;
  while (usedKeys.contains(key)) {
    key = '${baseKey.isNotEmpty ? baseKey : fallback}_$suffix';
    suffix += 1;
  }
  usedKeys.add(key);
  return key;
}

List<SelfAssessmentField> _sanitizeSelfAssessmentFields(dynamic rawFields) {
  final usedSelfKeys = <String>{};
  final selfAssessmentFields = <SelfAssessmentField>[];

  if (rawFields is List) {
    for (final entry in rawFields.whereType<Map>()) {
      final label = (entry['label'] ?? '').toString().trim();
      if (label.isEmpty) continue;

      final requestedKey = _sanitizeKeyPart(
        (entry['key'] ?? '').toString().trim(),
      );
      final key = _ensureUniqueKey(
        requestedKey.isNotEmpty ? requestedKey : _sanitizeKeyPart(label),
        usedSelfKeys,
        'field',
      );

      selfAssessmentFields.add(
        SelfAssessmentField(
          key: key,
          label: label,
          placeholder: (entry['placeholder'] ?? '').toString().trim(),
          inputType: (entry['inputType'] ?? 'text').toString() == 'number'
              ? 'number'
              : 'text',
        ),
      );
    }
  }

  return selfAssessmentFields;
}

List<SupervisorCriterion> _sanitizeSupervisorCriteria(dynamic rawCriteria) {
  final usedCriteriaKeys = <String>{};
  final supervisorCriteria = <SupervisorCriterion>[];

  if (rawCriteria is List) {
    for (final entry in rawCriteria.whereType<Map>()) {
      final label = (entry['label'] ?? '').toString().trim();
      if (label.isEmpty) continue;

      final requestedKey = _sanitizeKeyPart(
        (entry['key'] ?? '').toString().trim(),
      );
      final key = _ensureUniqueKey(
        requestedKey.isNotEmpty ? requestedKey : _sanitizeKeyPart(label),
        usedCriteriaKeys,
        'criterion',
      );

      supervisorCriteria.add(SupervisorCriterion(key: key, label: label));
    }
  }

  return supervisorCriteria;
}

List<String> _sanitizeOrderKeys(dynamic rawKeys) {
  if (rawKeys is! List) return const <String>[];

  return rawKeys
      .map((value) => value.toString().trim())
      .where((value) => value.isNotEmpty)
      .toSet()
      .toList();
}

List<SelfAssessmentField> _orderSelfAssessmentFields(
  List<SelfAssessmentField> items,
  List<String> orderKeys,
) {
  if (items.length <= 1 || orderKeys.isEmpty) {
    return List<SelfAssessmentField>.from(items);
  }

  final remaining = List<SelfAssessmentField>.from(items);
  final ordered = <SelfAssessmentField>[];

  for (final orderKey in orderKeys) {
    final index = remaining.indexWhere(
      (field) => _matchesTemplateKey(orderKey, field.key),
    );
    if (index == -1) continue;
    ordered.add(remaining.removeAt(index));
  }

  ordered.addAll(remaining);
  return ordered;
}

List<SupervisorCriterion> _orderSupervisorCriteria(
  List<SupervisorCriterion> items,
  List<String> orderKeys,
) {
  if (items.length <= 1 || orderKeys.isEmpty) {
    return List<SupervisorCriterion>.from(items);
  }

  final remaining = List<SupervisorCriterion>.from(items);
  final ordered = <SupervisorCriterion>[];

  for (final orderKey in orderKeys) {
    final index = remaining.indexWhere(
      (criterion) => _matchesTemplateKey(orderKey, criterion.key),
    );
    if (index == -1) continue;
    ordered.add(remaining.removeAt(index));
  }

  ordered.addAll(remaining);
  return ordered;
}

AssessmentTemplateConfig sanitizeAssessmentTemplateConfig(dynamic raw) {
  final selfAssessmentFields = _sanitizeSelfAssessmentFields(
    raw is Map ? raw['selfAssessmentFields'] : null,
  );
  final supervisorCriteria = _sanitizeSupervisorCriteria(
    raw is Map ? raw['supervisorCriteria'] : null,
  );

  return AssessmentTemplateConfig(
    selfAssessmentFields: selfAssessmentFields.isNotEmpty
        ? selfAssessmentFields
        : defaultAssessmentTemplateConfig.selfAssessmentFields,
    supervisorCriteria: supervisorCriteria.isNotEmpty
        ? supervisorCriteria
        : defaultAssessmentTemplateConfig.supervisorCriteria,
  );
}

TeacherAssessmentTemplateOverrides sanitizeTeacherAssessmentTemplateOverrides(
  dynamic raw,
) {
  final hiddenSelfAssessmentFieldKeys =
      raw is Map && raw['hiddenSelfAssessmentFieldKeys'] is List
      ? (raw['hiddenSelfAssessmentFieldKeys'] as List)
            .map((value) => value.toString().trim())
            .where((value) => value.isNotEmpty)
            .toSet()
            .toList()
      : <String>[];

  final hiddenSupervisorCriteriaKeys =
      raw is Map && raw['hiddenSupervisorCriteriaKeys'] is List
      ? (raw['hiddenSupervisorCriteriaKeys'] as List)
            .map((value) => value.toString().trim())
            .where((value) => value.isNotEmpty)
            .toSet()
            .toList()
      : <String>[];

  return TeacherAssessmentTemplateOverrides(
    hiddenSelfAssessmentFieldKeys: hiddenSelfAssessmentFieldKeys,
    hiddenSupervisorCriteriaKeys: hiddenSupervisorCriteriaKeys,
    selfAssessmentOrderKeys: _sanitizeOrderKeys(
      raw is Map ? raw['selfAssessmentOrderKeys'] : null,
    ),
    supervisorCriteriaOrderKeys: _sanitizeOrderKeys(
      raw is Map ? raw['supervisorCriteriaOrderKeys'] : null,
    ),
    additionalSelfAssessmentFields: _sanitizeSelfAssessmentFields(
      raw is Map ? raw['additionalSelfAssessmentFields'] : null,
    ),
    additionalSupervisorCriteria: _sanitizeSupervisorCriteria(
      raw is Map ? raw['additionalSupervisorCriteria'] : null,
    ),
  );
}

AssessmentTemplateConfig mergeAssessmentTemplateConfig(
  AssessmentTemplateConfig baseConfig,
  TeacherAssessmentTemplateOverrides overrides,
) {
  final hiddenSelfKeys = overrides.hiddenSelfAssessmentFieldKeys
      .map((key) => key.trim())
      .where((key) => key.isNotEmpty)
      .toList();
  final hiddenSupervisorKeys = overrides.hiddenSupervisorCriteriaKeys
      .map((key) => key.trim())
      .where((key) => key.isNotEmpty)
      .toList();

  final selfAssessmentFields = <SelfAssessmentField>[];
  final usedSelfKeys = <String>{};

  for (final field in baseConfig.selfAssessmentFields) {
    if (hiddenSelfKeys.any((key) => _matchesTemplateKey(key, field.key))) {
      continue;
    }
    selfAssessmentFields.add(field);
    usedSelfKeys.add(field.key);
  }

  for (final field in overrides.additionalSelfAssessmentFields) {
    final mergedKey = _ensureUniqueKey(
      _sanitizeKeyPart(field.key),
      usedSelfKeys,
      'field',
    );
    selfAssessmentFields.add(
      SelfAssessmentField(
        key: mergedKey,
        label: field.label,
        placeholder: field.placeholder,
        inputType: field.inputType,
      ),
    );
  }

  final orderedSelfAssessmentFields = _orderSelfAssessmentFields(
    selfAssessmentFields,
    overrides.selfAssessmentOrderKeys,
  );

  final supervisorCriteria = <SupervisorCriterion>[];
  final usedSupervisorKeys = <String>{};

  for (final criterion in baseConfig.supervisorCriteria) {
    if (hiddenSupervisorKeys.any(
      (key) => _matchesTemplateKey(key, criterion.key),
    )) {
      continue;
    }
    supervisorCriteria.add(criterion);
    usedSupervisorKeys.add(criterion.key);
  }

  for (final criterion in overrides.additionalSupervisorCriteria) {
    final mergedKey = _ensureUniqueKey(
      _sanitizeKeyPart(criterion.key),
      usedSupervisorKeys,
      'criterion',
    );
    supervisorCriteria.add(
      SupervisorCriterion(key: mergedKey, label: criterion.label),
    );
  }

  final orderedSupervisorCriteria = _orderSupervisorCriteria(
    supervisorCriteria,
    overrides.supervisorCriteriaOrderKeys,
  );

  return AssessmentTemplateConfig(
    selfAssessmentFields: orderedSelfAssessmentFields.isNotEmpty
        ? orderedSelfAssessmentFields
        : baseConfig.selfAssessmentFields,
    supervisorCriteria: orderedSupervisorCriteria.isNotEmpty
        ? orderedSupervisorCriteria
        : baseConfig.supervisorCriteria,
  );
}

Future<AssessmentTemplateConfig> loadAssessmentTemplateConfig() async {
  try {
    final doc = await FirebaseFirestore.instance
        .collection('appSettings')
        .doc('assessmentTemplates')
        .get();

    if (!doc.exists) return defaultAssessmentTemplateConfig;

    return sanitizeAssessmentTemplateConfig(doc.data());
  } catch (_) {
    return defaultAssessmentTemplateConfig;
  }
}

Future<TeacherAssessmentTemplateOverrides>
loadTeacherAssessmentTemplateOverrides({required String teacherUid}) async {
  if (teacherUid.trim().isEmpty) {
    return const TeacherAssessmentTemplateOverrides();
  }

  try {
    final doc = await FirebaseFirestore.instance
        .collection(_teacherAssessmentTemplatesCollection)
        .doc(teacherUid)
        .get();

    if (!doc.exists) {
      return const TeacherAssessmentTemplateOverrides();
    }

    return sanitizeTeacherAssessmentTemplateOverrides(doc.data());
  } catch (_) {
    return const TeacherAssessmentTemplateOverrides();
  }
}

Future<AssessmentTemplateConfig> loadMergedAssessmentTemplateConfig({
  required String teacherUid,
}) async {
  final baseConfig = await loadAssessmentTemplateConfig();
  if (teacherUid.trim().isEmpty) return baseConfig;

  final overrides = await loadTeacherAssessmentTemplateOverrides(
    teacherUid: teacherUid,
  );
  return mergeAssessmentTemplateConfig(baseConfig, overrides);
}

Future<AssessmentTemplateConfig> loadAssessmentTemplateConfigForStudent(
  String studentUid,
) async {
  try {
    final userDoc = await FirebaseFirestore.instance
        .collection('users')
        .doc(studentUid)
        .get();
    final teacherUid = (userDoc.data()?['teacherUid'] ?? '').toString().trim();
    return loadMergedAssessmentTemplateConfig(teacherUid: teacherUid);
  } catch (_) {
    return loadAssessmentTemplateConfig();
  }
}

String getSelfAssessmentLabel(AssessmentTemplateConfig? config, String key) {
  final source = config ?? defaultAssessmentTemplateConfig;
  for (final field in source.selfAssessmentFields) {
    if (field.key == key) return field.label;
  }
  for (final field in defaultAssessmentTemplateConfig.selfAssessmentFields) {
    if (field.key == key) return field.label;
  }
  return key;
}

String getAssessmentCriterionLabel(
  AssessmentTemplateConfig? config,
  String key,
  Map<dynamic, dynamic>? value,
) {
  final explicitLabel = (value?['label'] ?? '').toString().trim();
  if (explicitLabel.isNotEmpty) return explicitLabel;

  final source = config ?? defaultAssessmentTemplateConfig;
  for (final criterion in source.supervisorCriteria) {
    if (criterion.key == key) return criterion.label;
  }
  for (final criterion in defaultAssessmentTemplateConfig.supervisorCriteria) {
    if (criterion.key == key) return criterion.label;
  }
  return key;
}
