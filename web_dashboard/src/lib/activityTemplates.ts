type ActivityGroup = {
  group: string;
  items: string[];
};

export const ACTIVITY_KEY_SEPARATOR = '::';

const activityTemplateTrabetare: ActivityGroup[] = [
  { group: 'Formsättning', items: ['Formbyggnad', 'Elementform', 'Demontering'] },
  { group: 'Armering och betong', items: ['Armering', 'Betong'] },
  { group: 'Utvändigt arbete', items: ['Utvändig beklädnad', 'Tak', 'Dörrar & Fönster'] },
  { group: 'Stomme och beklädnad', items: ['Stolpverk', 'Bjälklag'] },
  {
    group: 'Invändigt arbete',
    items: ['Inredning', 'Snickerier', 'Invändig beklädnad', 'Dörrar', 'Golv'],
  },
  { group: 'Isolering', items: ['Värme/ljud/brand', 'Fuktisolering'] },
  { group: 'Reparationer', items: ['Demontering/Rivning', 'Återmontering'] },
  { group: 'Miljö / Övrigt', items: ['Miljö', 'Hjälparbeten', 'Skyddsarbeten', 'Övrigt'] },
];

const activityTemplateMurare: ActivityGroup[] = [
  { group: 'Murning', items: ['Tegel', 'Betongblock', 'Lättbetong'] },
  { group: 'Puts', items: ['Grovputs', 'Finputs', 'Puts övrigt'] },
  { group: 'Övrigt', items: ['Byggnadsställning', 'Hjälparbeten', 'Övrigt'] },
];

const activityTemplateMalare: ActivityGroup[] = [
  { group: 'Invändig målning - Snickerier m.m.', items: ['Underbehandling', 'Målning'] },
  { group: 'Invändig målning - Tak & Väggar', items: ['Underbehandling', 'Målning', 'Tapetsering', 'Vävsättning'] },
  { group: 'Utvändig målning - Trä & mineraliska ytor', items: ['Underbehandling', 'Målning'] },
  { group: 'Utvändig målning - Fönster', items: ['Underbehandling', 'Målning'] },
  { group: 'Övrigt', items: ['Övrigt'] },
];

const activityTemplateAnlaggare: ActivityGroup[] = [
  {
    group: 'Anläggning och vägbyggnad',
    items: [
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
  { group: 'Armering och betong', items: ['Armering', 'Betong'] },
  { group: 'Miljö', items: ['Hjälparbeten', 'Skyddsarbeten'] },
  { group: 'Övrigt', items: ['Övrigt'] },
];

const activityTemplateVVS: ActivityGroup[] = [
  {
    group: 'VVS-installationer',
    items: [
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

const activityTemplatePlatslagare: ActivityGroup[] = [
  {
    group: 'Plåtarbete',
    items: [
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
  { group: 'Övrigt', items: ['Övrigt'] },
  { group: 'Miljö', items: ['Hjälparbeten', 'Skyddsarbeten'] },
];

const activityTemplateDefault: ActivityGroup[] = [
  { group: 'Arbetsuppgifter', items: ['Uppgift 1', 'Uppgift 2', 'Uppgift 3'] },
  { group: 'Övrigt', items: ['Hjälparbeten', 'Övrigt'] },
];

export function getActivityTemplateBySpecialization(specialization?: string): ActivityGroup[] {
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
      return activityTemplateTrabetare;
  }
}

export function parseScopedActivityKey(activityKey: string): { group?: string; item: string } {
  const separatorIndex = activityKey.indexOf(ACTIVITY_KEY_SEPARATOR);

  if (separatorIndex < 0) {
    return { item: activityKey };
  }

  const group = activityKey.slice(0, separatorIndex).trim();
  const item = activityKey
    .slice(separatorIndex + ACTIVITY_KEY_SEPARATOR.length)
    .trim();

  return {
    group: group || undefined,
    item: item || activityKey,
  };
}

export function getActivityItemName(activityKey: string): string {
  return parseScopedActivityKey(activityKey).item;
}

export function getActivityDisplayLabel(activityKey: string): string {
  const parsed = parseScopedActivityKey(activityKey);

  if (parsed.group) {
    return `${parsed.group} - ${parsed.item}`;
  }

  return parsed.item;
}

export function getActivityGroupForItem(specialization: string | undefined, activity: string): string | undefined {
  const parsed = parseScopedActivityKey(activity);

  if (parsed.group) {
    return parsed.group;
  }

  const template = getActivityTemplateBySpecialization(specialization);

  for (const group of template) {
    if (group.items.includes(parsed.item)) {
      return group.group;
    }
  }

  return undefined;
}
