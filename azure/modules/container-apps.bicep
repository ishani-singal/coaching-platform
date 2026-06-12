param location string
param projectName string
param environment string
param ghcrOwner string

var containerAppsEnvName = '${projectName}-${environment}-env'

resource containerAppsEnv 'Microsoft.App/managedEnvironments@2023-04-01-preview' = {
  name: containerAppsEnvName
  location: location
  properties: {}
}

// Shared secrets for both container apps
var sharedSecrets = [
  { name: 'supabase-url', value: '' }
  { name: 'supabase-anon-key', value: '' }
  { name: 'supabase-service-role-key', value: '' }
  { name: 'shell-internal-token', value: '' }
  { name: 'llm-provider', value: '' }
  { name: 'azure-openai-endpoint', value: '' }
  { name: 'azure-openai-api-key', value: '' }
  { name: 'azure-openai-deployment', value: '' }
  { name: 'azure-openai-embedding-deployment', value: '' }
  { name: 'gemini-api-key', value: '' }
  { name: 'youtube-api-key', value: '' }
  { name: 'pinecone-api-key', value: '' }
  { name: 'pinecone-index', value: '' }
  { name: 'resend-api-key', value: '' }
  { name: 'from-email', value: '' }
  { name: 'platform-domain', value: '' }
  { name: 'platform-cut-pct', value: '' }
  { name: 'stripe-secret-key', value: '' }
  { name: 'stripe-publishable-key', value: '' }
  { name: 'stripe-webhook-secret', value: '' }
  { name: 'razorpay-key-id', value: '' }
  { name: 'razorpay-key-secret', value: '' }
  { name: 'razorpay-webhook-secret', value: '' }
  { name: 'google-client-id', value: '' }
  { name: 'google-client-secret', value: '' }
  { name: 'google-redirect-uri', value: '' }
  { name: 'gmail-redirect-uri', value: '' }
  { name: 'ghcr-password', value: '' }
]

// Multi-Agent Container App (all 7 agents in a single container)
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
      registries: [
        {
          server: 'ghcr.io'
          username: ghcrOwner
          passwordSecretRef: 'ghcr-password'
        }
      ]
      secrets: sharedSecrets
    }
    template: {
      containers: [
        {
          name: 'multi-agent'
          image: 'ghcr.io/${ghcrOwner}/coaching-multi-agent:latest'
          resources: {
            cpu: json('2.0')
            memory: '4Gi'
          }
          env: [
            { name: 'MULTI_AGENT_MODE', value: 'true' }
            { name: 'MULTI_AGENT_PORT', value: '3000' }
            { name: 'SUPABASE_URL', secretRef: 'supabase-url' }
            { name: 'SUPABASE_ANON_KEY', secretRef: 'supabase-anon-key' }
            { name: 'SUPABASE_SERVICE_ROLE_KEY', secretRef: 'supabase-service-role-key' }
            { name: 'SHELL_INTERNAL_TOKEN', secretRef: 'shell-internal-token' }
            { name: 'LLM_PROVIDER', secretRef: 'llm-provider' }
            { name: 'AZURE_OPENAI_ENDPOINT', secretRef: 'azure-openai-endpoint' }
            { name: 'AZURE_OPENAI_API_KEY', secretRef: 'azure-openai-api-key' }
            { name: 'AZURE_OPENAI_DEPLOYMENT', secretRef: 'azure-openai-deployment' }
            { name: 'AZURE_OPENAI_EMBEDDING_DEPLOYMENT', secretRef: 'azure-openai-embedding-deployment' }
            { name: 'GEMINI_API_KEY', secretRef: 'gemini-api-key' }
            { name: 'YOUTUBE_API_KEY', secretRef: 'youtube-api-key' }
            { name: 'PINECONE_API_KEY', secretRef: 'pinecone-api-key' }
            { name: 'PINECONE_INDEX', secretRef: 'pinecone-index' }
            { name: 'RESEND_API_KEY', secretRef: 'resend-api-key' }
            { name: 'FROM_EMAIL', secretRef: 'from-email' }
            { name: 'PLATFORM_DOMAIN', secretRef: 'platform-domain' }
            { name: 'PLATFORM_CUT_PCT', secretRef: 'platform-cut-pct' }
            { name: 'STRIPE_SECRET_KEY', secretRef: 'stripe-secret-key' }
            { name: 'STRIPE_PUBLISHABLE_KEY', secretRef: 'stripe-publishable-key' }
            { name: 'STRIPE_WEBHOOK_SECRET', secretRef: 'stripe-webhook-secret' }
            { name: 'RAZORPAY_KEY_ID', secretRef: 'razorpay-key-id' }
            { name: 'RAZORPAY_KEY_SECRET', secretRef: 'razorpay-key-secret' }
            { name: 'RAZORPAY_WEBHOOK_SECRET', secretRef: 'razorpay-webhook-secret' }
            { name: 'GOOGLE_CLIENT_ID', secretRef: 'google-client-id' }
            { name: 'GOOGLE_CLIENT_SECRET', secretRef: 'google-client-secret' }
            { name: 'GOOGLE_REDIRECT_URI', secretRef: 'google-redirect-uri' }
            { name: 'GMAIL_REDIRECT_URI', secretRef: 'gmail-redirect-uri' }
          ]
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
      registries: [
        {
          server: 'ghcr.io'
          username: ghcrOwner
          passwordSecretRef: 'ghcr-password'
        }
      ]
      secrets: sharedSecrets
    }
    template: {
      containers: [
        {
          name: 'shell'
          image: 'ghcr.io/${ghcrOwner}/shell:latest'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            { name: 'NEXT_PUBLIC_SUPABASE_URL', secretRef: 'supabase-url' }
            { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', secretRef: 'supabase-anon-key' }
            { name: 'SUPABASE_URL', secretRef: 'supabase-url' }
            { name: 'SUPABASE_ANON_KEY', secretRef: 'supabase-anon-key' }
            { name: 'SUPABASE_SERVICE_ROLE_KEY', secretRef: 'supabase-service-role-key' }
            { name: 'SHELL_INTERNAL_TOKEN', secretRef: 'shell-internal-token' }
            { name: 'LLM_PROVIDER', secretRef: 'llm-provider' }
            { name: 'AZURE_OPENAI_ENDPOINT', secretRef: 'azure-openai-endpoint' }
            { name: 'AZURE_OPENAI_API_KEY', secretRef: 'azure-openai-api-key' }
            { name: 'AZURE_OPENAI_DEPLOYMENT', secretRef: 'azure-openai-deployment' }
            { name: 'AZURE_OPENAI_EMBEDDING_DEPLOYMENT', secretRef: 'azure-openai-embedding-deployment' }
            { name: 'GEMINI_API_KEY', secretRef: 'gemini-api-key' }
            { name: 'YOUTUBE_API_KEY', secretRef: 'youtube-api-key' }
            { name: 'PINECONE_API_KEY', secretRef: 'pinecone-api-key' }
            { name: 'PINECONE_INDEX', secretRef: 'pinecone-index' }
            { name: 'RESEND_API_KEY', secretRef: 'resend-api-key' }
            { name: 'FROM_EMAIL', secretRef: 'from-email' }
            { name: 'PLATFORM_DOMAIN', secretRef: 'platform-domain' }
            { name: 'PLATFORM_CUT_PCT', secretRef: 'platform-cut-pct' }
            { name: 'STRIPE_SECRET_KEY', secretRef: 'stripe-secret-key' }
            { name: 'STRIPE_PUBLISHABLE_KEY', secretRef: 'stripe-publishable-key' }
            { name: 'STRIPE_WEBHOOK_SECRET', secretRef: 'stripe-webhook-secret' }
            { name: 'RAZORPAY_KEY_ID', secretRef: 'razorpay-key-id' }
            { name: 'RAZORPAY_KEY_SECRET', secretRef: 'razorpay-key-secret' }
            { name: 'RAZORPAY_WEBHOOK_SECRET', secretRef: 'razorpay-webhook-secret' }
            { name: 'GOOGLE_CLIENT_ID', secretRef: 'google-client-id' }
            { name: 'GOOGLE_CLIENT_SECRET', secretRef: 'google-client-secret' }
            { name: 'GOOGLE_REDIRECT_URI', secretRef: 'google-redirect-uri' }
            { name: 'GMAIL_REDIRECT_URI', secretRef: 'gmail-redirect-uri' }
            { name: 'MULTI_AGENT_MODE', value: 'true' }
            { name: 'MULTI_AGENT_BASE_URL', value: 'https://${multiAgentApp.properties.configuration.ingress.fqdn}' }
          ]
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
