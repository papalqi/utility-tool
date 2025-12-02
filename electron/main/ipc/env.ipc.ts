/**
 * Environment Variable IPC handlers
 */

import { ipcMain } from 'electron'
import log from '../logger'
import {
  buildEnvironmentSnapshot,
  applyEnvironmentMutation,
  deleteEnvironmentVariable,
  applyPathEntries,
  resolveExecutable,
} from '../services/env.service'
import type {
  EnvironmentMutationPayload,
  EnvironmentDeletePayload,
  PathEntriesPayload,
} from '@shared/system'
import type { IpcContext } from './index'

export function registerEnvIpc(_context: IpcContext): void {
  ipcMain.handle('env:list', async () => {
    try {
      return buildEnvironmentSnapshot()
    } catch (error) {
      log.error('Failed to load environment variables', error)
      throw error
    }
  })

  ipcMain.handle('env:set', async (_event, payload: EnvironmentMutationPayload) => {
    try {
      return await applyEnvironmentMutation(payload)
    } catch (error) {
      log.error(`Failed to set environment variable ${payload?.key}`, error)
      throw error
    }
  })

  ipcMain.handle('env:delete', async (_event, payload: EnvironmentDeletePayload) => {
    try {
      await deleteEnvironmentVariable(payload)
      return true
    } catch (error) {
      log.error(`Failed to delete environment variable ${payload?.key}`, error)
      throw error
    }
  })

  ipcMain.handle('env:setPathEntries', async (_event, payload: PathEntriesPayload) => {
    try {
      await applyPathEntries(payload)
      return true
    } catch (error) {
      log.error(`Failed to update PATH entries for ${payload?.scope}`, error)
      throw error
    }
  })

  ipcMain.handle('env:which', async (_event, command: string) => {
    try {
      return resolveExecutable(command)
    } catch (error) {
      log.error('Failed to resolve executable', error)
      return null
    }
  })
}
