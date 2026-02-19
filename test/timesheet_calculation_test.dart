import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Tidkort-beräkningar', () {
    test('Räknar totala timmar korrekt för en vecka', () {
      final entries = {
        'mon': {'Formbyggnad': '8', 'Armering': '2'},
        'tue': {'Formbyggnad': '7', 'Betong': '3'},
        'wed': {'Formbyggnad': '8'},
        'thu': {'Armering': '6', 'Betong': '2'},
        'fri': {'Formbyggnad': '8'},
      };

      int totalHours = 0;
      entries.forEach((day, activities) {
        activities.forEach((activity, hours) {
          totalHours += int.tryParse(hours) ?? 0;
        });
      });

      expect(totalHours, 44);
    });

    test('Hanterar tomma tidkort korrekt', () {
      final entries = <String, Map<String, String>>{};

      int totalHours = 0;
      entries.forEach((day, activities) {
        activities.forEach((activity, hours) {
          totalHours += int.tryParse(hours) ?? 0;
        });
      });

      expect(totalHours, 0);
    });

    test('Hanterar ogiltiga timmar korrekt', () {
      final entries = {
        'mon': {'Formbyggnad': '8', 'Armering': 'abc'},
        'tue': {'Formbyggnad': '', 'Betong': '5'},
        'wed': {'Formbyggnad': '-3'},
      };

      int totalHours = 0;
      entries.forEach((day, activities) {
        activities.forEach((activity, hours) {
          final parsed = int.tryParse(hours) ?? 0;
          // I riktig kod skulle vi validera att timmar inte är negativa
          totalHours += parsed.abs();
        });
      });

      expect(totalHours, 16); // 8 + 0 + 5 + 3
    });

    test('Räknar timmar per dag korrekt', () {
      final entries = {
        'mon': {'Formbyggnad': '8', 'Armering': '2'},
        'tue': {'Formbyggnad': '7', 'Betong': '3'},
      };

      final hoursPerDay = <String, int>{};
      entries.forEach((day, activities) {
        int dayTotal = 0;
        activities.forEach((activity, hours) {
          dayTotal += int.tryParse(hours) ?? 0;
        });
        hoursPerDay[day] = dayTotal;
      });

      expect(hoursPerDay['mon'], 10);
      expect(hoursPerDay['tue'], 10);
    });

    test('Räknar timmar per aktivitet korrekt', () {
      final entries = {
        'mon': {'Formbyggnad': '8', 'Armering': '2'},
        'tue': {'Formbyggnad': '7', 'Betong': '3'},
        'wed': {'Formbyggnad': '8'},
      };

      final hoursPerActivity = <String, int>{};
      entries.forEach((day, activities) {
        activities.forEach((activity, hours) {
          final h = int.tryParse(hours) ?? 0;
          hoursPerActivity[activity] = (hoursPerActivity[activity] ?? 0) + h;
        });
      });

      expect(hoursPerActivity['Formbyggnad'], 23);
      expect(hoursPerActivity['Armering'], 2);
      expect(hoursPerActivity['Betong'], 3);
    });

    test('Validerar att arbetstimmar är rimliga', () {
      // Max 24 timmar per dag
      final validHours = ['0', '1', '8', '12', '16', '24'];
      final invalidHours = ['-1', '25', '100'];

      for (final hours in validHours) {
        final parsed = int.tryParse(hours) ?? -1;
        expect(parsed >= 0 && parsed <= 24, true,
            reason: '$hours bör vara giltigt');
      }

      for (final hours in invalidHours) {
        final parsed = int.tryParse(hours) ?? -1;
        final isValid = parsed >= 0 && parsed <= 24;
        if (hours == '-1') {
          expect(isValid, false, reason: '$hours bör vara ogiltigt');
        } else if (hours == '25' || hours == '100') {
          expect(isValid, false, reason: '$hours bör vara ogiltigt');
        }
      }
    });
  });

  group('Vecko-beräkningar', () {
    test('Beräknar ISO veckonummer korrekt', () {
      // 2026-01-01 är en torsdag, vilket är vecka 1
      final date1 = DateTime(2026, 1, 1);
      final week1 = getISOWeekNumber(date1);
      expect(week1, 1);

      // 2026-01-05 är en måndag, vilket är vecka 2
      final date2 = DateTime(2026, 1, 5);
      final week2 = getISOWeekNumber(date2);
      expect(week2, 2);

      // 2026-02-10 är en tisdag
      final date3 = DateTime(2026, 2, 10);
      final week3 = getISOWeekNumber(date3);
      expect(week3, 7);
    });

    test('Hittar måndag för en given vecka', () {
      final date = DateTime(2026, 2, 10); // Tisdag
      final monday = getMondayOfWeek(date);
      
      expect(monday.weekday, DateTime.monday);
      expect(monday.year, 2026);
      expect(monday.month, 2);
      expect(monday.day, 9); // Måndag 9 februari
    });

    test('Måndag returnerar sig själv som måndag', () {
      final monday = DateTime(2026, 2, 9); // Måndag
      final result = getMondayOfWeek(monday);
      
      expect(result.day, monday.day);
      expect(result.month, monday.month);
      expect(result.year, monday.year);
    });

    test('Söndag returnerar föregående måndag', () {
      final sunday = DateTime(2026, 2, 15); // Söndag
      final monday = getMondayOfWeek(sunday);
      
      expect(monday.weekday, DateTime.monday);
      expect(monday.day, 9); // Måndag 9 februari (vecka tidigare)
    });
  });

  group('Godkännande-logik', () {
    test('Tidkort är inte godkänt som standard', () {
      final timesheet = {'approved': false};
      expect(timesheet['approved'], false);
    });

    test('Godkänt tidkort kan inte återställas av elev (simulerat)', () {
      // Detta skulle normalt testas med Firebase security rules
      final timesheet = {
        'approved': true,
        'studentUid': 'student123',
      };

      // Simulera att ett godkänt tidkort inte kan ändras
      final canEdit = !(timesheet['approved'] as bool);
      expect(canEdit, false);
    });

    test('Ogodkänt tidkort kan redigeras av elev', () {
      final timesheet = {
        'approved': false,
        'studentUid': 'student123',
      };

      final canEdit = !(timesheet['approved'] as bool);
      expect(canEdit, true);
    });
  });
}

// Hjälpfunktioner för veckoberäkningar
int getISOWeekNumber(DateTime date) {
  final d = DateTime(date.year, date.month, date.day);
  final thursday = d.add(Duration(days: 4 - (d.weekday == 7 ? 7 : d.weekday)));
  final firstThursday = DateTime(thursday.year, 1, 4);
  final firstThursdayAdjusted = firstThursday.add(
    Duration(
      days: 4 - (firstThursday.weekday == 7 ? 7 : firstThursday.weekday),
    ),
  );
  final week = 1 + ((thursday.difference(firstThursdayAdjusted).inDays) ~/ 7);
  return week;
}

DateTime getMondayOfWeek(DateTime date) {
  final normalized = DateTime(date.year, date.month, date.day);
  return normalized.subtract(
    Duration(days: normalized.weekday - DateTime.monday),
  );
}
