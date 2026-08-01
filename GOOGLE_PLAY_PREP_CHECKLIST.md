# Google Play Console Prep Checklist

Last updated: 2026-03-29
Owner: Team APL Appen
Status: Waiting for Google Play Developer verification

## Progress snapshot (2026-03-29)
- [x] Svensk kort beskrivning framtagen (utkast)
- [x] Svensk lång beskrivning framtagen (utkast)
- [x] Data Safety arbetsmall framtagen
- [x] Content rating + målgrupp arbetsmall framtagen
- [x] App access/support copy-paste-utkast framtaget
- [x] Webbplats satt till www.apl-appen.com
- [x] Supportmail vald: support@aplappen.com
- [ ] Supportmail live och övervakad
- [ ] Play-konto verifierat och app skapad i Play Console

## Goal
Prepare everything possible before account verification so publish can happen quickly once Play Console is unlocked.

## A) Account and access
- [ ] Developer account verified in Google Play Console
- [ ] 2FA enabled for owner account
- [ ] Add at least one backup admin account
- [ ] Confirm company/legal name and address details are correct

## B) App setup in Play Console
- [ ] Create app in Play Console (App name, default language, app/game, free/paid)
- [ ] Set category and tags
- [ ] Add contact details (email required, website/phone if available)
- [ ] Add Privacy Policy URL

## C) Store listing assets
- [ ] Short description (<= 80 chars)
- [ ] Full description (clear value, target users, key features)
- [ ] App icon (512x512, PNG)
- [ ] Feature graphic (1024x500)
- [ ] Phone screenshots (min 2, max 8 recommended)
- [ ] Optional: 7-inch/10-inch tablet screenshots

Svenskt textutkast (klart att klistra in, granska innan publicering):

Kort beskrivning (<=80):
"APL-appen för skolor: tidkort, bedömning, godkännande och statistik."

Lång beskrivning:
"APL-appen hjälper skolor, lärare och elever att hantera APL i ett säkert
och enkelt arbetsflöde.

Med APL-appen kan ni:
- Registrera och följa upp veckovisa tidkort
- Skicka in och godkänna underlag mellan elev och handledare
- Arbeta med tydliga statusregler för bedömningar
- Få klassöversikt och statistik för bättre uppföljning
- Exportera utvald data för rapportering

Utvecklad för skolmiljö:
- Rollbaserad åtkomst för elever och personal
- Säker datahantering med Firebase-backend
- Stabilt stöd för det dagliga APL-arbetet

Vem är appen till för?
APL-appen är framtagen för skolor och utbildningsteam som behöver ett
praktiskt verktyg för att hantera APL-processen från registrering till
uppföljning.

Obs:
Funktioner kan variera beroende på användarroll och skolans upplägg."

Notes:
- Keep wording consistent with real app behavior.
- Do not mention features that are not release-ready.

## D) Policy and declarations
- [ ] Data safety form completed (what data is collected/shared and why)
- [ ] Content rating questionnaire completed
- [ ] Target audience + age settings completed
- [ ] Permissions declaration reviewed
- [ ] Account deletion policy flow verified against current app behavior

Data Safety draft (svensk arbetsmall, verifiera i Play Console innan submit):

1) Samlar appen in personuppgifter?
- Förslag: Ja.

2) Delar appen data med tredje part?
- Förslag: Nej, inte för annonsering/försäljning.
- Notera: Backend-tjänster (Firebase) används för drift av appen.

3) Vilka datatyper behandlas? (exempel att kontrollera)
- Personuppgifter: namn, e-post, roll, skola/klasskoppling.
- Appaktivitet/innehåll: tidkort, kommentarer, bedömningar, status.
- Filer/bilder: bilagor som användare laddar upp i APL-flöden.

4) Syfte med databehandling (förslag)
- Appfunktionalitet: inloggning, tidkort, bedömning, statistik.
- Kontohantering och säkerhet: behörigheter, återställning, logik för kontoborttagning.
- Kommunikation inom appens arbetsflöden mellan elev/lärare/handledare.

5) Säkerhetsåtgärder (förslag)
- Data krypteras vid överföring (TLS).
- Åtkomst styrs med autentisering och roll-/regelbaserade behörigheter.

6) Möjlighet att begära borttagning av data
- Förslag: Ja.
- Stöd i app/back-end för begäran och återkallning av kontoborttagning finns.

7) Kryssruta innan publicering
- [ ] Verifiera att ovan matchar exakt vad appen faktiskt samlar in i produktion.
- [ ] Säkerställ att Privacy Policy beskriver samma datatyper och syften.

Content rating + målgrupp (svensk arbetsmall):

1) Innehållsklassificering
- Förslag: "Alla" eller låg åldersklassning, om appen inte innehåller våld, hasardspel, vuxet innehåll eller användargenererat öppet innehåll.
- [ ] Verifiera frågeformuläret i Play Console och justera endast om någon funktion faktiskt kräver högre klassning.

2) Målgrupp
- Primär målgrupp: gymnasieelever, lärare och handledare inom APL.
- Förslag i Play Console: välj relevanta ungdom/vuxenintervall enligt skolans användning.
- [ ] Säkerställ att målgruppsval matchar verkliga användare och skolans policy.

3) Families-policy
- Förslag: appen är inte en barnapp enligt Families-programmet (om inte ni uttryckligen riktar er till små barn).
- [ ] Bekräfta detta i Play-formuläret.

App access / support info (copy-paste-utkast):

"Appen används av skolor för administration av APL (arbetsplatsförlagt lärande).
Inloggning sker med registrerat konto. Om Google Play behöver granskningsåtkomst
kan testkonto tillhandahållas på begäran.

Supportkontakt:
E-post: support@aplappen.com (verifiering pågår, ej live än)
Webbplats: www.apl-appen.com

Om du behöver hjälp med åtkomst eller kontofrågor, kontakta supporten via e-post."

Kryssruta innan publicering:
- [x] Supportmail ifylld: support@aplappen.com.
- [ ] Säkerställ att supportmailen är live och övervakas dagligen under releasefönstret.

## E) Build and signing readiness
- [x] Release keystore created locally
- [x] android/key.properties created locally from android/key.properties.example
- [x] Signed release AAB built successfully
- [x] AAB artifact path confirmed: build/app/outputs/bundle/release/app-release.aab
- [x] Keystore + key credentials backed up securely (offline/offsite)

Quick setup command (run from repo root when ready):
- `./android/setup_release_signing.ps1`
- Then build signed bundle: `flutter build appbundle --release`

Important:
- Project now builds release-signed AAB with local keystore and key.properties.

## F) Testing tracks
- [ ] Internal testing track created
- [ ] Testers added (emails/groups)
- [ ] Upload signed AAB to Internal testing
- [ ] Release notes added for testers
- [ ] Test pass confirmed for core flows:
- [ ] Login and password reset
- [ ] Timesheet create/edit/submit
- [ ] Supervisor approval + assessment visibility
- [ ] Statistics view basics

## G) Release decision
- [ ] No blocker/critical bugs open
- [ ] Rollout plan confirmed (staged rollout)
- [ ] Go/No-Go approval documented

## Recommended staged rollout
1. Internal testing (team + selected testers)
2. Closed testing
3. Production staged rollout: 10% -> 50% -> 100%

## Quick publish checklist (day of verification)
1. Verify account is approved in Play Console.
2. Create/upload signed AAB.
3. Complete missing declarations.
4. Submit Internal testing release.
5. Validate crash-free startup and core flows.

Immediate next actions (while waiting):
1. Make support@aplappen.com live and monitored.
2. Prepare final screenshot set and feature graphic.
3. Backup keystore and credentials securely before Play production rollout.

## Related project files
- RELEASE_READINESS_CHECKLIST.md
- android/app/build.gradle.kts
- android/key.properties.example
- FIREBASE_DEPLOYMENT.md
