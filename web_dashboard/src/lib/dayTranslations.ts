export function translateDayToSwedish(dayName: string): string {
  const dayMap: { [key: string]: string } = {
    mon: 'Mån',
    tue: 'Tis',
    wed: 'Ons',
    thu: 'Tor',
    fri: 'Fre',
    sat: 'Lör',
    sun: 'Sön',
    Mon: 'Mån',
    Tue: 'Tis',
    Wed: 'Ons',
    Thu: 'Tor',
    Fri: 'Fre',
    Sat: 'Lör',
    Sun: 'Sön',
    monday: 'Måndag',
    tuesday: 'Tisdag',
    wednesday: 'Onsdag',
    thursday: 'Torsdag',
    friday: 'Fredag',
    saturday: 'Lördag',
    sunday: 'Söndag',
    Monday: 'Måndag',
    Tuesday: 'Tisdag',
    Wednesday: 'Onsdag',
    Thursday: 'Torsdag',
    Friday: 'Fredag',
    Saturday: 'Lördag',
    Sunday: 'Söndag',
  };

  return dayMap[dayName] || dayName;
}
