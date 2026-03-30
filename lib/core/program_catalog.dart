import 'package:cloud_firestore/cloud_firestore.dart';

class ProgramOption {
  final String name;
  final List<String> specializations;

  const ProgramOption({required this.name, this.specializations = const []});
}

const programOptions = <ProgramOption>[
  ProgramOption(name: 'Barn- och fritidsprogrammet'),
  ProgramOption(
    name: 'Bygg- och anläggningsprogrammet',
    specializations: [
      'Träarbetare',
      'Murare',
      'Målare',
      'Plåtslagare',
      'Anläggare',
    ],
  ),
  ProgramOption(
    name: 'El- och energiprogrammet',
    specializations: ['Elektriker'],
  ),
  ProgramOption(name: 'Fordons- och transportprogrammet'),
  ProgramOption(name: 'Försäljning- och serviceprogrammet'),
  ProgramOption(name: 'Industritekniska programmet'),
  ProgramOption(name: 'Restaurang- och livsmedelsprogrammet'),
  ProgramOption(name: 'Vård- och omsorgsprogrammet'),
  ProgramOption(
    name: 'VVS- och fastighetsprogrammet',
    specializations: ['VVS'],
  ),
];

List<String> getSpecializationsForProgram(
  String? program, {
  List<ProgramOption> options = programOptions,
}) {
  final match = options.where((option) => option.name == program);
  if (match.isEmpty) return const [];
  return match.first.specializations;
}

bool programRequiresSpecialization(
  String? program, {
  List<ProgramOption> options = programOptions,
}) {
  return getSpecializationsForProgram(program, options: options).isNotEmpty;
}

String? inferProgramFromSpecialization(
  String? specialization, {
  List<ProgramOption> options = programOptions,
}) {
  if (specialization == null || specialization.isEmpty) return null;

  for (final program in options) {
    if (program.specializations.contains(specialization)) {
      return program.name;
    }
  }

  return null;
}

List<ProgramOption> sanitizeProgramOptions(List<ProgramOption> options) {
  final sanitized = <ProgramOption>[];
  final seenPrograms = <String>{};

  for (final option in options) {
    final programName = option.name.trim();
    if (programName.isEmpty) continue;

    final normalizedProgramName = programName.toLowerCase();
    if (seenPrograms.contains(normalizedProgramName)) continue;
    seenPrograms.add(normalizedProgramName);

    final specializations = <String>[];
    final seenSpecializations = <String>{};
    for (final specialization in option.specializations) {
      final name = specialization.trim();
      if (name.isEmpty) continue;
      final normalized = name.toLowerCase();
      if (seenSpecializations.contains(normalized)) continue;
      seenSpecializations.add(normalized);
      specializations.add(name);
    }

    sanitized.add(
      ProgramOption(name: programName, specializations: specializations),
    );
  }

  return sanitized;
}

List<ProgramOption> parseProgramOptions(dynamic rawPrograms) {
  if (rawPrograms is! List) return programOptions;

  final parsed = rawPrograms
      .whereType<Map>()
      .map((entry) {
        final name = (entry['name'] ?? '').toString().trim();
        if (name.isEmpty) return null;

        final specializations = (entry['specializations'] as List?)
                ?.map((item) => item.toString().trim())
                .where((item) => item.isNotEmpty)
                .toList() ??
            const <String>[];

        return ProgramOption(name: name, specializations: specializations);
      })
      .whereType<ProgramOption>()
      .toList();

  final sanitized = sanitizeProgramOptions(parsed);
  return sanitized.isEmpty ? programOptions : sanitized;
}

Future<List<ProgramOption>> loadProgramOptions() async {
  try {
    final doc = await FirebaseFirestore.instance
        .collection('appSettings')
        .doc('programCatalog')
        .get();

    if (!doc.exists) return programOptions;

    final data = doc.data();
    return parseProgramOptions(data?['programs']);
  } catch (_) {
    return programOptions;
  }
}