#!/bin/bash
# Cloud Run Deployment Script

PROJECT_ID="apl-appen-aa472"
REGION="europe-north1"
SERVICE_NAME="apl-appen-web"
IMAGE="europe-north1-docker.pkg.dev/apl-appen-aa472/apl-appen/web:latest"

# Step 1: Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image=$IMAGE \
  --platform=managed \
  --region=$REGION \
  --allow-unauthenticated \
  --memory=512Mi \
  --cpu=1 \
  --timeout=3600 \
  --project=$PROJECT_ID

# Step 2: Get the service URL
echo "📍 Getting Cloud Run URL..."
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --format='value(status.url)')

echo "✅ Cloud Run Service URL: $SERVICE_URL"

# Step 3: Deploy Firebase Hosting
echo "🔥 Deploying Firebase Hosting..."
firebase deploy --only hosting --project=$PROJECT_ID

echo "✨ Deployment complete!"
echo "Visit: $SERVICE_URL"
