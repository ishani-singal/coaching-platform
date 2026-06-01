#!/usr/bin/env pwsh
# Multi-Agent Deployment Script for Azure
# Run from project root: .\deploy-multi-agent.ps1

$ErrorActionPreference = "Stop"

Write-Host "🚀 Multi-Agent Deployment to Azure" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$ACR_NAME = "coachingplatformprod"
$IMAGE_NAME = "coaching-multi-agent"
$IMAGE_TAG = "v1.0.0"
$RESOURCE_GROUP = "coaching-platform-prod-rg"
$FULL_IMAGE = "$ACR_NAME.azurecr.io/${IMAGE_NAME}:${IMAGE_TAG}"

# Step 1: Login to Azure and ACR
Write-Host "📝 Step 1: Logging in to Azure..." -ForegroundColor Yellow
az login --only-show-errors
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Azure login failed" -ForegroundColor Red
    exit 1
}

Write-Host "📝 Step 1: Logging in to Azure Container Registry..." -ForegroundColor Yellow
az acr login --name $ACR_NAME
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ ACR login failed" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Logged in successfully" -ForegroundColor Green
Write-Host ""

# Step 2: Build multi-agent Docker image
Write-Host "🔨 Step 2: Building multi-agent container..." -ForegroundColor Yellow
Write-Host "   Image: $FULL_IMAGE" -ForegroundColor Gray
docker build `
    --build-arg AGENT_MODE=multi `
    -f Dockerfile.agent `
    -t "${FULL_IMAGE}" `
    -t "$ACR_NAME.azurecr.io/${IMAGE_NAME}:latest" `
    .

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker build failed" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Build complete" -ForegroundColor Green
Write-Host ""

# Step 3: Push to ACR
Write-Host "📤 Step 3: Pushing image to Azure Container Registry..." -ForegroundColor Yellow
docker push "${FULL_IMAGE}"
docker push "$ACR_NAME.azurecr.io/${IMAGE_NAME}:latest"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker push failed" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Image pushed successfully" -ForegroundColor Green
Write-Host ""

# Step 4: Verify image exists
Write-Host "🔍 Step 4: Verifying image in ACR..." -ForegroundColor Yellow
$imageInfo = az acr repository show --name $ACR_NAME --image "${IMAGE_NAME}:${IMAGE_TAG}" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Image verification failed" -ForegroundColor Red
    Write-Host $imageInfo -ForegroundColor Red
    exit 1
}
Write-Host "✅ Image verified in ACR" -ForegroundColor Green
Write-Host ""

# Step 5: Deploy Bicep infrastructure
Write-Host "☁️  Step 5: Deploying infrastructure to Azure..." -ForegroundColor Yellow
Write-Host "   This will:" -ForegroundColor Gray
Write-Host "   - Delete 7 existing container apps (coachprod-01 to coachprod-07)" -ForegroundColor Gray
Write-Host "   - Create 1 new multi-agent container app (coachprod-multi)" -ForegroundColor Gray
Write-Host "   - ~70% cost reduction ($180-250/mo → $50-75/mo)" -ForegroundColor Gray
Write-Host ""

$confirm = Read-Host "   Proceed with deployment? (yes/no)"
if ($confirm -ne "yes") {
    Write-Host "⚠️  Deployment cancelled by user" -ForegroundColor Yellow
    exit 0
}

cd azure
az deployment group create `
    --resource-group $RESOURCE_GROUP `
    --template-file main.bicep `
    --parameters environment=prod `
    --parameters location=centralus `
    --parameters projectName=coaching-platform `
    --verbose

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Deployment failed" -ForegroundColor Red
    exit 1
}
cd ..

Write-Host "✅ Infrastructure deployed" -ForegroundColor Green
Write-Host ""

# Step 6: Get multi-agent URL
Write-Host "🔗 Step 6: Getting multi-agent URL..." -ForegroundColor Yellow
$multiAgentUrl = az containerapp show `
    --name coachprod-multi `
    --resource-group $RESOURCE_GROUP `
    --query "properties.configuration.ingress.fqdn" `
    -o tsv

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to get multi-agent URL" -ForegroundColor Red
    exit 1
}

$multiAgentUrl = "https://$multiAgentUrl"
Write-Host "✅ Multi-agent URL: $multiAgentUrl" -ForegroundColor Green
Write-Host ""

# Step 7: Test health endpoint
Write-Host "🏥 Step 7: Testing health endpoint..." -ForegroundColor Yellow
Start-Sleep -Seconds 10  # Wait for container to start

$healthResponse = curl -s "$multiAgentUrl/health"
if ($healthResponse -match '"status":"ok"') {
    Write-Host "✅ Health check passed!" -ForegroundColor Green
    Write-Host $healthResponse -ForegroundColor Gray
} else {
    Write-Host "⚠️  Health check returned unexpected response" -ForegroundColor Yellow
    Write-Host $healthResponse -ForegroundColor Gray
}
Write-Host ""

# Step 8: Update shell environment
Write-Host "⚙️  Step 8: Updating shell app configuration..." -ForegroundColor Yellow
Write-Host "   Setting MULTI_AGENT_MODE=true and MULTI_AGENT_BASE_URL..." -ForegroundColor Gray

az webapp config appsettings set `
    --name coaching-platform-prod-shell `
    --resource-group $RESOURCE_GROUP `
    --settings `
        MULTI_AGENT_MODE=true `
        MULTI_AGENT_BASE_URL=$multiAgentUrl `
    --query "[?name=='MULTI_AGENT_MODE' || name=='MULTI_AGENT_BASE_URL'].{name:name,value:value}" `
    -o table

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to update shell app settings" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Shell app configured" -ForegroundColor Green
Write-Host ""

# Step 9: Restart shell app
Write-Host "🔄 Step 9: Restarting shell app..." -ForegroundColor Yellow
az webapp restart `
    --name coaching-platform-prod-shell `
    --resource-group $RESOURCE_GROUP

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to restart shell app" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Shell app restarted" -ForegroundColor Green
Write-Host ""

# Summary
Write-Host "🎉 Deployment Complete!" -ForegroundColor Green
Write-Host "======================" -ForegroundColor Green
Write-Host ""
Write-Host "Multi-Agent URL: $multiAgentUrl" -ForegroundColor Cyan
Write-Host ""
Write-Host "Agent endpoints:" -ForegroundColor White
Write-Host "  • $multiAgentUrl/program-builder/health" -ForegroundColor Gray
Write-Host "  • $multiAgentUrl/program-runner/health" -ForegroundColor Gray
Write-Host "  • $multiAgentUrl/coach-library/health" -ForegroundColor Gray
Write-Host "  • $multiAgentUrl/persona-chat/health" -ForegroundColor Gray
Write-Host "  • $multiAgentUrl/crm/health" -ForegroundColor Gray
Write-Host "  • $multiAgentUrl/licensing/health" -ForegroundColor Gray
Write-Host "  • $multiAgentUrl/payment/health" -ForegroundColor Gray
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "  1. Test each agent endpoint above" -ForegroundColor Gray
Write-Host "  2. Test your shell app at https://coaching-platform-prod-shell.azurewebsites.net" -ForegroundColor Gray
Write-Host "  3. Monitor logs: az containerapp logs show --name coachprod-multi --resource-group $RESOURCE_GROUP" -ForegroundColor Gray
Write-Host "  4. Check cost reduction in Azure Cost Management after 24 hours" -ForegroundColor Gray
Write-Host ""
Write-Host "💰 Expected savings: ~$130-175/month (~70% reduction)" -ForegroundColor Green
