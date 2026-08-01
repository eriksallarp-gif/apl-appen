# APL-appen Web Dashboard

En webbaserad administrations portal för APL-appen systemet.

## Installation

1. Installera dependencies:
```bash
npm install
```

2. Kopiera `.env.local.example` till `.env.local` och fyll i dina Firebase-uppgifter från Flutter-appens `firebase_options.dart`

3. Starta utvecklingsservern:
```bash
npm run dev
```

4. Öppna [http://localhost:3001](http://localhost:3001)

## Funktioner

- 📊 Dashboard med statistik och översikt
- 👥 Elevöversikt
- 📝 Tidkortshantering  
- ⭐ Bedömningar från handledare
- 🔗 Supervisor-sida (QR-kod länk från appen)

## Deployment

Bygg för produktion:
```bash
npm run build
npm start
```

Deploy till apl-appen.se när appen är klar.

## Teknologier

- Next.js 14 + TypeScript
- Tailwind CSS
- Firebase (Firestore + Auth)
- Recharts (grafer)
