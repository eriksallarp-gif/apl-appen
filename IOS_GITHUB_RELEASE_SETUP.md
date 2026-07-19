# iOS Release Via GitHub Actions (utan lokal Mac)

Denna guide beskriver hur du bygger och laddar upp iOS-build till TestFlight via GitHub Actions (`macos` runner).

## 1. Vad som redan finns

Workflow-filen finns i:

- [.github/workflows/ios-testflight.yml](.github/workflows/ios-testflight.yml)

Workflow körs manuellt via **Actions > iOS Build and TestFlight > Run workflow**.

## 2. GitHub-secrets du måste lägga till

I GitHub-repot, gå till:

- **Settings > Secrets and variables > Actions > New repository secret**

Lägg till dessa secrets:

1. `IOS_DIST_CERT_P12_BASE64`
   - Base64 av ditt iOS distribution-certifikat i `.p12` format.

2. `IOS_DIST_CERT_PASSWORD`
   - Lösenordet till `.p12`-filen.

3. `IOS_PROVISIONING_PROFILE_BASE64`
   - Base64 av provisioning profile (`.mobileprovision`) för App Store distribution.

4. `IOS_KEYCHAIN_PASSWORD`
   - Ett valfritt starkt lösenord (används till tillfällig keychain i CI).

5. `APPSTORE_API_KEY_ID`
   - Key ID från App Store Connect API-nyckeln.

6. `APPSTORE_API_ISSUER_ID`
   - Issuer ID från App Store Connect API-nyckeln.

7. `APPSTORE_API_PRIVATE_KEY`
   - Innehållet i `.p8`-filen (inklusive BEGIN/END-rader).

## 3. Hur du kör workflow

1. Gå till **Actions** i GitHub.
2. Välj **iOS Build and TestFlight**.
3. Klicka **Run workflow**.
4. Sätt:
   - `build_number`: måste vara unikt och högre än tidigare iOS-build i App Store Connect.
   - `upload_to_testflight`: `true` om du vill ladda upp automatiskt.
5. Starta workflow.

## 4. Resultat

- IPA laddas alltid upp som GitHub artifact.
- Om `upload_to_testflight=true` och API-secrets är rätt satta, laddas IPA också upp till TestFlight.

## 5. Vanliga fel

1. **Code signing error**
   - Kontrollera att certifikat + provisioning profile hör ihop med samma app (`com.aplappen.app`).

2. **Version/build already used**
   - Höj `build_number` i workflow-körningen.

3. **Missing App Store API key**
   - Kontrollera `APPSTORE_API_KEY_ID`, `APPSTORE_API_ISSUER_ID`, `APPSTORE_API_PRIVATE_KEY`.

## 6. Hjälpkommando: skapa base64 lokalt

Exempel i PowerShell (Windows):

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\file.p12"))
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\profile.mobileprovision"))
```

Kopiera resultatet till respektive GitHub secret.
