targetScope = 'subscription'

param location string = 'centralus'
param environment string = 'prod'
param projectName string = 'coaching-platform'

var resourceGroupName = '${projectName}-${environment}-rg'
var containerRegistryName = replace('${projectName}${environment}', '-', '')

// Create resource group
resource rg 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: resourceGroupName
  location: location
}

// Deploy all resources
module acr 'modules/acr.bicep' = {
  scope: rg
  name: 'acr-deployment'
  params: {
    location: location
    registryName: containerRegistryName
  }
}

module keyVault 'modules/keyvault.bicep' = {
  scope: rg
  name: 'keyvault-deployment'
  params: {
    location: location
    environment: environment
  }
}

module containerApps 'modules/container-apps.bicep' = {
  scope: rg
  name: 'container-apps-deployment'
  params: {
    location: location
    projectName: projectName
    environment: environment
  }
}

module appService 'modules/app-service.bicep' = {
  scope: rg
  name: 'app-service-deployment'
  params: {
    location: location
    projectName: projectName
    environment: environment
    keyVaultName: keyVault.outputs.keyVaultName
  }
}

output resourceGroupName string = rg.name
output registryLoginServer string = acr.outputs.loginServer
output containerAppsEnvironmentName string = containerApps.outputs.environmentName
output appServiceName string = appService.outputs.appServiceName
