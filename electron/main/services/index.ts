/**
 * 服务注册中心
 * 统一管理所有服务的生命周期
 */

import log from '../logger'
import { githubService } from './github.service'
import { obsidianService } from './obsidian.service'

// 导出基类
export { BaseService } from './base.service'

// 导出所有服务实例
export { githubService } from './github.service'
export { obsidianService } from './obsidian.service'

// 导出类型
export type { GitHubUser, GitHubRepository, LocalRepoInfo, CloneResult } from './github.service'
export type { VaultConfig, VaultFile } from './obsidian.service'

/**
 * 所有服务实例列表
 * 按依赖顺序排列（被依赖的服务在前）
 */
const services = [
  obsidianService, // 其他服务可能依赖 Obsidian
  githubService,
]

/**
 * 初始化所有服务
 */
export async function initializeServices(): Promise<void> {
  log.info('Initializing all services...')

  for (const service of services) {
    try {
      await service.initialize()
    } catch (error) {
      log.error(`Failed to initialize service: ${service.getName()}`, error)
      // 继续初始化其他服务，不阻塞
    }
  }

  log.info('All services initialized')
}

/**
 * 销毁所有服务
 */
export async function destroyServices(): Promise<void> {
  log.info('Destroying all services...')

  // 逆序销毁
  for (const service of [...services].reverse()) {
    try {
      await service.destroy()
    } catch (error) {
      log.error(`Failed to destroy service: ${service.getName()}`, error)
    }
  }

  log.info('All services destroyed')
}

/**
 * 获取服务状态
 */
export function getServicesStatus(): Array<{ name: string; initialized: boolean }> {
  return services.map((service) => ({
    name: service.getName(),
    initialized: service.isInitialized(),
  }))
}
