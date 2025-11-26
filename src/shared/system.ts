export type EnvVarScope = 'process' | 'user' | 'system'

export type EnvVarSource = 'process' | 'registry' | 'shell'

export interface EnvironmentVariable {
  key: string
  value: string
  scope: EnvVarScope
  source?: EnvVarSource
}

export interface EnvironmentCapabilities {
  supportsEditing: boolean
  canEditUser: boolean
  canEditSystem: boolean
  canDelete: boolean
  notes?: string
}

export interface EnvironmentSnapshot {
  variables: EnvironmentVariable[]
  platform: NodeJS.Platform
  scopes: EnvVarScope[]
  capabilities: EnvironmentCapabilities
  pathEntries: {
    user: string[]
    system: string[]
    process: string[]
  }
  generatedAt: number
}

export interface EnvironmentMutationPayload {
  key: string
  value: string
  scope?: Exclude<EnvVarScope, 'process'>
}

export interface EnvironmentDeletePayload {
  key: string
  scope?: Exclude<EnvVarScope, 'process'>
}

export interface PathEntriesPayload {
  scope: Exclude<EnvVarScope, 'process'>
  entries: string[]
}
