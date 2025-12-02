/**
 * Web Archive / Scraper IPC handlers
 */

import { ipcMain } from 'electron'
import log from '../logger'
import { crawlWebPage, crawlMultiplePages, executeCheckIn } from '../web-scraper'
import type { IpcContext } from './index'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function registerWebArchiveIpc(_context: IpcContext): void {
  ipcMain.handle('webarchive:crawl', async (_event, request) => {
    try {
      log.debug('IPC: Crawling web page', request)
      return await crawlWebPage(request)
    } catch (error) {
      log.error('IPC: Failed to crawl web page', error)
      throw error
    }
  })

  ipcMain.handle('webarchive:crawlMultiple', async (_event, requests) => {
    try {
      log.debug('IPC: Crawling multiple pages', { count: requests.length })
      const results = await crawlMultiplePages(requests)
      return Object.fromEntries(results)
    } catch (error) {
      log.error('IPC: Failed to crawl multiple pages', error)
      throw error
    }
  })

  ipcMain.handle('webarchive:checkIn', async (_event, request) => {
    try {
      log.debug('IPC: Executing check-in', request)
      return await executeCheckIn(request)
    } catch (error) {
      log.error('IPC: Failed to execute check-in', error)
      throw error
    }
  })
}
