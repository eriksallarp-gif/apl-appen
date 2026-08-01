double _parseNumeric(dynamic value) {
  if (value is num) return value.toDouble();
  if (value is String) {
    return double.tryParse(value.replaceAll(',', '.')) ?? 0;
  }
  return 0;
}

bool isAssessmentVisibleStatus(String? status) {
  final normalized = (status ?? '').trim().toLowerCase();
  return normalized == 'submitted' || normalized == 'approved';
}

double resolveAssessmentDisplayRating(Map<String, dynamic> data) {
  final averageRating = _parseNumeric(data['averageRating']);
  if (averageRating > 0) return averageRating;

  final assessmentData = data['assessmentData'];
  if (assessmentData is! Map) return 0;

  double total = 0;
  int count = 0;

  for (final entry in assessmentData.entries) {
    final value = entry.value;
    if (value is Map) {
      final rating = _parseNumeric(value['rating']);
      if (rating > 0) {
        total += rating;
        count++;
      }
    }
  }

  if (count == 0) return 0;
  return total / count;
}
