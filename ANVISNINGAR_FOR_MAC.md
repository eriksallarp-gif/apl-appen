# APL Appen – iOS Release på Mac

**Datum:** 2026-04-11  
**Version att bygga:** 1.0.1 (Build 2)  
**Bundle ID:** com.aplappen.app

Denna guide är fristående och innehåller alla steg du behöver för att bygga och ladda upp iOS-versionen till TestFlight.

---

## ✅ Innan du börjar

### REKOMMENDERAT: Använd git clone istället för USB
Om Mac:en har internet är det enklaste att clona projektet direkt från GitHub.
Då behöver du bara ha denna guide med dig (på papper eller som screenshot).

### Alternativ: USB-minne
Om du använder USB, kopiera hela projektmappen `apl_appen`.

### Krav på Mac:en:
- **Xcode** installerat från App Store (helst senaste versionen)
- **Apple Developer-konto** inloggat i Xcode
- **Flutter SDK** installerat via Homebrew eller manuellt (se steg 1)
- **Git** (finns redan på Mac)
- **CocoaPods** installeras automatiskt i steg 2

### ⚠️ Du behöver INTE VS Code eller någon editor!
Allt görs i **Terminal** + **Xcode**.

---

## 📱 Steg-för-steg guide

### Steg 1: Installera Flutter SDK på Mac:en

**Öppna Terminal** (Cmd+Space > skriv "Terminal").

**Alternativ A - Via Homebrew (rekommenderat):**
```bash
# Installera Homebrew om det inte finns:
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Installera Flutter:
brew install flutter

# Verifiera installation:
flutter doctor
```

**Alternativ B - Manuell installation:**
1. Ladda ner Flutter från: `https://docs.flutter.dev/get-started/install/macos`
2. Packa upp i `~/development/flutter`
3. Lägg till i PATH enligt Flutter:s instruktioner

---

### Steg 2: Hämta projektet

**Alternativ A - Git clone (rekommenderat om Mac:en har internet):**

```bash
# Navigera till Documents:
cd ~/Documents

# Clona projektet från GitHub (byt ut URL till ditt repo):
git clone https://github.com/DITT_ANVÄNDARNAMN/apl_appen.git

# Gå in i projektmappen:
cd apl_appen
```

**Alternativ B - Från USB:**

```bash
# Kopiera projektet från USB till Documents:
# (gör detta med Finder eller via Terminal)

# Gå till projektmappen:
cd ~/Documents/apl_appen
```

---

### Steg 3: Installera dependencies (KÖRS I PROJEKTMAPPEN VIA TERMINAL)

**Dessa kommandon körs i Terminal, INUTI projektmappen `apl_appen`.**  
De installerar packages **lokalt i projektet**, inte globalt på Mac:en.

```bash
# Kontrollera att du är i rätt mapp:
pwd
# Ska visa något som: /Users/dittnamn/Documents/apl_appen

# Installera Flutter packages (hämtar alla Dart/Flutter-paket som appen behöver):
flutter pub get

# Installera CocoaPods (verktyg för iOS-dependencies):
sudo gem install cocoapods

# Gå till ios-mappen:
cd ios

# Uppdatera CocoaPods repository (kan ta några minuter):
pod repo update

# Installera iOS pods (hämtar alla iOS-bibliotek som Firebase m.m.):
pod install

# Gå tillbaka till projektets rot:
cd ..
```

**Förklaring:**
- `flutter pub get` = hämtar Flutter-paket till `apl_appen/.dart_tool` och `apl_appen/.pub-cache`
- `pod install` = hämtar iOS-bibliotek till `apl_appen/ios/Pods/`
- Allt installeras **i projektmappen**, inte någon annanstans på Mac:en

**VIKTIGT:** Om `pod install` ger fel, prova:
```bash
cd ios
rm -rf Pods Podfile.lock
pod install
cd ..
```

---

### Steg 4: Öppna projektet i Xcode

Från Terminal i projektets rot (se till att du fortfarande är i `~/Documents/apl_appen`):

```bash
open ios/Runner.xcworkspace
```

**⚠️ VIKTIGT:** Öppna alltid `Runner.xcworkspace`, INTE `Runner.xcodeproj`!

Detta kommando öppnar Xcode automatiskt med rätt workspace.

---

### Steg 5: Konfigurera signering i Xcode

När projektet öppnas i Xcode:

1. Välj **Runner** i projekthierarkin (vänster panel)
2. Välj **Runner** under TARGETS
3. Gå till fliken **Signing & Capabilities**
4. Kontrollera:
   - ✅ **Team:** Välj ditt Apple Developer-team från listan
   - ✅ **Automatically manage signing:** MÅSTE vara ikryssad
   - ✅ **Bundle Identifier:** Ska vara `com.aplappen.app`

5. Gå till fliken **General** och verifiera:
   - ✅ **Display Name:** APL Appen (eller önskat namn)
   - ✅ **Version:** `1.0.1`
   - ✅ **Build:** `2`
   - ✅ **Deployment Target:** iOS 13.0 eller högre

Xcode kommer automatiskt skapa nödvändiga certifikat och provisioning profiles.

---

### Steg 6: Testa på fysisk iPhone (rekommenderat)

1. Anslut en iPhone via USB
2. Välj din iPhone i Xcode:s device-lista (överst i fönstret)
3. Klicka på **Play-knappen** (▶️) eller tryck `Cmd+R`
4. **Första gången:** Du kan behöva godkänna utvecklarprofilen på telefonen:
   - Gå till Inställningar > Allmänt > VPN och enhetshantering
   - Godkänn utvecklarprofilen
5. Testa appen:
   - ✅ Inloggning fungerar
   - ✅ QR-skanning fungerar
   - ✅ Ladda in elevdata eller lärarfunktioner

**OBS:** Om appen kraschar eller Firebase inte fungerar, kontrollera att `GoogleService-Info.plist` finns i `ios/Runner/` mappen.

---

### Steg 7: Skapa Archive för TestFlight

1. I Xcode, välj destination: **Any iOS Device (arm64)** eller **Generic iOS Device**
   - Detta finns i listan överst där du tidigare valde iPhone
2. Gå till menyn: **Product > Archive**
3. Vänta... (kan ta 5-10 minuter)
4. När det är klart öppnas **Organizer** automatiskt
5. Kontrollera i Organizer att arkivet visar:
   - Namn: APL Appen
   - Version: 1.0.1 (2)
   - Datum: idag

---

### Steg 8: Ladda upp till App Store Connect

I **Organizer** (öppnas efter Archive):

1. Välj det senaste arkivet (1.0.1 build 2)
2. Klicka **Distribute App**
3. Välj **App Store Connect**
4. Välj **Upload**
5. Behåll standardalternativen (om inte Xcode visar blockerande fel)
6. Klicka **Next**, **Next**, **Upload**
7. Vänta på uppladdning (kan ta 10-30 minuter beroende på internet)

---

### Steg 9: Verifiera i App Store Connect

1. Öppna webbläsaren och gå till: `https://appstoreconnect.apple.com`
2. Logga in med samma Apple Developer-konto
3. Välj din app (APL Appen)
4. Gå till **TestFlight**-fliken
5. Vänta på att builden processas (kan ta 15-60 minuter)
6. När status är "Ready to Submit" eller "Testing":
   - Fyll i **Export Compliance** om Apple frågar (välj oftast "Nej" om appen inte har kryptering utöver HTTPS)
7. Lägg till **interna testare**:
   - Gå till fliken "Internal Testing"
   - Lägg till dig själv och andra testare
8. Testarna får en inbjudan via mail och kan installera via TestFlight-appen

---

## 🔥 Viktig Firebase-kontroll

Kontrollera att denna fil finns och är korrekt:

```bash
ls -la ios/Runner/GoogleService-Info.plist
```

Om filen saknas eller är tom kommer Firebase-funktioner (inloggning, firestore, etc.) INTE att fungera.

Filen ska innehålla:
- `BUNDLE_ID`: com.aplappen.app
- `GOOGLE_APP_ID`: 1:103324730349:ios:c5d9441dac2b5f18bc1de4

---

## ⚠️ Felsökning – Vanliga problem

### Problem: "No matching provisioning profiles found"
**Lösning:**
- Kontrollera att du är inloggad i Xcode med rätt Apple ID
- Gå till Xcode > Preferences > Accounts och logga in igen om nödvändigt
- Kontrollera att "Automatically manage signing" är aktiverat
- Kontrollera att Bundle ID är exakt `com.aplappen.app`

### Problem: "Pod install failed" eller libs saknas
**Lösning:**
```bash
cd ios
rm -rf Pods Podfile.lock
pod repo update
pod install
cd ..
```

### Problem: "GoogleService-Info.plist not found"
**Lösning:**
- Kontrollera att filen finns: `ls ios/Runner/GoogleService-Info.plist`
- Om den saknas, kopiera den från USB-minnet
- I Xcode: högerklicka på Runner-mappen > Add Files to "Runner" > välj GoogleService-Info.plist
- Kontrollera att "Copy items if needed" OCH "Runner" target är ikryssade

### Problem: Archive skapar inte körbar app
**Lösning:**
- Kontrollera att du valt "Any iOS Device (arm64)" INTE "iPhone simulator"
- Rensa build-katalogen: Product > Clean Build Folder (Cmd+Shift+K)
- Försök igen: Product > Archive

### Problem: Upload misslyckas med "Invalid Bundle"
**Lösning:**
- Kontrollera att version och build-nummer är korrekta (1.0.1 build 2)
- Kontrollera att alla pods är korrekt installerade
- Försök igen med Product > Clean Build Folder först

### Problem: Appen kraschar vid start på device
**Lösning:**
- Kontrollera console-loggar i Xcode medan appen körs
- Vanligaste orsaken: GoogleService-Info.plist saknas eller har fel Bundle ID
- Försök med en helt ny build: Clean Build Folder + Build Again

---

## ✅ Checklista – Klart när:

- [ ] Xcode kan öppna `Runner.xcworkspace` utan fel
- [ ] Signering är konfigurerad med rätt Team och Bundle ID
- [ ] Appen kan köras på fysisk iPhone utan krasch
- [ ] Inloggning och Firebase-funktioner fungerar på device
- [ ] Archive skapades framgångsrikt (visas i Organizer)
- [ ] Build uppladdades till App Store Connect
- [ ] Build är synlig i TestFlight (efter processing)
- [ ] Intern testare kan installera och köra appen från TestFlight

---

## 📞 Support

Om du kör fast:

1. Läs felmeddelandet noga i Xcode (högst upp i build-output)
2. Sök på Stack Overflow eller Flutter Discord
3. Kontrollera Apple Developer Forums
4. Dokumentera felet med skärmdump för senare felsökning

**Viktiga checkpoints att dokumentera:**
- Lyckades `pod install`? (Ja/Nej + eventuellt felmeddelande)
- Öppnades workspace korrekt? (Ja/Nej)
- Signering fungerade? (Ja/Nej + team valt)
- Kördes appen på device? (Ja/Nej + krasch eller OK)
- Archive skapades? (Ja/Nej)
- Upload lyckades? (Ja/Nej)

---

## 📊 Förväntad tidsåtgång

- **Setup och pod install:** 10-15 min
- **Xcode-konfiguration:** 5-10 min
- **Device-test:** 5-10 min
- **Archive och upload:** 20-40 min
- **App Store processing:** 15-60 min
- **TestFlight-test:** 10-15 min

**Total:** ~2-3 timmar (inkl. väntetid)

---

**Lycka till! 🚀**

När du är klar, dokumentera resultatet så det kan uppdateras i `RELEASE_READINESS_CHECKLIST.md` senare.
