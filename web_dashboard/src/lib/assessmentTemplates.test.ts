import { describe, expect, it } from 'vitest';

import {
  defaultAssessmentTemplateSnapshot,
  mergeAssessmentTemplateSnapshot,
  sanitizeTeacherAssessmentTemplateOverrides,
} from './assessmentTemplates';

describe('assessment template merge', () => {
  it('keeps admin template when teacher overrides are empty', () => {
    const overrides = sanitizeTeacherAssessmentTemplateOverrides(null);
    const merged = mergeAssessmentTemplateSnapshot(
      defaultAssessmentTemplateSnapshot,
      overrides,
    );

    expect(merged.selfAssessmentFields.map((field) => field.key)).toEqual(
      defaultAssessmentTemplateSnapshot.selfAssessmentFields.map(
        (field) => field.key,
      ),
    );
    expect(merged.supervisorCriteria.map((criterion) => criterion.key)).toEqual(
      defaultAssessmentTemplateSnapshot.supervisorCriteria.map(
        (criterion) => criterion.key,
      ),
    );
  });

  it('hides selected admin fields and appends teacher additions', () => {
    const overrides = sanitizeTeacherAssessmentTemplateOverrides({
      hiddenSelfAssessmentFieldKeys: ['whatWasPositive'],
      hiddenSupervisorCriteriaKeys: ['initiative'],
      additionalSelfAssessmentFields: [
        {
          key: '',
          label: 'Vad vill du träna mer på?',
          placeholder: 'Beskriv nästa steg',
          inputType: 'text',
        },
      ],
      additionalSupervisorCriteria: [{ key: '', label: 'Yrkesstolthet' }],
    });

    const merged = mergeAssessmentTemplateSnapshot(
      defaultAssessmentTemplateSnapshot,
      overrides,
    );

    expect(
      merged.selfAssessmentFields.some((field) => field.key === 'whatWasPositive'),
    ).toBe(false);
    expect(
      merged.selfAssessmentFields.some(
        (field) => field.label === 'Vad vill du träna mer på?',
      ),
    ).toBe(true);
    expect(
      merged.supervisorCriteria.some((criterion) => criterion.key === 'initiative'),
    ).toBe(false);
    expect(
      merged.supervisorCriteria.some(
        (criterion) => criterion.label === 'Yrkesstolthet',
      ),
    ).toBe(true);
  });

  it('deduplicates teacher-added keys against visible admin fields', () => {
    const overrides = sanitizeTeacherAssessmentTemplateOverrides({
      additionalSelfAssessmentFields: [
        {
          key: 'whatDidYouDo',
          label: 'Vad gjorde du mest av?',
          placeholder: '',
          inputType: 'text',
        },
      ],
    });

    const merged = mergeAssessmentTemplateSnapshot(
      defaultAssessmentTemplateSnapshot,
      overrides,
    );

    const matchingLabels = merged.selfAssessmentFields.filter(
      (field) => field.label === 'Vad gjorde du mest av?',
    );

    expect(matchingLabels).toHaveLength(1);
    expect(matchingLabels[0]?.key).not.toBe('whatDidYouDo');
  });

  it('applies teacher-specific ordering only within the merged template', () => {
    const overrides = sanitizeTeacherAssessmentTemplateOverrides({
      selfAssessmentOrderKeys: ['overallRating', 'whatWasPositive', 'teacher_custom'],
      supervisorCriteriaOrderKeys: ['workQuality', 'initiative', 'teacher_criterion'],
      additionalSelfAssessmentFields: [
        {
          key: 'teacher_custom',
          label: 'Vad vill du utveckla vidare?',
          placeholder: 'Beskriv nästa steg',
          inputType: 'text',
        },
      ],
      additionalSupervisorCriteria: [
        {
          key: 'teacher_criterion',
          label: 'Ansvarstagande',
        },
      ],
    });

    const merged = mergeAssessmentTemplateSnapshot(
      defaultAssessmentTemplateSnapshot,
      overrides,
    );

    expect(merged.selfAssessmentFields.map((field) => field.key)).toEqual([
      'overallRating',
      'whatWasPositive',
      'teacher_custom',
      'whatDidYouDo',
      'whatCouldBeBetter',
      'whatCouldYouDoDifferently',
    ]);

    expect(merged.supervisorCriteria.map((criterion) => criterion.key)).toEqual([
      'workQuality',
      'initiative',
      'teacher_criterion',
      'engagement',
      'collaboration',
      'problemSolving',
    ]);

    expect(defaultAssessmentTemplateSnapshot.selfAssessmentFields.map((field) => field.key)).toEqual([
      'whatDidYouDo',
      'whatWasPositive',
      'whatCouldBeBetter',
      'whatCouldYouDoDifferently',
      'overallRating',
    ]);
  });
});
