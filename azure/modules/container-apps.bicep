param location string
param projectName string
param environment string

var containerAppsEnvName = '${projectName}-${environment}-env'

resource containerAppsEnv 'Microsoft.App/managedEnvironments@2023-04-01-preview' = {
  name: containerAppsEnvName
  location: location
  properties: {}
}

// Multi-Agent Container App (all 7 agents in a single container)
// Deployed with a public placeholder image; secrets + real image are injected
// by the seed-secrets and deploy-agents workflow jobs that run after this.
resource multiAgentApp 'Microsoft.App/containerApps@2023-04-01-preview' = {
  name: 'coachprod-multi'
  location: location
  properties: {
    managedEnvironmentId: containerAppsEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 3000
      }
    }
    template: {
      containers: [
        {
          name: 'multi-agent'
          image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
          resources: {
            cpu: json('2.0')
            memory: '4Gi'
          }
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 5
      }
    }
  }
}

// Shell Container App (Next.js frontend)
// Deployed with a public placeholder image; secrets + real image are injected
// by the seed-secrets and deploy-shell workflow jobs that run after this.
resource shellApp 'Microsoft.App/containerApps@2023-04-01-preview' = {
  name: 'coachprod-shell'
  location: location
  properties: {
    managedEnvironmentId: containerAppsEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 3000
      }
    }
    template: {
      containers: [
        {
          name: 'shell'
          image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
      }
    }
  }
}

output environmentName string = containerAppsEnv.name
output multiAgentUrl string = multiAgentApp.properties.configuration.ingress.fqdn
output shellUrl string = shellApp.properties.configuration.ingress.fqdn
