# Test-dokumentation för APL-appen

## Översikt
APL-appen har nu en omfattande testsvit med **40 automatiska tester** som validerar kritiska funktioner.

## Testfiler

### 1. `test/utils_test.dart` (13 tester)
**Testar hjälpfunktioner och utilities**

#### Datum och vecko-funktioner (2 tester)
- ✅ `_ymd` formaterar datum korrekt (YYYY-MM-DD)
- ✅ Hanterar ensiffriga månader och dagar

#### Invite Code generering (4 tester)
- ✅ Skapar koder med rätt längd (6, 8, 12 tecken)
- ✅ Genererar unika koder (kontrollerar 100 koder)
- ✅ Använder endast tillåtna tecken (A-Z, 2-9)
- ✅ Undviker förvirrande tecken (O, 0, I, 1)

#### Assessment ID generering (3 tester)
- ✅ Skapar IDs med rätt längd (16+ tecken)
- ✅ Alla IDs är unika (100 IDs)
- ✅ Använder endast lowercase och siffror (a-z, 0-9)

### 2. `test/timesheet_calculation_test.dart` (14 tester)
**Testar tidkort-beräkningar och godkännande-logik**

#### Tidkort-beräkningar (6 tester)
- ✅ Räknar totala timmar korrekt för en vecka
- ✅ Hanterar tomma tidkort (0 timmar)
- ✅ Hanterar ogiltiga input (abc, tomma strängar)
- ✅ Räknar timmar per dag korrekt
- ✅ Räknar timmar per aktivitet korrekt
- ✅ Validerar rimliga arbetstimmar (0-24h)

#### Vecko-beräkningar (4 tester)
- ✅ Beräknar ISO veckonummer korrekt
- ✅ Hittar måndag för given vecka
- ✅ Måndag returnerar sig själv
- ✅ Söndag returnerar föregående måndag

#### Godkännande-logik (3 tester)
- ✅ Tidkort är ogodkänt som standard
- ✅ Godkänt tidkort kan inte redigeras
- ✅ Ogodkänt tidkort kan redigeras

### 3. `test/activity_template_test.dart` (9 tester)
**Testar aktivitetsmallar och struktur**

#### Template validering (8 tester)
- ✅ Template är inte tom
- ✅ Alla 8 grupper finns (Formsättning, Armering, etc.)
- ✅ Varje grupp har minst en aktivitet
- ✅ Formsättning har rätt aktiviteter
- ✅ Armering och betong har rätt aktiviteter
- ✅ Inga duplicerade aktiviteter inom grupper
- ✅ Totalt >15 aktiviteter
- ✅ Alla aktivitetsnamn är icke-tomma

#### Template struktur (1 test)
- ✅ Alla grupper har "group" och "items" fält

### 4. `test/widget_test.dart` (4 tester)
**Testar UI-komponenter och validering**

#### Widget tester (3 tester)
- ✅ Textfält accepterar numerisk input
- ✅ TextEditingController startar tomt
- ✅ TextEditingController kan uppdateras

#### Validering (3 tester)
- ✅ Timmar format (0-24)
- ✅ Email format (xxx@yyy.zzz)
- ✅ Datum format (YYYY-MM-DD)

## Kör tester

```bash
# Kör alla tester
flutter test

# Kör specifik testfil
flutter test test/utils_test.dart

# Kör med coverage (om konfigurerat)
flutter test --coverage
```

## Testresultat
```
00:02 +40: All tests passed!
```

## Vad testas INTE (ännu)

### Firebase Integration
- Autentisering
- Firestore CRUD-operationer
- Security rules (dessa testas separat i Firebase)

### Widget Integration
- Fullständiga skärm-tester (kräver mock Firebase)
- Navigation mellan skärmar
- Form validation i UI

### Rekommendation
För att testa Firebase-integration skulle vi behöva:
1. Mock Firebase services (firebase_auth_mocks, fake_cloud_firestore)
2. Integration tests med testdata
3. Widget tests för kompletta flöden

## Nästa steg

För att utöka testerna kan vi:
1. **Mock Firebase** - Testa utan riktig Firebase-anslutning
2. **Integration tests** - Testa hela användarflöden
3. **Golden tests** - Snapshot-tester för UI
4. **Performance tests** - Testa app-prestanda

## Sammanfattning

✅ **40/40 tester passerar**
- Datum och tidhantering
- Tidkortberäkningar
- Kodgenerering
- Aktivitetsmallar
- Input-validering
- Godkännande-logik
