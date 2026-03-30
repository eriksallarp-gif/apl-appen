import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  group('APL document categories', () {
    late List<dynamic> categories;

    setUpAll(() {
      final file = File('web_dashboard/src/lib/aplDocumentCategories.json');
      expect(file.existsSync(), isTrue,
          reason: 'Shared category file is missing');

      final decoded = jsonDecode(file.readAsStringSync());
      expect(decoded, isA<List>(),
          reason: 'Shared category file must contain a JSON list');
      categories = decoded as List<dynamic>;
    });

    test('contains unique non-empty ids', () {
      final ids = categories
          .whereType<Map>()
          .map((entry) => (entry['id'] ?? '').toString().trim())
          .toList();

      expect(ids, isNotEmpty);
      expect(ids.every((id) => id.isNotEmpty), isTrue,
          reason: 'Every category must have a non-empty id');
      expect(ids.toSet().length, ids.length,
          reason: 'Category ids must be unique');
    });

    test('contains unique non-empty names', () {
      final names = categories
          .whereType<Map>()
          .map((entry) => (entry['name'] ?? '').toString().trim())
          .toList();

      expect(names, isNotEmpty);
      expect(names.every((name) => name.isNotEmpty), isTrue,
          reason: 'Every category must have a non-empty name');
      expect(names.toSet().length, names.length,
          reason: 'Category names must be unique');
    });

    test('contains the baseline categories used in the app', () {
      final ids = categories
          .whereType<Map>()
          .map((entry) => (entry['id'] ?? '').toString().trim())
          .toSet();

      expect(ids, contains('kontakt_foretag'));
      expect(ids, contains('kontakt_skola'));
      expect(ids, contains('forsakringar'));
      expect(ids, contains('apl_tider'));
      expect(ids, contains('skadeanmalan'));
      expect(ids, contains('arbetsmiljoverket'));
      expect(ids, contains('ovrigt'));
    });
  });
}