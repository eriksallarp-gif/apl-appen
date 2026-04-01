import 'package:cloud_firestore/cloud_firestore.dart';

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

AssessmentTemplateConfig sanitizeAssessmentTemplateConfig(dynamic raw) {
  final usedSelfKeys = <String>{};
  final selfAssessmentFields = <SelfAssessmentField>[];

  final rawFields = raw is Map ? raw['selfAssessmentFields'] : null;
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

  final usedCriteriaKeys = <String>{};
  final supervisorCriteria = <SupervisorCriterion>[];
  final rawCriteria = raw is Map ? raw['supervisorCriteria'] : null;
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

  return AssessmentTemplateConfig(
    selfAssessmentFields: selfAssessmentFields.isNotEmpty
        ? selfAssessmentFields
        : defaultAssessmentTemplateConfig.selfAssessmentFields,
    supervisorCriteria: supervisorCriteria.isNotEmpty
        ? supervisorCriteria
        : defaultAssessmentTemplateConfig.supervisorCriteria,
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
