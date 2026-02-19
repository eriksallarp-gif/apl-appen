# APL-appen - Cloud Run Deployment Guide

## Förutsättningar

1. **Google Cloud SDK** installerad
   ```bash
   # Windows: https://cloud.google.com/sdk/docs/install#windows
   ```

2. **gcloud CLI** konfigurerad
   ```bash
   gcloud auth login
   gcloud config set project apl-appen-aa472
   ```

3. **Docker** installerad (för lokal testing)

## Deployment till Cloud Run

### Steg 1: Bygg och push Docker-image till Artifact Registry

```bash
# Aktivera API:er
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com

# Skapa repository (om den inte finns)
gcloud artifacts repositories create apl-appen \
  --repository-format=docker \
  --location=europe-north1

# Bygg och push image
gcloud builds submit web_dashboard \
  --tag=europe-north1-docker.pkg.dev/apl-appen-aa472/apl-appen/web:latest \
  --region=europe-north1
```

### Steg 2: Deploy till Cloud Run

```bash
gcloud run deploy apl-appen-web \
  --image=europe-north1-docker.pkg.dev/apl-appen-aa472/apl-appen/web:latest \
  --platform=managed \
  --region=europe-north1 \
  --allow-unauthenticated \
  --memory=512Mi \
  --cpu=1 \
  --timeout=3600 \
  --set-cloudsql-instances=apl-appen-aa472:europe-north1:apl-appen-db
```

### Steg 3: Anslut Firebase Hosting till Cloud Run

```bash
# Hämta Cloud Run service URL
gcloud run services describe apl-appen-web --region=europe-north1 --format='value(status.url)'

# Firebase Hosting använder redan rewrite i firebase.json
# Bara deploy Firebase Hosting:
firebase deploy --only hosting --project=apl-appen-aa472
```

### Steg 4: Sätt upp custom domain

1. Gå till [Firebase Console](https://console.firebase.google.com/)
2. Välj projekt: `apl-appen-aa472`
3. Gå till Hosting
4. Klicka på "Connect domain"
5. Ange: `apl-appen.com`
6. Följ instruktionerna för att uppdatera DNS i Squarespace

## DNS Setup i Squarespace

Efter att du triggat "Connect domain" i Firebase Hosting:

1. Gå till Squarespace Domain Settings
2. Uppdatera DNS Records med värdena Firebase ger dig
3. Vanligtvis två A records och ett CNAME record
4. Kan ta 5-48 timmar för DNS propagation

## Lokal Development

```bash
cd web_dashboard
npm run dev
# Körs på http://localhost:3001
```

## Monitorering

```bash
# Se logs
gcloud run logs read apl-appen-web --limit=50 --region=europe-north1

# Se real-time logs
gcloud run logs read apl-appen-web --region=europe-north1 --follow
```

## Environment Variables (om behövs)

För att lägga till environment variables i Cloud Run:

```bash
gcloud run services update apl-appen-web \
  --region=europe-north1 \
  --set-env-vars=KEY=value
```

## Troubleshooting

**Problem: "Service account lacks necessary permissions"**
```bash
# Ge permissions till Cloud Run service account
gcloud projects add-iam-policy-binding apl-appen-aa472 \
  --member=serviceAccount:apl-appen-web@appspot.gserviceaccount.com \
  --role=roles/datastore.user
```

**Problem: "Container failed to start"**
```bash
# Se detaljerade logs
gcloud run logs read apl-appen-web --limit=100 --region=europe-north1
```

## Kostnader

- Cloud Run: **Gratis** för ~2 miljon requester/månad
- Artifact Registry: **Gratis** för lagring
- Firebase Hosting: **Gratis** custom domain
