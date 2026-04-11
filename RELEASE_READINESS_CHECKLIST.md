# Checklista För Releasberedskap

Senast uppdaterad: 2026-03-29
Ansvarig: Team APL Appen

## Aktuell status
- [x] Intern test pågår med 2 elever via debug-APK
- [x] Flera buggar hittade och åtgärdade under testcykeln
- [ ] Release candidate-byggpipeline verifierad (Android + iOS)
- [ ] Butiksmaterial färdigt (Google Play + App Store)
- [ ] Slutlig go/no-go-granskning genomförd

## Policy för release-stabilisering (2026-03-29)
- [x] Feature freeze: inga nya funktioner innan release candidate är godkänd
- [x] Säkerhetsregel: inga refaktoriseringar som kan ta bort eller ändra befintliga kärnflöden
- [x] Tillåtna ändringar: endast blockerande/kritiska buggfixar, release-signering, butiksmetadata och monitoreringssetup
- [x] UI/designändringar skjuts upp om de inte är strikt kosmetiska och helt riskfria

Beslutsnotering:
- Prioritet är stabilt releasebeteende framför utökad scope. Befintlig app- och webb-funktionalitet måste förbli intakt.
- Detaljer för Play Console-förberedelser finns i GOOGLE_PLAY_PREP_CHECKLIST.md

## 1) Stabilitets- och regressionsgrind
- [ ] Inga blockerande buggar i lärar-/elevflöden
- [x] Återställning av inloggning: glömt lösenord skickar återställningsmail utan krasch
- [ ] Inga blockerande buggar i statistikvyn
- [ ] Inga blockerande buggar i flödet för att skicka/godkänna tidkort
- [ ] Inga blockerande buggar i regler för bedömningssynlighet
- [ ] Regressionskontroll: väntande bedömningar visas aldrig som inskickade

Exit-kriterier:
- 0 blockerande buggar
- 0 öppna kritiska buggar

## 2) Grind för testtäckning
- [x] Lägg till/verifiera test: väntande bedömning dold
- [x] Lägg till/verifiera test: inskickad/godkänd bedömning synlig
- [x] Lägg till/verifiera test: fallback för rating över 0 synlig
- [x] Kör hela flutter test framgångsrikt

Exit-kriterier:
- Alla riktade tester gröna

## 3) Android-releasegrind (Google Play)
- [x] Sätt release versionCode/versionName
- [x] Konfigurera release-signering i Gradle (koppling till key.properties)
- [x] Bygg signerad Android App Bundle (.aab)
- [ ] Verifiera appstart/inloggning/kärnflöde på release-build
- [ ] Ladda upp till Internal testing-spåret
- [ ] Samla in testfeedback och kraschrapporter

Progress notes (2026-03-28):
- Byggde release-AAB: build/app/outputs/bundle/release/app-release.aab (53.5MB)
- Byggde release-APK: build/app/outputs/flutter-apk/app-release.apk (68.5MB)
- Nuvarande blockerare för "signed AAB": release buildType använder debug-signering i android/app/build.gradle.kts.
- Nuvarande blockerare för runtime-verifiering: ingen Android-enhet/emulator ansluten i denna miljö (endast Windows/Chrome/Edge upptäckta).

Progress notes (2026-03-29):
- Uppdaterade android/app/build.gradle.kts för att stödja release-signering via android/key.properties.
- Release-build använder nu release-nyckel när key.properties finns, annars faller den tillbaka till debug-signering.
- Byggde release-AAB igen: build/app/outputs/bundle/release/app-release.aab (53.5MB).
- Kontroll av byggmiljö: android/key.properties saknas just nu, så release-build faller tillbaka till debug-signering.
- Sanity-tester godkända (3/3): test/assessment_visibility_test.dart, test/timesheet_calculation_test.dart, test/activity_template_test.dart.
- Städade bort icke-källkodsfiler före releasearbete: tog bort android_startup_log.txt (flutter_02.png förväntades tas bort manuellt).

Progress notes (2026-03-29, senare):
- Skapade lokal upload-keystore: android/keystore/upload-keystore.jks.
- Skapade lokal signeringskonfiguration: android/key.properties.
- Byggde release-AAB med release-signering aktiverad: build/app/outputs/bundle/release/app-release.aab (53.5MB).
- Signaturverifiering bekräftar CN=APL Appen-certifikat på AAB.

Exit-kriterier:
- Internal testing godkänd av teamet

## 4) iOS-releasegrind (App Store)
- [ ] Bekräfta signering/certifikat/profiler
- [ ] Bygg iOS release-arkiv
- [ ] Ladda upp till TestFlight
- [ ] Validera lärar-/elevflöden på TestFlight-build
- [ ] Hantera TestFlight-feedback

Exit-kriterier:
- TestFlight-build godkänd av teamet

## 5) Grind för butiksberedskap
- [ ] URL till integritetspolicy verifierad
- [ ] Appbeskrivning färdigställd
- [ ] Skärmbilder färdigställda (telefonstorlekar)
- [ ] Supportkontakt och webbplats verifierade
- [ ] Produktionsdomäner verifierade: apl-appen.com primär, www.apl-appen.com redirect, aplappen.com redirect, www.aplappen.com redirect
- [ ] Firebase Auth-mallar verifierade att använda https://www.apl-appen.com/__/auth/action
- [ ] Åldersgräns/innehållsdeklarationer färdiga
- [ ] Flöde för kontoborttagning/datahantering verifierat mot policy

Exit-kriterier:
- Båda paketen med butiksmetadata klara

Progress notes (2026-04-01):
- Firebase Auth-mailmallar uppdaterade för att använda custom action URL på www.apl-appen.com i stället för standarddomänen firebaseapp.com.
- Flutter-/webbkonfiguration för auth uppdaterad för att använda www.apl-appen.com som auth-domän och action URL-mål.
- Firebase Hosting custom domains konfigurerade så att apl-appen.com är primär webbplats.
- www.apl-appen.com konfigurerad som redirect till apl-appen.com.
- aplappen.com och www.aplappen.com konfigurerade som extra redirects till primärdomänen apl-appen.com; DNS-propagation/verifiering pågick under uppsättningen.
- Lärarwebbens startsida/dashboard behöver fortfarande motsvarande bedömningsuppdateringar så att det nya konfigurerbara bedömningsflödet syns där också.

## 6) Grind för produktionsövervakning
- [ ] Crash reporting aktiverad och verifierad
- [ ] Grundläggande analytics events verifierade
- [ ] Incidentansvarig och rollback-plan dokumenterade
- [ ] Checklista för första veckans övervakning förberedd

Exit-kriterier:
- Teamet kan upptäcka och hantera produktionsproblem snabbt

## 7) Lanseringsbeslut
- [ ] Go/No-Go-möte genomfört
- [ ] Risklista granskad och accepterad
- [ ] Rollout-strategi vald (staged rollout rekommenderas)

Rekommenderad rollout:
1. Google Play staged rollout (10% -> 50% -> 100%)
2. App Store-release efter första stabila perioden

## Veckologg för beta
Använd den här sektionen för att följa upp de två aktiva elevtestarna.

### Vecka med start 2026-03-26
- Aktiva testare: 2 elever (debug-APK)
- Buggar hittade: flera
- Buggar fixade: flera
- Öppna blockerare: inga bekräftade i denna notering
- Anteckningar: Fortsätt fokuserad testning i lärar-/elevstatistik och bedömningsflöden. Flödet för glömt lösenord lades till i appens inloggning och verifierades (utskick av återställningslänk via mail + ingen runtime assertion efter route-refaktorering).

## Mall för buggt triagering
Kopiera detta för varje ny issue som hittas under beta.

- Titel:
- Miljö (Android/iOS/Web + appversion):
- Roll (lärare/elev/handledare):
- Steg för att återskapa:
- Förväntat resultat:
- Faktiskt resultat:
- Allvarlighetsgrad (blocker/critical/major/minor):
- Status (open/in-progress/fixed/verified):
- Ägare:
- Fixversion:
