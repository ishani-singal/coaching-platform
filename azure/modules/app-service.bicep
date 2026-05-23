param location string
param projectName string
param environment string
param keyVaultName string

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
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      nodeVersion: '20-lts'
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

output appServiceName string = appService.name
output appServiceUrl string = appService.properties.defaultHostName
