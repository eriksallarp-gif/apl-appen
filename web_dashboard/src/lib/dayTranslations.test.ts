import { describe, expect, it } from 'vitest';
import { translateDayToSwedish } from './dayTranslations';

describe('translateDayToSwedish', () => {
  it('translates short English weekday keys', () => {
    expect(translateDayToSwedish('mon')).toBe('Mån');
    expect(translateDayToSwedish('tue')).toBe('Tis');
    expect(translateDayToSwedish('wed')).toBe('Ons');
    expect(translateDayToSwedish('thu')).toBe('Tor');
    expect(translateDayToSwedish('fri')).toBe('Fre');
  });

  it('translates full English weekday names', () => {
    expect(translateDayToSwedish('monday')).toBe('Måndag');
    expect(translateDayToSwedish('friday')).toBe('Fredag');
    expect(translateDayToSwedish('Sunday')).toBe('Söndag');
  });

  it('returns original value for unknown keys', () => {
    expect(translateDayToSwedish('ovrigt')).toBe('ovrigt');
  });
});
