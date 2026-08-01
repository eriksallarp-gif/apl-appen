import 'package:apl_appen/core/assessment_templates.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Assessment template merge', () {
    test('keeps admin template when teacher overrides are empty', () {
      const overrides = TeacherAssessmentTemplateOverrides();

      final merged = mergeAssessmentTemplateConfig(
        defaultAssessmentTemplateConfig,
        overrides,
      );

      expect(
        merged.selfAssessmentFields.map((field) => field.key),
        defaultAssessmentTemplateConfig.selfAssessmentFields.map(
          (field) => field.key,
        ),
      );
      expect(
        merged.supervisorCriteria.map((criterion) => criterion.key),
        defaultAssessmentTemplateConfig.supervisorCriteria.map(
          (criterion) => criterion.key,
        ),
      );
    });

    test('hides selected admin fields and appends teacher additions', () {
      final overrides = sanitizeTeacherAssessmentTemplateOverrides({
        'hiddenSelfAssessmentFieldKeys': ['whatWasPositive'],
        'hiddenSupervisorCriteriaKeys': ['initiative'],
        'additionalSelfAssessmentFields': [
          {
            'label': 'Vad vill du träna mer på?',
            'placeholder': 'Beskriv nästa steg',
            'inputType': 'text',
          },
        ],
        'additionalSupervisorCriteria': [
          {'label': 'Yrkesstolthet'},
        ],
      });

      final merged = mergeAssessmentTemplateConfig(
        defaultAssessmentTemplateConfig,
        overrides,
      );

      expect(
        merged.selfAssessmentFields.any(
          (field) => field.key == 'whatWasPositive',
        ),
        isFalse,
      );
      expect(
        merged.selfAssessmentFields.any(
          (field) => field.label == 'Vad vill du träna mer på?',
        ),
        isTrue,
      );
      expect(
        merged.supervisorCriteria.any(
          (criterion) => criterion.key == 'initiative',
        ),
        isFalse,
      );
      expect(
        merged.supervisorCriteria.any(
          (criterion) => criterion.label == 'Yrkesstolthet',
        ),
        isTrue,
      );
    });

    test('deduplicates teacher-added keys against visible admin fields', () {
      final overrides = sanitizeTeacherAssessmentTemplateOverrides({
        'additionalSelfAssessmentFields': [
          {
            'key': 'whatDidYouDo',
            'label': 'Vad gjorde du mest av?',
            'placeholder': '',
            'inputType': 'text',
          },
        ],
      });

      final merged = mergeAssessmentTemplateConfig(
        defaultAssessmentTemplateConfig,
        overrides,
      );

      final matchingLabels = merged.selfAssessmentFields
          .where((field) => field.label == 'Vad gjorde du mest av?')
          .toList();

      expect(matchingLabels, hasLength(1));
      expect(matchingLabels.single.key, isNot('whatDidYouDo'));
    });

    test('applies teacher-specific ordering only within the merged template', () {
      final overrides = sanitizeTeacherAssessmentTemplateOverrides({
        'selfAssessmentOrderKeys': [
          'overallRating',
          'whatWasPositive',
          'teacher_custom',
        ],
        'supervisorCriteriaOrderKeys': [
          'workQuality',
          'initiative',
          'teacher_criterion',
        ],
        'additionalSelfAssessmentFields': [
          {
            'key': 'teacher_custom',
            'label': 'Vad vill du utveckla vidare?',
            'placeholder': 'Beskriv nästa steg',
            'inputType': 'text',
          },
        ],
        'additionalSupervisorCriteria': [
          {
            'key': 'teacher_criterion',
            'label': 'Ansvarstagande',
          },
        ],
      });

      final merged = mergeAssessmentTemplateConfig(
        defaultAssessmentTemplateConfig,
        overrides,
      );

      expect(
        merged.selfAssessmentFields.map((field) => field.key),
        [
          'overallRating',
          'whatWasPositive',
          'teacher_custom',
          'whatDidYouDo',
          'whatCouldBeBetter',
          'whatCouldYouDoDifferently',
        ],
      );

      expect(
        merged.supervisorCriteria.map((criterion) => criterion.key),
        [
          'workQuality',
          'initiative',
          'teacher_criterion',
          'engagement',
          'collaboration',
          'problemSolving',
        ],
      );

      expect(
        defaultAssessmentTemplateConfig.selfAssessmentFields.map(
          (field) => field.key,
        ),
        [
          'whatDidYouDo',
          'whatWasPositive',
          'whatCouldBeBetter',
          'whatCouldYouDoDifferently',
          'overallRating',
        ],
      );
    });
  });
}
