export type SelfAssessmentFieldType = 'text' | 'number';

export interface SelfAssessmentField {
  key: string;
  label: string;
  placeholder: string;
  inputType: SelfAssessmentFieldType;
}

export interface SupervisorCriterion {
  key: string;
  label: string;
}

export interface AssessmentTemplateSnapshot {
  selfAssessmentFields: SelfAssessmentField[];
  supervisorCriteria: SupervisorCriterion[];
}

export const defaultAssessmentTemplateSnapshot: AssessmentTemplateSnapshot = {
  selfAssessmentFields: [
    {
      key: 'whatDidYouDo',
      label: 'Vad har du fått göra?',
      placeholder: 'Beskriv de arbetsuppgifter du utförde...',
      inputType: 'text',
    },
    {
      key: 'whatWasPositive',
      label: 'Vad har varit positivt med APLen?',
      placeholder: 'Vad har varit bra? Vad har du lärt dig?',
      inputType: 'text',
    },
    {
      key: 'whatCouldBeBetter',
      label: 'Vad skulle kunnat vara bättre?',
      placeholder: 'Vad var utmanande? Vad skulle kunna förbättras?',
      inputType: 'text',
    },
    {
      key: 'whatCouldYouDoDifferently',
      label: 'Vad kunde du som elev gjort annorlunda?',
      placeholder: 'Hur kunde du bidragit mer? Vad kan du förbättra till nästa gång?',
      inputType: 'text',
    },
    {
      key: 'overallRating',
      label: 'Vilket betyg för din APL-period? (1-10)',
      placeholder: '1=mindre bra, 10=fantastiskt',
      inputType: 'number',
    },
  ],
  supervisorCriteria: [
    { key: 'engagement', label: 'Engagemang' },
    { key: 'initiative', label: 'Initiativtagande' },
    { key: 'collaboration', label: 'Samarbetsförmåga' },
    { key: 'problemSolving', label: 'Problemlösning' },
    { key: 'workQuality', label: 'Kvalitet på arbete' },
  ],
};

function sanitizeKeyPart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function ensureUniqueKey(baseKey: string, usedKeys: Set<string>): string {
  let nextKey = baseKey || 'field';
  let suffix = 2;
  while (usedKeys.has(nextKey)) {
    nextKey = `${baseKey || 'field'}_${suffix}`;
    suffix += 1;
  }
  usedKeys.add(nextKey);
  return nextKey;
}

export function createAssessmentFieldKey(label: string, existingKeys: string[]): string {
  const usedKeys = new Set(existingKeys);
  const baseKey = sanitizeKeyPart(label) || 'field';
  return ensureUniqueKey(baseKey, usedKeys);
}

export function sanitizeAssessmentTemplateSnapshot(
  raw: Partial<AssessmentTemplateSnapshot> | null | undefined,
): AssessmentTemplateSnapshot {
  const usedSelfKeys = new Set<string>();
  const selfAssessmentFields = Array.isArray(raw?.selfAssessmentFields)
    ? raw.selfAssessmentFields
        .filter((field): field is Partial<SelfAssessmentField> => !!field && typeof field === 'object')
        .map((field) => {
          const label = String(field.label ?? '').trim();
          if (!label) return null;

          const requestedKey = sanitizeKeyPart(String(field.key ?? '').trim()) || sanitizeKeyPart(label);
          const key = ensureUniqueKey(requestedKey || 'field', usedSelfKeys);
          const inputType = field.inputType === 'number' ? 'number' : 'text';

          return {
            key,
            label,
            placeholder: String(field.placeholder ?? '').trim(),
            inputType,
          } satisfies SelfAssessmentField;
        })
        .filter((field): field is SelfAssessmentField => field !== null)
    : [];

  const usedCriteriaKeys = new Set<string>();
  const supervisorCriteria = Array.isArray(raw?.supervisorCriteria)
    ? raw.supervisorCriteria
        .filter((criterion): criterion is Partial<SupervisorCriterion> => !!criterion && typeof criterion === 'object')
        .map((criterion) => {
          const label = String(criterion.label ?? '').trim();
          if (!label) return null;

          const requestedKey = sanitizeKeyPart(String(criterion.key ?? '').trim()) || sanitizeKeyPart(label);
          const key = ensureUniqueKey(requestedKey || 'criterion', usedCriteriaKeys);

          return {
            key,
            label,
          } satisfies SupervisorCriterion;
        })
        .filter((criterion): criterion is SupervisorCriterion => criterion !== null)
    : [];

  return {
    selfAssessmentFields:
      selfAssessmentFields.length > 0
        ? selfAssessmentFields
        : defaultAssessmentTemplateSnapshot.selfAssessmentFields,
    supervisorCriteria:
      supervisorCriteria.length > 0
        ? supervisorCriteria
        : defaultAssessmentTemplateSnapshot.supervisorCriteria,
  };
}

export function getSelfAssessmentLabel(
  snapshot: AssessmentTemplateSnapshot | null | undefined,
  key: string,
): string {
  return (
    snapshot?.selfAssessmentFields.find((field) => field.key === key)?.label ??
    defaultAssessmentTemplateSnapshot.selfAssessmentFields.find((field) => field.key === key)?.label ??
    key
  );
}

export function getAssessmentCriterionLabel(
  snapshot: AssessmentTemplateSnapshot | null | undefined,
  key: string,
  value?: { label?: string } | null,
): string {
  return (
    value?.label?.trim() ||
    snapshot?.supervisorCriteria.find((criterion) => criterion.key === key)?.label ||
    defaultAssessmentTemplateSnapshot.supervisorCriteria.find((criterion) => criterion.key === key)?.label ||
    key
  );
}
