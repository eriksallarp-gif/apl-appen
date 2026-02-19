# APL-appen - Appstruktur och Arkitektur

## 📋 Översikt
APL-appen är en Flutter-applikation för hantering av APL-praktik (Arbetsplatsförlagd Lärande) med stöd för elever, lärare och administratörer. Appen använder Firebase för autentisering och datalagrimg.

---

## 🏗️ Arkitektur på hög nivå

```
APL-appen
├── lib/
│   ├── main.dart                          (Huvud app, navigation, auth)
│   ├── main.test.dart                     (Arkiverad/testversion)
│   ├── firebase_options.dart              (Firebase-konfiguration)
│   └── Screens/                           (AllaUI-skärmar)
│       ├── start_screen.dart              (Elev - Hem)
│       ├── tidkort_screen.dart            (Elev - Tidkort)
│       ├── student_registration_screen.dart (Lärare - Elever)
│       ├── student_overview_screen.dart    (Lärare - Översikt)
│       ├── approval_and_assessment_screen.dart (Lärare - Godkännande/Bedömning/Ersättning)
│       ├── timesheet_control_screen.dart   (Lärare - Veckohantering)
│       ├── bedomning_screen.dart           (Bedömningsformulär)
│       └── ersattning_screen.dart          (Ersättningsformulär)
└── firebase.json                           (Firebase-config)
```

---

## 🔐 Autentisering och Navigation

### AuthGate (main.dart, ~lines 940-990)
**Ansvar**: Kontrollera användarens inloggningsstatus och roll

**Flow**:
1. Lyssnare på `FirebaseAuth.instance.authStateChanges()`
2. Om ingen användare: Visa `LoginScreen`
3. Om användare:
   - Hämta Firestore-dokument från `users/{uid}`
   - Läs `role` fältet (admin/teacher/student)
   - Hämta `displayName`
   - Om `displayName` saknas: Visa `ProfileSetupScreen`
   - Annars: Navigera baserat på roll:
     - **admin** → `AdminHome`
     - **teacher** → `MainNavigation` (Lärarvyn)
     - **student** → `MainNavigation` eller `StudentHome` (beroende på `teacherUid`)

### LoginScreen & Registration
- Skapar Firebase Auth-konton
- Initierar `users/{uid}` dokument med `email`, `role: 'student'`, `createdAt`

### ProfileSetupScreen
- Kräver användare att fylla i `displayName`
- Sparas i både Firestore och Firebase Auth-profil

---

## 👨‍🏫 Lärarvyn (MainNavigation)

### Struktur
`MainNavigation` är en **StatefulWidget** som visar olika skärmar baserat på användarens roll.

**Lärare får 4 flikar:**
1. **Elever** → `StudentRegistrationScreen`
2. **Översikt** → `StudentOverviewScreen`
3. **Godkännande** → `ApprovalAndAssessmentScreen`
4. **Veckor** → `TimesheetControlScreen`

### Init-flow
1. `initState()` → Anropar `_checkUserRole()`
2. Läser `users/{uid}.role` från Firestore
3. Sätter `_isTeacher = true` om roll == "teacher"
4. `_getScreens()` returnerar rätt array av skärmar

---

## 📊 Datastruktur (Firestore)

### Collections

#### `users/{uid}`
```json
{
  "email": "user@example.com",
  "displayName": "Erik Andersson",
  "role": "teacher|student|admin",
  "classId": "class_001",           // För elever: vilken klass
  "teacherUid": "teacher_uid",      // För elever: vilken lärare
  "createdAt": Timestamp
}
```

#### `classes/{classId}`
```json
{
  "name": "Klass 2024",
  "teacherUid": "teacher_123",
  "createdAt": Timestamp
}
```

#### `classes/{classId}/students/{uid}`
```json
{
  "displayName": "Erik Andersson",
  "email": "erik@example.com",
  "role": "student",
  "approvedHours": 120,
  "totalHours": 140
}
```

#### `timesheets/{docId}`
```json
{
  "studentUid": "student_uid",
  "teacherUid": "teacher_uid",
  "weekStart": "2024-02-05",
  "mon": { "group1": "8", "group2": "2" },
  "tue": { ... },
  ...
  "approved": false,
  "createdAt": Timestamp
}
```

#### `assessments/{assessmentId}`
```json
{
  "studentUid": "student_uid",
  "timesheetId": "timesheet_id",
  "competencies": {
    "competency1": { "level": 3, "comment": "..." },
    ...
  },
  "createdAt": Timestamp
}
```

#### `messages/{messageId}`
```json
{
  "from": "teacher_uid",
  "to": "student_uid",
  "subject": "...",
  "body": "...",
  "sentAt": Timestamp
}
```

#### `compensation/{docId}`
```json
{
  "studentUid": "student_uid",
  "weekStart": "2024-02-05",
  "meals": 50,
  "travel": 100,
  "createdAt": Timestamp
}
```

#### `timesheets/{docId}/approvals`
```json
{
  "status": "approved|pending|rejected",
  "approvedBy": "teacher_uid",
  "approvedAt": Timestamp
}
```

---

## 🎓 Elev-skärmarna (StudentHome / MainNavigation)

### StartScreen
- Visar överblick på elev-sidan
- Visar timmar för denna vecka
- Navigerar till tidkort/bedömning/ersättning

### TidkortScreen
- Visar vecko-tidkort
- Läser från `WeeklyTimesheetScreen` (i main.dart)
- Visar aktiviteter grupperade per kategori:
  - Formsättning (Formbyggnad, Elementform, etc.)
  - Armering och betong
  - Utvändigt arbete
  - Stomme och beklädnad
  - Invändigt arbete
  - Isolering
  - Reparationer
  - Miljö / Övrigt

**Aktivitetsdata**: Definierad i `activityTemplate` (main.dart, lines 13-40)

### WeeklyTimesheetScreen
- Lär in tidkort för en specifik vecka
- Skapar `TextEditingController` för varje aktivitet/dag
- Sparar till `timesheets/{docId}` när användare klickar "Spara tidkort"
- Läser `timesheets` från Firestore och populerar controllers

### AssessmentScreen
- Formulär för bedömning av elev
- Länkad via deep link: `apl://assess/{assessmentId}`
- Sparar bedömningsdata till `assessments/{assessmentId}`

---

## 👨‍💼 Lärarvyn i detalj

### 1. StudentRegistrationScreen (Elever-tab)
**Fil**: `lib/Screens/student_registration_screen.dart`

**Funktioner**:
- ✅ Visar alla elever i klassen
- ✅ Söka och filtrera elever (realtid med `_searchQuery`)
- ✅ Flervalsläge (long-press för att aktivera)
- ✅ Markera alla/avmarkera
- ✅ Massåtgärder:
  - **Meddela** - Skapa meddelanden till markerade elever
  - **Sätt veckor** - Sätta veckoöversättningar
  - **Ta bort** - Radera elever från klassen
- ✅ Redigera/radera enskilda elever

**Datakällor** (kombinerar båda):
1. `users` collection där `classId == selectedClassId`
2. `classes/{classId}/students` subcollection

Koduppbyggnad:
```dart
// StreamBuilder kombinerar båda källorna
// Läser från users (elever som skapat konto)
// + Läser från classes/{classId}/students (elever tillagda av lärare)
// Deduplicerar by uid
// Applicerar search-filter
// Visar ListView med checkboxes (selection mode)
```

**UI-state**:
- `_selectedClassId`: Vilken klass som visas
- `_selectedStudentUids`: Set<String> av valda elever
- `_selectionMode`: bool för att visa/dölja checkboxes
- `_searchQuery`: Söktext från `_searchController`
- `_isProcessing`: bool för loading-overlay under bulk-operationer

**Massåtgärder**:
```dart
_bulkDelete()        // Tar bort elever från både users och subcollection
_bulkMessage()       // Skapar messages i Firestore
_bulkSetWeeks()      // Skriver till classes/{classId}/studentWeekOverrides
_selectAllFiltered() // Markerar alla filtrerade elever
```

### 2. StudentOverviewScreen (Översikt-tab)
**Fil**: `lib/Screens/student_overview_screen.dart`

**Funktioner**:
- Visar status för alla elever
- Visar totala timmar per elev
- Visar godkända timmar
- Möjlighet att se detaljer per elev

### 3. ApprovalAndAssessmentScreen (Godkännande-tab)
**Fil**: `lib/Screens/approval_and_assessment_screen.dart`

**Tre under-flikar**:
1. **Godkännande** - Godkänna/avslå tidkort
2. **Bedömning** - Bedömningsformulär
3. **Ersättning** - Ersättningsformulär (lunch/resor)

### 4. TimesheetControlScreen (Veckor-tab)
**Fil**: `lib/Screens/timesheet_control_screen.dart`

**Funktioner**:
- Hantera vecko-översättningar per elev
- Se vilket veckonummer varje elev är på
- Justera antal veckor

---

## 🌐 Firebase-integration

### Dependencies (pubspec.yaml)
```yaml
firebase_auth: ^6.1.4        # Autentisering
firebase_core: ^4.4.0        # Core Firebase
cloud_firestore: ^6.1.2      # Databas
qr_flutter: ^4.1.0           # QR-kodgenerering
```

### Initialisering
```dart
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  runApp(const AplApp());
}
```

---

## 📱 Deep Linking

Appen stöder deep links för bedömningsformulär:
```
apl://assess/{assessmentId}
```

**Handler** i `AplApp.onGenerateRoute()`:
```dart
if (settings.name?.startsWith('/assess/') ?? false) {
  final assessmentId = settings.name!.replaceFirst('/assess/', '');
  return MaterialPageRoute(
    builder: (context) => AssessmentFormPageFromDeepLink(
      assessmentId: assessmentId,
    ),
  );
}
```

---

## 🎯 Flöden per roll

### Admin
**Hemskärm**: `AdminHome`
- Skapar klasser
- Hanterar lärare och elever

### Lärare
**Navigation**: `MainNavigation` (4 flikar)
- Elever: Registrera, söka, redigera, massåtgärder
- Översikt: Se elevstatus
- Godkännande: Godkänna tidkort och bedömningar
- Veckor: Hantera vecko-översättningar

### Elev
**Navigation**: `MainNavigation` (4 flikar) eller `StudentHome`
1. Hem - Överblick
2. Tidkort - Fylla i vecko-tidkort
3. Bedömning - Se bedömningsresultat
4. Ersättning - Se ersättningsdata (lunch/resor)

---

## 🔧 Nyckelkomponenter och utilities

### WeeklyTimesheetScreen (main.dart, lines ~60-560)
- Visar aktiviteter grupperade per kategori
- TextEditingControllers för varje aktivitet/dag
- Läser från Firestore på init
- Sparar via `_save()`
- Stöder read-only mode för lärare
- Approve/unapprove från lärarvyn

### AssessmentFormPage
- Formulär för bedömning
- Deep-linkbar
- Sparar bedömningsdata

### Utilities
```dart
String _ymd(DateTime d)        // Formatera datum som YYYY-MM-DD
DateTime _mondayOf(DateTime d) // Få måndagen för en vecka
```

---

## 📊 Activity-struktur

Definieras i `activityTemplate` (main.dart):
```dart
const activityTemplate = <Map<String, dynamic>>[
  {
    "group": "Formsättning",
    "items": ["Formbyggnad", "Elementform", "Demontering"]
  },
  // ... 7 fler grupper ...
  {
    "group": "Miljö / Övrigt",
    "items": ["Miljö", "Hjälparbeten", "Skyddsarbeten", "Övrigt"]
  }
];
```

Totalt **8 aktivitetsgrupper** med **~28 olika aktiviteter**.

---

## ✅ Implementerad funktionalitet

### Autentisering
- ✅ Login med email/password
- ✅ Registrering nya konton
- ✅ Profiluppsättning
- ✅ Logout

### Lärarvyn
- ✅ 4-flik navigation
- ✅ Elev-hantering (lista, söka, filtrera)
- ✅ Flervalsläge med checkboxes
- ✅ Massåtgärder (meddela, sätta veckor, ta bort)
- ✅ Dual-source student data (users + classes/students)
- ✅ Progress/loading overlay under operationer

### Elev-funktionalitet
- ✅ Tidkort (fylla i veckovis)
- ✅ Tidkort-godkännande (lärare)
- ✅ Bedömning (deep-linkbar formulär)
- ✅ Ersättning (lunch/resor)
- ✅ Vecko-överblick

### Admin
- ✅ Grundläggande adminhome
- ⏳ Klasshantering (pågår)
- ⏳ Lärarhantering (pågår)

---

## 🔄 Data Flow-exempel

### Elev fyller i tidkort
```
1. Elev startar appen → MainNavigation detekterar student-roll
2. Klickar på Tidkort-tab → TidkortScreen
3. Klickar på vecka → WeeklyTimesheetScreen
4. Fyller i timmar för aktiviteter
5. Klickar Spara → skriver till timesheets/{docId}
6. Lärare ser nya tidkort i Godkännande-tab
7. Lärare godkänner/avslår
```

### Lärare massuppdaterar elever
```
1. Lärare klickar på Elever-tab
2. Långtrycker på elev → aktiverar selection mode
3. Markerar flera elever (eller Markera alla)
4. Klickar Meddela → skriver messages/{docId} för varje elev
5. Progress-overlay visar att operationen körs
6. BatchWrite sparar allt atomärt
```

---

## 🚀 Nästa steg / TODO

1. **CSV-export** - Exportera elevdata från klassöversikt
2. **Godkännande-notifikationer** - Badge på Godkännande-tab när nya tidkort väntar
3. **Audit-logging** - Logga lärarens godkännanden och ändringar
4. **Ersättnings-autofyll** - Basera ersättning på vecko-timmar
5. **Lärares bedömningsformulär** - Förbättra UI för bedömning
6. **Testning** - Unit/widget tests

---

## 📝 Noter

- **Två studentdatakällor**: 
  - `users/{uid}` med `classId` (när elev själv skapar konto)
  - `classes/{classId}/students` (när lärare lägger till elev)
  - **Löst**: Kombinerar båda i StudentRegistrationScreen via två parallella StreamBuilders

- **Firestore Security**: Bör konfigureras för att:
  - Elever kan endast läsa/skriva sina egna data
  - Lärare kan läsa/skriva sina klassor
  - Admin kan läsa/skriva allt

- **Aktivitetsgrupper**: Hårdkodade i `activityTemplate`. Kan göras dynamiska senare.

---

Denna struktur ger en god grund för en skolapp där lärare kan hantera elev-praktik och elever kan fylla i tidkort.
