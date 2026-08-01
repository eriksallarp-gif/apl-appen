# RELEASE CHECKLIST

Den här checklistan är till för en faktisk release av APL-appen och samlar verifiering, deploy och efterkontroll på ett ställe.

## 1. Förberedelser

- Bekräfta vilken release som ska ut: appändringar, Firestore-regler, Functions och/eller web dashboard.
- Kontrollera versionsnumret i `pubspec.yaml` och höj det vid behov.
- Säkerställ att rätt Firebase-projekt används: `apl-appen-aa472`.
- Säkerställ att du är inloggad i Firebase CLI och gcloud om webben ska deployas.

## 2. Lokal kvalitetskontroll

Kör dessa kommandon från projektroten `d:\apl_appen`:

```powershell
flutter pub get
flutter analyze
flutter test
flutter build apk --debug
```

Förväntat resultat:

- `flutter analyze` utan nya relevanta fel.
- `flutter test` passerar.
- APK-builden går igenom.

## 3. Manuell smoke test i appen

Verifiera minst detta innan release:

- Elev kan logga in.
- Elev kan öppna sitt tidkort för en vecka.
- Ändringar i tidkort sparas korrekt och gamla värden kommer inte tillbaka efter ominläsning.
- Varning för osparade ändringar visas när användaren ändrar data och försöker lämna sidan.
- Elev kan inte redigera låst eller godkänt tidkort.
- Lärare kan öppna elevens tidkort och godkänna det.
- Supervisor-flödet via QR-länk går att öppna och skicka in en bedömning en gång.

## 4. Deploy av Firestore-regler

Kör detta när regler har ändrats:

```powershell
firebase deploy --only firestore:rules --project=apl-appen-aa472
```

Verifiera efter deploy:

- Elev kan fortfarande läsa och uppdatera sitt eget olåsta tidkort.
- Lärare kan fortfarande läsa och godkänna tidkort.
- Objektsåtkomst mellan olika elever nekas.
- Supervisor-bedömning kan skickas in, men samma request kan inte skrivas om fritt efter submission.

## 5. Deploy av Cloud Functions

Kör detta om något i `functions/` har ändrats:

```powershell
firebase deploy --only functions --project=apl-appen-aa472
```

Verifiera efter deploy:

- Eventuella backfill- eller API-flöden fungerar som förväntat.
- Inga nya fel syns i Firebase Functions-logger.

## 6. Deploy av web dashboard och hosting

Det här behövs om `web_dashboard/`, `firebase.json` eller hosting-routing har ändrats.

Bygg och deploya Cloud Run-tjänsten:

```powershell
gcloud builds submit web_dashboard `
  --tag=europe-north1-docker.pkg.dev/apl-appen-aa472/apl-appen/web:latest `
  --region=europe-north1

gcloud run deploy apl-appen-web `
  --image=europe-north1-docker.pkg.dev/apl-appen-aa472/apl-appen/web:latest `
  --platform=managed `
  --region=europe-north1 `
  --allow-unauthenticated `
  --memory=512Mi `
  --cpu=1 `
  --timeout=3600 `
  --project=apl-appen-aa472
```

Deploya därefter hosting:

```powershell
firebase deploy --only hosting --project=apl-appen-aa472
```

Verifiera efter deploy:

- Hosting rewrite pekar fortsatt mot `apl-appen-web`.
- Startsidan laddar via hosting-domänen.
- Inloggning fungerar.
- Sidor som använder Firestore fungerar utan permissions-fel.

## 7. Efterkontroll i produktion

Verifiera i produktion direkt efter release:

- Logga in som elev och öppna tidkort.
- Logga in som lärare och kontrollera godkännandeflödet.
- Testa minst en QR-baserad supervisorbedömning.
- Kontrollera Firestore Rules i Firebase Console.
- Kontrollera Cloud Run-loggar om webben har deployats.

Exempel för loggar:

```powershell
gcloud run logs read apl-appen-web --region=europe-north1 --limit=50
```

## 8. Rollback-plan

Om release orsakar problem:

- Stoppa vidare deployer tills orsaken är bekräftad.
- Återställ senast fungerande Firestore-regler i Firebase Console eller deploya föregående kända rules-fil.
- Deploya föregående fungerande version av Cloud Run-tjänsten om webbreleasen är orsaken.
- Om problemet bara gäller Flutter-klienten: distribuera inte vidare APK förrän ny verifierad build finns.

## 9. Release sign-off

Releasen är klar först när följande är uppfyllt:

- Automatisk testning klar.
- Manuell smoke test klar.
- Nödvändiga deploysteg genomförda.
- Produktion verifierad utan blockerande fel.
- Eventuella kända begränsningar dokumenterade i release notes.
