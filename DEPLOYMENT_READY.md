# CLOUD RUN DEPLOYMENT GUIDE

## Status: Docker Build in Progress ✅

Build ID: `545cb25c-cd97-4597-be3c-88c913129364`
Status: WORKING (będzie gotowy za ~10-15 minut)

---

## Step 1: Verifiera Docker Image (när bygget är klart)

```powershell
$gcloudPath = "C:\Users\$env:USERNAME\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin"
$env:Path += ";$gcloudPath"

# Kontrollera om image finns
gcloud artifacts docker images list europe-north1-docker.pkg.dev/apl-appen-aa472/apl-appen
```

**Förväntat resultat:**
```
europe-north1-docker.pkg.dev/apl-appen-aa472/apl-appen/web
```

---

## Step 2: Deploy till Cloud Run

```powershell
$gcloudPath = "C:\Users\$env:USERNAME\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin"
$env:Path += ";$gcloudPath"

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

**Vänta tills du får:**
```
Service [apl-appen-web] deployed successfully.
URL: https://apl-appen-web-xxxxx-xx.a.run.app
```

---

## Step 3: Hämta Cloud Run Service URL

```powershell
$gcloudPath = "C:\Users\$env:USERNAME\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin"
$env:Path += ";$gcloudPath"

gcloud run services describe apl-appen-web `
  --region=europe-north1 `
  --format='value(status.url)'
```

**Spara denna URL - du behöver den senare**

---

## Step 4: Deploy Firebase Hosting

```powershell
cd d:\apl_appen
firebase deploy --only hosting --project=apl-appen-aa472
```

---

## Step 5: Uppdatera DNS i Squarespace

1. Gå till Firebase Console: https://console.firebase.google.com/
2. Välj `apl-appen-aa472` projekt
3. Gå till **Hosting** i menyn
4. Klicka **Connect domain**
5. Ange `apl-appen.com`
6. Följ instruktionerna för DNS-records

**Firebase kommer att ge dig 2-3 DNS-records att lägga in i Squarespace Admin:**
- Vanligtvis två A-records för IPv4
- Eventuellt AAAA-record för IPv6

Lägg in dessa i:
- Squarespace > Domains > apl-appen.com > DNS

---

## Monitoring

```powershell
$gcloudPath = "C:\Users\$env:USERNAME\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin"
$env:Path += ";$gcloudPath"

# Se logs från Cloud Run
gcloud run logs read apl-appen-web `
  --region=europe-north1 `
  --limit=50

# Real-time monitoring
gcloud run logs read apl-appen-web `
  --region=europe-north1 `
  --limit=20
```

---

## Troubleshooting

**Problem: "Service account lacks necessary permissions"**
```powershell
gcloud projects add-iam-policy-binding apl-appen-aa472 `
  --member=serviceAccount:apl-appen-web@appspot.gserviceaccount.com `
  --role=roles/datastore.user
```

**Problem: "Container failed to start"**
```powershell
$gcloudPath = "C:\Users\$env:USERNAME\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin"
$env:Path += ";$gcloudPath"

gcloud run logs read apl-appen-web `
  --region=europe-north1 `
  --limit=100
```

**Problem: "Domain already exists"**
- Gå till Firebase Console
- Hosting > Domains
- Ta bort befintlig domain-binding
- Gör om från steg 5

---

## Expected Timeline

1. **Docker Build**: ~10-15 minuter (pågår nu ✅)
2. **Cloud Run Deploy**: ~2-3 minuter
3. **Firebase Hosting Deploy**: ~1 minut
4. **DNS Propagation**: 5 minuter - 48 timmar
   - Kan testa med: `nslookup apl-appen.com`

---

## Verification

```powershell
# Efter att allt är deployat:
# 1. Öppna https://apl-appen-web-xxxxx.a.run.app (Cloud Run URL)
# 2. Öppna https://apl-appen.com (Custom domain - när DNS är propagerad)
# 3. Gå till /login för att verifiera Firebase Auth
# 4. Gå till /dashboard för att verifiera Firestore access
```

---

## Rollback om något går fel

```powershell
$gcloudPath = "C:\Users\$env:USERNAME\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin"
$env:Path += ";$gcloudPath"

# Ta bort Cloud Run service
gcloud run services delete apl-appen-web `
  --region=europe-north1 `
  --project=apl-appen-aa472

# Cloud Build kan inte rollbackas, men du kan deploya tidigare version
# eller radera image och bygga om
```

---

## Nästa steg när Docker-build är klar

Jag kommer automatiskt att:
1. ✅ Kontrollera build-status
2. 🔄 Köra Cloud Run deployment
3. 📍 Hämta service URL
4. 🔥 Deploy Firebase Hosting
5. 📋 Ge dig DNS-instruktioner för Squarespace
