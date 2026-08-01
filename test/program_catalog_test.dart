import 'package:apl_appen/core/program_catalog.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Program catalog', () {
    test('contains the expected programs', () {
      final programNames = programOptions.map((program) => program.name).toList();

      expect(programNames, contains('Barn- och fritidsprogrammet'));
      expect(programNames, contains('Bygg- och anläggningsprogrammet'));
      expect(programNames, contains('El- och energiprogrammet'));
      expect(programNames, contains('Fordons- och transportprogrammet'));
      expect(programNames, contains('Försäljning- och serviceprogrammet'));
      expect(programNames, contains('Industritekniska programmet'));
      expect(programNames, contains('Restaurang- och livsmedelsprogrammet'));
      expect(programNames, contains('Vård- och omsorgsprogrammet'));
      expect(programNames, contains('VVS- och fastighetsprogrammet'));
    });

    test('maps building program to current supported specializations', () {
      final specializations =
          getSpecializationsForProgram('Bygg- och anläggningsprogrammet');

      expect(specializations, contains('Träarbetare'));
      expect(specializations, contains('Murare'));
      expect(specializations, contains('Målare'));
      expect(specializations, contains('Plåtslagare'));
      expect(specializations, contains('Anläggare'));
      expect(specializations, isNot(contains('Elektriker')));
      expect(specializations, isNot(contains('VVS')));
    });

    test('maps single-specialization programs correctly', () {
      expect(
        getSpecializationsForProgram('El- och energiprogrammet'),
        equals(['Elektriker']),
      );
      expect(
        getSpecializationsForProgram('VVS- och fastighetsprogrammet'),
        equals(['VVS']),
      );
    });

    test('infers program from specialization', () {
      expect(
        inferProgramFromSpecialization('Elektriker'),
        'El- och energiprogrammet',
      );
      expect(
        inferProgramFromSpecialization('VVS'),
        'VVS- och fastighetsprogrammet',
      );
      expect(
        inferProgramFromSpecialization('Målare'),
        'Bygg- och anläggningsprogrammet',
      );
    });
  });
}