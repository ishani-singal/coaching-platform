param location string
param projectName string
param environment string

var containerAppsEnvName = '${projectName}-${environment}-env'
var logAnalyticsName = '${projectName}-${environment}-logs'

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logAnalyticsName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
  }
}

resource containerAppsEnv 'Microsoft.App/managedEnvironments@2023-04-01-preview' = {
  name: containerAppsEnvName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

// Multi-Agent Container App (All 7 agents in a single container - ~70% cost savings)
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
          image: 'coachingplatformprod.azurecr.io/coaching-multi-agent:latest'
          resources: {
            cpu: json('2.0')    // 2 vCPU (vs 3.5 vCPU for 7 separate apps)
            memory: '4Gi'       // 4 GiB (vs 7 GiB for 7 separate apps)
          }
          env: [
            { name: 'MULTI_AGENT_MODE', value: 'true' }
            { name: 'MULTI_AGENT_PORT', value: '3000' }
            { name: 'SUPABASE_URL', value: 'https://bthacagrowxgbuhlbcng.supabase.co' }
            { name: 'SUPABASE_ANON_KEY', value: 'REDACTED_SUPABASE_ANON_KEY' }
            { name: 'SUPABASE_SERVICE_ROLE_KEY', value: 'REDACTED_SUPABASE_SERVICE_ROLE_KEY' }
            { name: 'SHELL_INTERNAL_TOKEN', value: '40587f5b3f3b4a9118a0723fd90b810a1d7104fa9e76b8e140e368797ec2a1ca' }
            { name: 'LLM_PROVIDER', value: '' }
            { name: 'AZURE_OPENAI_ENDPOINT', value: 'https://foundry-models-rg.services.ai.azure.com/openai/v1/' }
            { name: 'AZURE_OPENAI_API_KEY', value: 'Cpb6Br9rD38HxPkItL4ajZmJJB1irYwPH136YNobfGqSiFj7BN7mJQQJ99CDACYeBjFXJ3w3AAAAACOGqQuO' }
            { name: 'AZURE_OPENAI_DEPLOYMENT', value: 'Phi-4-mini-reasoning-1' }
            { name: 'AZURE_OPENAI_EMBEDDING_DEPLOYMENT', value: '' }
            { name: 'GEMINI_API_KEY', value: 'REDACTED_GEMINI_API_KEY' }
            { name: 'YOUTUBE_API_KEY', value: 'REDACTED_GEMINI_API_KEY' }
            { name: 'PINECONE_API_KEY', value: 'pcsk_2MJ3WK_Kk8Us4fTsjZsYsk1Pi76aEzAHTWoezk3Ds1yUXDxRqqNFq7gSe1PVmj7oE1jim1' }
            { name: 'PINECONE_INDEX', value: 'coaching-platform' }
            { name: 'RESEND_API_KEY', value: 'REDACTED_RESEND_API_KEY' }
            { name: 'FROM_EMAIL', value: '' }
            { name: 'PLATFORM_DOMAIN', value: 'coaching-platform-prod-shell.azurewebsites.net' }
            { name: 'PLATFORM_CUT_PCT', value: '' }
            { name: 'STRIPE_SECRET_KEY', value: 'REDACTED_STRIPE_SECRET_KEY' }
            { name: 'STRIPE_PUBLISHABLE_KEY', value: '' }
            { name: 'STRIPE_WEBHOOK_SECRET', value: 'whsec_55e3aca3c3bf3cecaf2746d1fb1a8e8091b8a7b78a986d2486560e1b2747579f' }
            { name: 'RAZORPAY_KEY_ID', value: '' }
            { name: 'RAZORPAY_KEY_SECRET', value: '' }
            { name: 'RAZORPAY_WEBHOOK_SECRET', value: '' }
            { name: 'SKILLZ_AGENT_CALENDAR_AGGREGATOR_URL', value: '' }
            { name: 'SKILLZ_AGENT_CUSTOMER_BOOKING_URL', value: '' }
            { name: 'SKILLZ_AGENT_PAYMENT_URL', value: '' }
            { name: 'GOOGLE_CLIENT_ID', value: '785608934518-1ltj9d76l5d9340a9ektf0bvkgi6jktj.apps.googleusercontent.com' }
            { name: 'GOOGLE_CLIENT_SECRET', value: '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' }
            { name: 'GOOGLE_REDIRECT_URI', value: 'https://coaching-platform-prod-shell.azurewebsites.net/api/auth/google-calendar/callback' }
            { name: 'GMAIL_REDIRECT_URI', value: 'https://coaching-platform-prod-shell.azurewebsites.net/api/auth/gmail/callback' }
          ]
        }
      ]
      scale: {
        minReplicas: 1      // Single replica baseline (~70% savings vs 7x min replicas)
        maxReplicas: 5      // Can scale up under load
      }
    }
  }
}

// Individual Agent Container Apps (REPLACED BY MULTI-AGENT ABOVE - kept for reference)
/*
// Agent 01: Program Builder
resource programBuilderApp 'Microsoft.App/containerApps@2023-04-01-preview' = {
  name: 'coachprod-01'
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
          name: 'program-builder'
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

// Agent 02: Program Runner
resource programRunnerApp 'Microsoft.App/containerApps@2023-04-01-preview' = {
  name: 'coachprod-02'
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
          name: 'program-runner'
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

// Agent 03: Coach Library
resource coachLibraryApp 'Microsoft.App/containerApps@2023-04-01-preview' = {
  name: 'coachprod-03'
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
          name: 'coach-library'
          image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 2
      }
    }
  }
}

// Agent 04: Persona Chat
resource personaChatApp 'Microsoft.App/containerApps@2023-04-01-preview' = {
  name: 'coachprod-04'
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
          name: 'persona-chat'
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

// Agent 05: CRM
resource crmApp 'Microsoft.App/containerApps@2023-04-01-preview' = {
  name: 'coachprod-05'
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
          name: 'crm'
          image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 2
      }
    }
  }
}

// Agent 06: Licensing
resource licensingApp 'Microsoft.App/containerApps@2023-04-01-preview' = {
  name: 'coachprod-06'
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
          name: 'licensing'
          image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 2
      }
    }
  }
}

// Agent 07: Payment
resource paymentApp 'Microsoft.App/containerApps@2023-04-01-preview' = {
  name: 'coachprod-07'
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
          name: 'payment'
          image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 2
      }
    }
  }
}
*/

output environmentName string = containerAppsEnv.name
output multiAgentUrl string = multiAgentApp.properties.configuration.ingress.fqdn
