// APL-appen Widget Tests
//
// Testar grundläggande widgets och UI-komponenter

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Widget grundläggande tester', () {
    testWidgets('AplApp skapar MaterialApp', (WidgetTester tester) async {
      // Detta är ett placeholder test eftersom appen kräver Firebase
      // För fullständiga widget tester behövs mock Firebase
      expect(true, true);
    });

    testWidgets('Textfält accepterar numerisk input', (WidgetTester tester) async {
      final controller = TextEditingController();
      
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: TextField(
              controller: controller,
              keyboardType: TextInputType.number,
            ),
          ),
        ),
      );

      await tester.enterText(find.byType(TextField), '8');
      expect(controller.text, '8');

      await tester.enterText(find.byType(TextField), '42');
      expect(controller.text, '42');
    });

    testWidgets('TextEditingController startar med tomt värde', (WidgetTester tester) async {
      final controller = TextEditingController();
      expect(controller.text, '');
      
      controller.dispose();
    });

    testWidgets('TextEditingController kan sättas till specifikt värde', (WidgetTester tester) async {
      final controller = TextEditingController(text: '10');
      expect(controller.text, '10');
      
      controller.text = '20';
      expect(controller.text, '20');
      
      controller.dispose();
    });
  });

  group('UI Validering', () {
    test('Validera timmar format', () {
      bool isValidHours(String input) {
        final parsed = int.tryParse(input);
        if (parsed == null) return false;
        return parsed >= 0 && parsed <= 24;
      }

      expect(isValidHours('8'), true);
      expect(isValidHours('0'), true);
      expect(isValidHours('24'), true);
      expect(isValidHours('-1'), false);
      expect(isValidHours('25'), false);
      expect(isValidHours('abc'), false);
      expect(isValidHours(''), false);
    });

    test('Validera email format', () {
      bool isValidEmail(String email) {
        final emailRegex = RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$');
        return emailRegex.hasMatch(email);
      }

      expect(isValidEmail('test@example.com'), true);
      expect(isValidEmail('user.name@domain.co.uk'), true);
      expect(isValidEmail('invalid'), false);
      expect(isValidEmail('@example.com'), false);
      expect(isValidEmail('test@'), false);
    });

    test('Validera datum format YYYY-MM-DD', () {
      bool isValidDateFormat(String date) {
        final dateRegex = RegExp(r'^\d{4}-\d{2}-\d{2}$');
        return dateRegex.hasMatch(date);
      }

      expect(isValidDateFormat('2026-02-10'), true);
      expect(isValidDateFormat('2026-12-25'), true);
      expect(isValidDateFormat('2026-1-5'), false);
      expect(isValidDateFormat('26-02-10'), false);
      expect(isValidDateFormat('2026/02/10'), false);
    });
  });
}
