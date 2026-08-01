# iOS-uppdatering via lånad Mac och GitHub Actions

Den här guiden är för dig som byggt iOS tidigare på en Mac, men nu jobbar på Windows och vill fortsätta uppdatera App Store via GitHub Actions.

## Mål

1. Exportera iOS-signering från Macen (.p12).
2. Hämta eller bekräfta provisioning profile (.mobileprovision).
3. Lägga in secrets i GitHub.
4. Köra workflow för iOS build och TestFlight-upload.

## Del 1: På den lånade Macen

### 1. Öppna Keychain Access

1. Öppna Spotlight.
2. Sök efter Keychain Access.
3. Öppna appen.

### 2. Exportera Apple Distribution-certifikat som .p12

1. I Keychain Access, välj login-keychain och kategorin My Certificates.
2. Leta upp ett certifikat som heter Apple Distribution och som har en privat nyckel under sig.
3. Högerklicka certifikatet och välj Export.
4. Spara som filtyp Personal Information Exchange (.p12), till exempel:
	apl-appen-distribution.p12
5. Ange ett starkt export-lösenord och spara det säkert.

Viktigt:
Om du inte ser privat nyckel under certifikatet går det inte att exportera korrekt .p12. Då behöver certifikatet skapas om i den Mac-miljön.

### 3. Hämta provisioning profile (.mobileprovision)

Du har redan en profil i Windows enligt tidigare kontroll:

C:\Users\eriks\Downloads\Eric_Sllarp.mobileprovision

Om du vill skapa en ny från Apple Developer Portal går det också bra. Se till att den matchar:

1. Bundle ID: com.aplappen.app
2. Distribution-typ: App Store
3. Samma Apple Distribution-certifikat som du exporterade .p12 från

### 4. Flytta filerna säkert till din Windows-dator

Flytta dessa två filer:

1. apl-appen-distribution.p12
2. Eric_Sllarp.mobileprovision (eller ny profil)

## Del 2: På Windows (VS Code/PowerShell)

### 5. Konvertera filer till Base64

Kör i PowerShell med riktiga sökvägar:

	 [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\sokvag\apl-appen-distribution.p12"))

	 [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\sokvag\Eric_Sllarp.mobileprovision"))

Kopiera utdata till temporär textfil lokalt. Dela aldrig dessa värden offentligt.

### 6. Lägg in GitHub repository secrets

I GitHub-repot:

Settings > Secrets and variables > Actions > New repository secret

Skapa dessa secrets:

1. IOS_DIST_CERT_P12_BASE64
	Värde: base64 från .p12

2. IOS_DIST_CERT_PASSWORD
	Värde: lösenordet du satte när du exporterade .p12

3. IOS_PROVISIONING_PROFILE_BASE64
	Värde: base64 från .mobileprovision

4. IOS_KEYCHAIN_PASSWORD
	Värde: valfritt starkt lösenord för CI keychain

5. APPSTORE_API_KEY_ID
	Värde: från App Store Connect API-nyckel

6. APPSTORE_API_ISSUER_ID
	Värde: från App Store Connect API-nyckel

7. APPSTORE_API_PRIVATE_KEY
	Värde: hela innehållet i .p8-filen (inklusive BEGIN/END-rader)

## Del 3: Kör iOS-workflow i GitHub

Workflow-fil i repot:

.github/workflows/ios-testflight.yml

Steg:

1. Gå till Actions i repot.
2. Välj iOS Build and TestFlight.
3. Klicka Run workflow.
4. Sätt build_number till ett nytt unikt nummer, till exempel 5 eller högre.
5. Låt Upload IPA to TestFlight vara ikryssad.
6. Starta körningen.

## Del 4: Kontrollera i App Store Connect

1. Gå till TestFlight-fliken för appen.
2. Vänta på processing (kan ta 15 till 60 minuter).
3. När builden är klar, koppla den till version 1.0.2 under Distribution.
4. Fyll i What’s New och skicka för review.

## Vanliga fel och snabb lösning

1. Fel: No signing certificate/private key
	Orsak: .p12 saknar privat nyckel eller fel certifikat.
	Lösning: exportera om från rätt Apple Distribution-certifikat i Keychain Access.

2. Fel: Provisioning profile does not match bundle id
	Orsak: profilen är inte för com.aplappen.app.
	Lösning: skapa ny App Store profile för rätt bundle id.

3. Fel: Build number already used
	Orsak: build_number finns redan i App Store Connect.
	Lösning: kör workflow igen med högre build_number.

4. Fel: Unauthorized vid upload till TestFlight
	Orsak: App Store Connect API-secrets är fel.
	Lösning: kontrollera APPSTORE_API_KEY_ID, APPSTORE_API_ISSUER_ID och APPSTORE_API_PRIVATE_KEY.

## Säkerhet

1. Lägg aldrig .p12, .p8 eller lösenord i git.
2. Spara allt känsligt i GitHub Secrets.
3. Radera temporära textfiler med base64 efter att secrets är satta.

