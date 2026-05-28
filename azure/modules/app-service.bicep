param location string
param projectName string
param environment string
param keyVaultName string
param acrLoginServer string
param acrName string

var appServicePlanName = '${projectName}-${environment}-plan'
var appServiceName = '${projectName}-${environment}-shell'

resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: appServicePlanName
  location: location
  sku: {
    name: 'B2'
    tier: 'Basic'
    capacity: 1
  }
  kind: 'linux'
  properties: {
    reserved: true
  }
}

resource appService 'Microsoft.Web/sites@2023-01-01' = {
  name: appServiceName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'DOCKER|${acrLoginServer}/shell:latest'
      acrUseManagedIdentityCreds: true
      appSettings: [
        {
          name: 'WEBSITES_PORT'
          value: '3000'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '20.11.0'
        }
        {
          name: 'NEXT_PUBLIC_SUPABASE_URL'
          value: '@Microsoft.KeyVault(SecretUri=https://${keyVaultName}.vault.azure.net/secrets/supabase-url/)'
        }
        {
          name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY'
          value: '@Microsoft.KeyVault(SecretUri=https://${keyVaultName}.vault.azure.net/secrets/supabase-anon-key/)'
        }
        {
          name: 'SUPABASE_URL'
          value: '@Microsoft.KeyVault(SecretUri=https://${keyVaultName}.vault.azure.net/secrets/supabase-url/)'
        }
        {
          name: 'SUPABASE_ANON_KEY'
          value: '@Microsoft.KeyVault(SecretUri=https://${keyVaultName}.vault.azure.net/secrets/supabase-anon-key/)'
        }
        {
          name: 'SUPABASE_SERVICE_ROLE_KEY'
          value: '@Microsoft.KeyVault(SecretUri=https://${keyVaultName}.vault.azure.net/secrets/supabase-service-role-key/)'
        }
        {
          name: 'GEMINI_API_KEY'
          value: '@Microsoft.KeyVault(SecretUri=https://${keyVaultName}.vault.azure.net/secrets/gemini-api-key/)'
        }
        {
          name: 'AZURE_OPENAI_API_KEY'
          value: '@Microsoft.KeyVault(SecretUri=https://${keyVaultName}.vault.azure.net/secrets/azure-openai-api-key/)'
        }
        {
          name: 'AZURE_OPENAI_ENDPOINT'
          value: '@Microsoft.KeyVault(SecretUri=https://${keyVaultName}.vault.azure.net/secrets/azure-openai-endpoint/)'
        }
        {
          name: 'AZURE_OPENAI_DEPLOYMENT'
          value: 'Phi-4-mini-reasoning-1'
        }
        {
          name: 'SHELL_INTERNAL_TOKEN'
          value: '@Microsoft.KeyVault(SecretUri=https://${keyVaultName}.vault.azure.net/secrets/shell-internal-token/)'
        }
      ]
    }
  }
}

// Grant the App Service managed identity AcrPull role on the container registry
resource acrResource 'Microsoft.ContainerRegistry/registries@2023-01-01-preview' existing = {
  name: acrName
}

resource acrPullRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(appService.id, acrResource.id, 'AcrPull')
  scope: acrResource
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
    principalId: appService.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

output appServiceName string = appService.name
output appServiceUrl string = appService.properties.defaultHostName
