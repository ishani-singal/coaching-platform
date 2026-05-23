param location string
param environment string

var keyVaultName = 'coachprod-${environment}-kv'

resource keyVault 'Microsoft.KeyVault/vaults@2023-02-01' = {
  name: keyVaultName
  location: location
  properties: {
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    accessPolicies: [
      // Policies added by GitHub Actions / manual configuration
    ]
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
  }
}

output keyVaultName string = keyVault.name
output keyVaultId string = keyVault.id
