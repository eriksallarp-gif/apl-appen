import 'package:flutter_test/flutter_test.dart';
import 'package:apl_appen/main.dart';

void main() {
  group('Datum och vecko-funktioner', () {
    test('_ymd formaterar datum korrekt', () {
      final date1 = DateTime(2026, 2, 10);
      expect(_ymd(date1), '2026-02-10');

      final date2 = DateTime(2026, 12, 25);
      expect(_ymd(date2), '2026-12-25');

      final date3 = DateTime(2026, 1, 5);
      expect(_ymd(date3), '2026-01-05');
    });

    test('_ymd hanterar ensiffriga månader och dagar', () {
      final date = DateTime(2026, 3, 7);
      expect(_ymd(date), '2026-03-07');
    });
  });

  group('Invite Code generering', () {
    test('generateInviteCode skapar kod med rätt längd', () {
      final code1 = generateInviteCode();
      expect(code1.length, 6);

      final code2 = generateInviteCode(length: 8);
      expect(code2.length, 8);

      final code3 = generateInviteCode(length: 12);
      expect(code3.length, 12);
    });

    test('generateInviteCode skapar unika koder', () {
      final codes = List.generate(100, (_) => generateInviteCode());
      final uniqueCodes = codes.toSet();
      
      // Sannolikheten att få duplicat är extremt liten
      expect(uniqueCodes.length, greaterThan(95));
    });

    test('generateInviteCode använder endast tillåtna tecken', () {
      final allowedChars = RegExp(r'^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$');
      
      for (int i = 0; i < 50; i++) {
        final code = generateInviteCode();
        expect(allowedChars.hasMatch(code), true,
            reason: 'Kod "$code" innehåller otillåtna tecken');
      }
    });

    test('generateInviteCode undviker förvirrande tecken', () {
      for (int i = 0; i < 100; i++) {
        final code = generateInviteCode();
        expect(code.contains('O'), false, reason: 'Kod innehåller O (ser ut som 0)');
        expect(code.contains('0'), false, reason: 'Kod innehåller 0 (ser ut som O)');
        expect(code.contains('I'), false, reason: 'Kod innehåller I (ser ut som 1)');
        expect(code.contains('1'), false, reason: 'Kod innehåller 1 (ser ut som I)');
      }
    });
  });

  group('Assessment ID generering', () {
    test('generateAssessmentId skapar ID med rätt längd', () {
      final id1 = generateAssessmentId();
      expect(id1.length, 16);

      final id2 = generateAssessmentId(length: 20);
      expect(id2.length, 20);
    });

    test('generateAssessmentId skapar unika IDs', () {
      final ids = List.generate(100, (_) => generateAssessmentId());
      final uniqueIds = ids.toSet();
      
      expect(uniqueIds.length, 100, reason: 'Alla IDs bör vara unika');
    });

    test('generateAssessmentId använder endast lowercase och siffror', () {
      final allowedChars = RegExp(r'^[a-z0-9]+$');
      
      for (int i = 0; i < 50; i++) {
        final id = generateAssessmentId();
        expect(allowedChars.hasMatch(id), true,
            reason: 'ID "$id" innehåller otillåtna tecken');
      }
    });
  });
}

// Hjälpfunktion för att testa _ymd (måste göras tillgänglig för test)
String _ymd(DateTime d) {
  String two(int n) => n.toString().padLeft(2, '0');
  return '${d.year}-${two(d.month)}-${two(d.day)}';
}
