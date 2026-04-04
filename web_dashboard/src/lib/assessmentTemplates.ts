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

export interface TeacherAssessmentTemplateOverrides {
  hiddenSelfAssessmentFieldKeys: string[];
  hiddenSupervisorCriteriaKeys: string[];
  selfAssessmentOrderKeys: string[];
  supervisorCriteriaOrderKeys: string[];
  additionalSelfAssessmentFields: SelfAssessmentField[];
  additionalSupervisorCriteria: SupervisorCriterion[];
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

function matchesTemplateKey(first: string, second: string): boolean {
  const normalizedFirst = first.trim();
  const normalizedSecond = second.trim();

  if (!normalizedFirst || !normalizedSecond) return false;

  return (
    normalizedFirst === normalizedSecond ||
    sanitizeKeyPart(normalizedFirst) === sanitizeKeyPart(normalizedSecond)
  );
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

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function sanitizeSelfAssessmentFields(rawFields: unknown): SelfAssessmentField[] {
  const usedSelfKeys = new Set<string>();

  return Array.isArray(rawFields)
    ? rawFields
        .filter(isObjectRecord)
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
}

function sanitizeSupervisorCriteria(rawCriteria: unknown): SupervisorCriterion[] {
  const usedCriteriaKeys = new Set<string>();

  return Array.isArray(rawCriteria)
    ? rawCriteria
        .filter(isObjectRecord)
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
}

function sanitizeOrderKeys(rawKeys: unknown): string[] {
  return Array.isArray(rawKeys)
    ? Array.from(
        new Set(
          rawKeys
            .map((key) => String(key ?? '').trim())
            .filter(Boolean),
        ),
      )
    : [];
}

function orderItemsByKeys<T extends { key: string }>(items: T[], orderKeys: string[]): T[] {
  if (items.length <= 1 || orderKeys.length === 0) return [...items];

  const remaining = [...items];
  const ordered: T[] = [];

  for (const orderKey of orderKeys) {
    const index = remaining.findIndex((item) => matchesTemplateKey(orderKey, item.key));
    if (index === -1) continue;
    ordered.push(remaining.splice(index, 1)[0]);
  }

  ordered.push(...remaining);
  return ordered;
}

export function orderTeacherSelfAssessmentFieldsForView(
  baseSnapshot: AssessmentTemplateSnapshot,
  overrides: TeacherAssessmentTemplateOverrides,
): SelfAssessmentField[] {
  return orderItemsByKeys(
    [
      ...baseSnapshot.selfAssessmentFields,
      ...overrides.additionalSelfAssessmentFields,
    ],
    overrides.selfAssessmentOrderKeys,
  );
}

export function orderTeacherSupervisorCriteriaForView(
  baseSnapshot: AssessmentTemplateSnapshot,
  overrides: TeacherAssessmentTemplateOverrides,
): SupervisorCriterion[] {
  return orderItemsByKeys(
    [
      ...baseSnapshot.supervisorCriteria,
      ...overrides.additionalSupervisorCriteria,
    ],
    overrides.supervisorCriteriaOrderKeys,
  );
}

export function sanitizeAssessmentTemplateSnapshot(
  raw: Partial<AssessmentTemplateSnapshot> | null | undefined,
): AssessmentTemplateSnapshot {
  const selfAssessmentFields = sanitizeSelfAssessmentFields(raw?.selfAssessmentFields);
  const supervisorCriteria = sanitizeSupervisorCriteria(raw?.supervisorCriteria);

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

export function sanitizeTeacherAssessmentTemplateOverrides(
  raw: Partial<TeacherAssessmentTemplateOverrides> | null | undefined,
): TeacherAssessmentTemplateOverrides {
  return {
    hiddenSelfAssessmentFieldKeys: sanitizeOrderKeys(raw?.hiddenSelfAssessmentFieldKeys),
    hiddenSupervisorCriteriaKeys: sanitizeOrderKeys(raw?.hiddenSupervisorCriteriaKeys),
    selfAssessmentOrderKeys: sanitizeOrderKeys(raw?.selfAssessmentOrderKeys),
    supervisorCriteriaOrderKeys: sanitizeOrderKeys(raw?.supervisorCriteriaOrderKeys),
    additionalSelfAssessmentFields: sanitizeSelfAssessmentFields(raw?.additionalSelfAssessmentFields),
    additionalSupervisorCriteria: sanitizeSupervisorCriteria(raw?.additionalSupervisorCriteria),
  };
}

export function mergeAssessmentTemplateSnapshot(
  baseSnapshot: AssessmentTemplateSnapshot,
  overrides: TeacherAssessmentTemplateOverrides,
): AssessmentTemplateSnapshot {
  const hiddenSelfKeys = overrides.hiddenSelfAssessmentFieldKeys.map((key) => key.trim()).filter(Boolean);
  const hiddenSupervisorKeys = overrides.hiddenSupervisorCriteriaKeys.map((key) => key.trim()).filter(Boolean);

  const selfAssessmentFields: SelfAssessmentField[] = [];
  const usedSelfKeys = new Set<string>();

  for (const field of baseSnapshot.selfAssessmentFields) {
    if (hiddenSelfKeys.some((key) => matchesTemplateKey(key, field.key))) continue;
    selfAssessmentFields.push(field);
    usedSelfKeys.add(field.key);
  }

  for (const field of overrides.additionalSelfAssessmentFields) {
    const key = ensureUniqueKey(sanitizeKeyPart(field.key) || 'field', usedSelfKeys);
    selfAssessmentFields.push({
      key,
      label: field.label,
      placeholder: field.placeholder,
      inputType: field.inputType,
    });
  }

  const orderedSelfAssessmentFields = orderItemsByKeys(
    selfAssessmentFields,
    overrides.selfAssessmentOrderKeys,
  );

  const supervisorCriteria: SupervisorCriterion[] = [];
  const usedCriteriaKeys = new Set<string>();

  for (const criterion of baseSnapshot.supervisorCriteria) {
    if (hiddenSupervisorKeys.some((key) => matchesTemplateKey(key, criterion.key))) continue;
    supervisorCriteria.push(criterion);
    usedCriteriaKeys.add(criterion.key);
  }

  for (const criterion of overrides.additionalSupervisorCriteria) {
    const key = ensureUniqueKey(sanitizeKeyPart(criterion.key) || 'criterion', usedCriteriaKeys);
    supervisorCriteria.push({ key, label: criterion.label });
  }

  const orderedSupervisorCriteria = orderItemsByKeys(
    supervisorCriteria,
    overrides.supervisorCriteriaOrderKeys,
  );

  return {
    selfAssessmentFields:
      orderedSelfAssessmentFields.length > 0
        ? orderedSelfAssessmentFields
        : baseSnapshot.selfAssessmentFields,
    supervisorCriteria:
      orderedSupervisorCriteria.length > 0
        ? orderedSupervisorCriteria
        : baseSnapshot.supervisorCriteria,
  };
}

export function hasTeacherAssessmentOverrides(overrides: TeacherAssessmentTemplateOverrides): boolean {
  return (
    overrides.hiddenSelfAssessmentFieldKeys.length > 0 ||
    overrides.hiddenSupervisorCriteriaKeys.length > 0 ||
    overrides.selfAssessmentOrderKeys.length > 0 ||
    overrides.supervisorCriteriaOrderKeys.length > 0 ||
    overrides.additionalSelfAssessmentFields.length > 0 ||
    overrides.additionalSupervisorCriteria.length > 0
  );
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
