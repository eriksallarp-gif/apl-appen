import 'package:flutter_test/flutter_test.dart';
import 'package:apl_appen/main.dart';

void main() {
  group('Activity Template validering', () {
    test('activityTemplate är inte tom', () {
      expect(activityTemplate, isNotEmpty);
    });

    test('activityTemplate har alla nödvändiga grupper', () {
      final expectedGroups = [
        'Formsättning',
        'Armering och betong',
        'Utvändigt arbete',
        'Stomme och beklädnad',
        'Invändigt arbete',
        'Isolering',
        'Reparationer',
        'Miljö / Övrigt',
      ];

      final actualGroups = activityTemplate
          .map((g) => g['group'] as String)
          .toList();

      for (final expectedGroup in expectedGroups) {
        expect(actualGroups, contains(expectedGroup),
            reason: 'Gruppen "$expectedGroup" saknas');
      }
    });

    test('Varje grupp har minst en aktivitet', () {
      for (final group in activityTemplate) {
        final items = group['items'] as List;
        expect(items, isNotEmpty,
            reason: 'Gruppen "${group['group']}" har inga aktiviteter');
      }
    });

    test('Formsättning har rätt aktiviteter', () {
      final formgroup = activityTemplate.firstWhere(
        (g) => g['group'] == 'Formsättning',
      );
      
      final items = formgroup['items'] as List;
      expect(items, contains('Formbyggnad'));
      expect(items, contains('Elementform'));
      expect(items, contains('Demontering'));
    });

    test('Armering och betong har rätt aktiviteter', () {
      final group = activityTemplate.firstWhere(
        (g) => g['group'] == 'Armering och betong',
      );
      
      final items = group['items'] as List;
      expect(items, contains('Armering'));
      expect(items, contains('Betong'));
    });

    test('Alla aktiviteter har unika namn inom sin grupp', () {
      for (final group in activityTemplate) {
        final items = group['items'] as List;
        final uniqueItems = items.toSet();
        
        expect(items.length, uniqueItems.length,
            reason: 'Gruppen "${group['group']}" har duplicerade aktiviteter');
      }
    });

    test('Räknar totalt antal aktiviteter', () {
      int totalActivities = 0;
      for (final group in activityTemplate) {
        final items = group['items'] as List;
        totalActivities += items.length;
      }

      // Förväntat antal baserat på aktuell template
      expect(totalActivities, greaterThan(15),
          reason: 'Bör ha minst 15 aktiviteter totalt');
    });

    test('Alla aktivitetsnamn är icke-tomma strängar', () {
      for (final group in activityTemplate) {
        final items = group['items'] as List;
        for (final item in items) {
          expect(item, isA<String>());
          expect(item.toString().trim(), isNotEmpty,
              reason: 'Tom aktivitet hittades i "${group['group']}"');
        }
      }
    });

    test('Alla gruppnamn är icke-tomma strängar', () {
      for (final group in activityTemplate) {
        final groupName = group['group'] as String?;
        expect(groupName, isNotNull);
        expect(groupName!.trim(), isNotEmpty);
      }
    });
  });

  group('Activity Template struktur', () {
    test('Varje grupp har "group" och "items" fält', () {
      for (final group in activityTemplate) {
        expect(group.containsKey('group'), true,
            reason: 'Grupp saknar "group" fält');
        expect(group.containsKey('items'), true,
            reason: 'Grupp saknar "items" fält');
      }
    });

    test('"items" är alltid en lista', () {
      for (final group in activityTemplate) {
        expect(group['items'], isA<List>(),
            reason: '"items" för "${group['group']}" är inte en lista');
      }
    });
  });
}
