# iOS TestFlight pa Mac

Senast uppdaterad: 2026-04-07

Den har guiden ar nasta steg efter att bundle ID och Firebase iOS-app redan har forberetts i repot.

## Forutsattningar
- Xcode ar installerat och oppnat minst en gang.
- Du ar inloggad i Xcode med samma Apple Developer-konto som ager appen.
- Bundle ID ar `com.aplappen.app`.
- Appversion i Flutter ar `1.0.1+2`.

## 1. Forsta setup pa Mac
Kors i projektets rot:

```bash
flutter pub get
cd ios
pod install
cd ..
open ios/Runner.xcworkspace
```

Om `pod install` saknas:

```bash
sudo gem install cocoapods
```

Om CocoaPods klagar pa gamla specs:

```bash
cd ios
pod repo update
pod install
```

## 2. Kontrollera projektet i Xcode
Oppna `Runner.xcworkspace` och verifiera under `Runner > Signing & Capabilities`:

- Team ar valt.
- `Automatically manage signing` ar aktivt.
- Bundle Identifier ar `com.aplappen.app`.

Verifiera under `Runner > General`:

- Display Name ar korrekt.
- Version ar `1.0.1`.
- Build ar `2`.
- Deployment Target ar minst `iOS 13.0`.

Om Xcode vill skapa certifikat eller provisioning profile, lat Xcode gora det automatiskt.

## 3. Bygg och snabbtesta pa en fysisk iPhone
I Xcode:

- Valj en fysisk iPhone som target.
- Kor appen en gang i `Release` eller vanlig run for att verifiera signering.
- Testa inloggning, QR-skanning och ett enkelt karnflode.

Om du far fel om utvecklarcertifikat pa telefonen, godkann profilen pa enheten och kor igen.

## 4. Skapa arkiv
I Xcode:

- Valj `Any iOS Device (arm64)` eller motsvarande generic iOS destination.
- Ga till `Product > Archive`.
- Vanta tills `Organizer` oppnas och kontrollera att senaste arkivet ar `1.0.1 (2)`.

## 5. Ladda upp till TestFlight
I `Organizer`:

- Valj senaste arkivet.
- Klicka `Distribute App`.
- Valj `App Store Connect`.
- Valj `Upload`.
- Behall standardval om inte Xcode visar ett konkret blockerande fel.

Nar uppladdningen ar klar:

- Oppna App Store Connect.
- Ga till appen och sedan `TestFlight`.
- Vanta pa processing.
- Fyll i eventuell export compliance om Apple ber om det.
- Lagg till interna testare for forsta validering.

## 6. Rekommenderad forsta TestFlight-validering
Verifiera minst:

- Inloggning och glomt losenord.
- Lararflode for att se elevdata.
- Elevflode for att se eller skicka relevant data.
- QR-skanning.
- Firebase-baserade vyer som laddar data utan fel.

## Vanliga problem
`GoogleService-Info.plist` hittas inte:
- Kontrollera att filen finns i `ios/Runner/GoogleService-Info.plist` och ar inkluderad i Runner-target.

Signering misslyckas:
- Kontrollera att Team ar valt och att `Automatically manage signing` ar aktivt.
- Kontrollera att bundle ID fortfarande ar `com.aplappen.app`.

Pods bygger inte:
- Kor `flutter pub get` igen.
- Kor sedan `cd ios && pod repo update && pod install`.
- Oppna alltid `Runner.xcworkspace`, inte `Runner.xcodeproj`.

## Klart nar
- Appen kan koras pa fysisk iPhone.
- Xcode kan skapa archive utan signeringsfel.
- Builden ar uppladdad till TestFlight.
- Intern testare kan installera builden.