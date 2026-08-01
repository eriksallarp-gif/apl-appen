# 🚀 Deployment Guide - Firebase Security Rules

## Översikt
Denna guide beskriver hur du deployar de nya Firebase Security Rules till ditt projekt.

## Förkunskaper
- Firebase CLI installerad (`npm install -g firebase-tools`)
- Inloggad i Firebase (`firebase login`)

## Steg-för-steg deployment

### 1. Verifiera Firebase-projekt
```bash
firebase projects:list
```

### 2. Initiera Firebase (om inte redan gjort)
```bash
firebase init
```
- Välj **Firestore** när du blir tillfrågad
- Välj ditt befintliga projekt: **apl-appen-aa472**
- Acceptera `firestore.rules` som rules-fil

### 3. Deploya Security Rules
```bash
firebase deploy --only firestore:rules
```

### 4. Verifiera deployment
Efter deployment kan du verifiera rules i Firebase Console:
1. Gå till [Firebase Console](https://console.firebase.google.com)
2. Välj projektet **apl-appen-aa472**
3. Navigera till **Firestore Database** → **Rules**
4. Kontrollera att reglerna är uppdaterade

## ⚠️ Viktigt!

### Första gången du deployar
Om du aldrig har kört Firebase Security Rules tidigare kommer ALL DATA att bli otillgänglig tills reglerna är deployade. Detta är normalt - reglerna skyddar din data.

### Testning av rules
Efter deployment bör du:
1. Testa att elever kan läsa/skriva sina egna tidkort
2. Testa att lärare kan godkänna tidkort
3. Verifiera att elever INTE kan redigera godkända/låsta tidkort
4. Kontrollera att obehöriga inte kan läsa data

### Rollback vid problem
Om något går fel kan du snabbt återställa till "öppna" rules (ENDAST FÖR DEBUG):

```bash
# VARNING: Detta gör databasen öppen för alla!
# Använd ENDAST för felsökning
```

I Firebase Console → Rules, ersätt temporärt med:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 📋 Vad reglerna gör

### Elever kan:
- ✅ Läsa sin egen profil
- ✅ Skapa nya tidkort
- ✅ Redigera sina egna tidkort (om inte godkända/låsta)
- ✅ Läsa sina bedömningar och ersättningar
- ❌ INTE redigera andra elevers data
- ❌ INTE godkänna sina egna tidkort

### Lärare kan:
- ✅ Läsa alla användare (för namnuppslagning)
- ✅ Skapa och hantera klasser
- ✅ Godkänna/avslå tidkort
- ✅ Skapa bedömningar
- ✅ Hantera ersättningar
- ✅ Skicka meddelanden

### Admins kan:
- ✅ Fullständig åtkomst till allt

## 🔧 Felsökning

### "Permission denied" fel
Detta betyder att reglerna fungerar! Om du får detta fel:
1. Kontrollera att användaren har rätt roll i `users` collection
2. Verifiera att `teacherUid` och `classId` är korrekt satta
3. Kontrollera Firebase Console → Rules → Simulator

### Rules simulering
Du kan testa rules direkt i Firebase Console:
1. Gå till **Firestore Database** → **Rules** → **Rules Playground**
2. Välj operation (read/write)
3. Ange path, t.ex. `/timesheets/student123_2026-02-09`
4. Ange auth UID
5. Kör simulation

## 📚 Dokumentation
- [Firebase Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Testing Rules](https://firebase.google.com/docs/firestore/security/test-rules-emulator)
