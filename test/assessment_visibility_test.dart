import 'package:flutter_test/flutter_test.dart';
import 'package:apl_appen/core/assessment_visibility.dart';

void main() {
  group('Assessment visibility rules', () {
    test('pending assessment hidden', () {
      expect(isAssessmentVisibleStatus('pending'), false);
      expect(isAssessmentVisibleStatus('PENDING'), false);
    });

    test('submitted and approved assessment visible', () {
      expect(isAssessmentVisibleStatus('submitted'), true);
      expect(isAssessmentVisibleStatus('approved'), true);
    });
  });

  group('Assessment rating fallback', () {
    test('fallback non-zero rating visible when averageRating is missing/zero', () {
      final data = <String, dynamic>{
        'averageRating': '0',
        'assessmentData': {
          'Engagemang': {'rating': 4, 'comment': 'Bra'},
          'Initiativtagande': {'rating': '5', 'comment': 'Mycket bra'},
          'Samarbetsförmåga': {'rating': 0, 'comment': ''},
        },
      };

      final rating = resolveAssessmentDisplayRating(data);
      expect(rating, greaterThan(0));
      expect(rating, closeTo(4.5, 0.001));
    });
  });
}
