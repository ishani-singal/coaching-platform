targetScope = 'subscription'

param location string = 'centralus'
param environment string = 'prod'
param projectName string = 'coaching-platform'
param ghcrOwner string

var resourceGroupName = '${projectName}-v2-rg'

resource rg 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: resourceGroupName
  location: location
}

module containerApps 'modules/container-apps.bicep' = {
  scope: rg
  name: 'container-apps-deployment'
  params: {
    location: location
    projectName: projectName
    environment: environment
    ghcrOwner: ghcrOwner
  }
}

output resourceGroupName string = rg.name
output containerAppsEnvironmentName string = containerApps.outputs.environmentName
output multiAgentUrl string = containerApps.outputs.multiAgentUrl
output shellUrl string = containerApps.outputs.shellUrl
