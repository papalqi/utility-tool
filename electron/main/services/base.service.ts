/**
 * 服务基类
 * 提供统一的生命周期管理、日志和事件机制
 */

import { EventEmitter } from 'events'
import log from '../logger'

export abstract class BaseService extends EventEmitter {
  protected readonly name: string
  protected initialized = false

  constructor(name: string) {
    super()
    this.name = name
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      this.log('Already initialized, skipping')
      return
    }

    this.log('Initializing...')
    try {
      await this.onInitialize()
      this.initialized = true
      this.log('Initialized successfully')
    } catch (error) {
      this.error('Failed to initialize', error)
      throw error
    }
  }

  /**
   * 销毁服务
   */
  async destroy(): Promise<void> {
    if (!this.initialized) {
      return
    }

    this.log('Destroying...')
    try {
      await this.onDestroy()
      this.initialized = false
      this.removeAllListeners()
      this.log('Destroyed successfully')
    } catch (error) {
      this.error('Failed to destroy', error)
      throw error
    }
  }

  /**
   * 检查服务是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized
  }

  /**
   * 获取服务名称
   */
  getName(): string {
    return this.name
  }

  /**
   * 子类实现：初始化逻辑
   */
  protected abstract onInitialize(): Promise<void>

  /**
   * 子类实现：销毁逻辑
   */
  protected abstract onDestroy(): Promise<void>

  /**
   * 记录信息日志
   */
  protected log(message: string, data?: unknown): void {
    if (data !== undefined) {
      log.info(`[${this.name}] ${message}`, data)
    } else {
      log.info(`[${this.name}] ${message}`)
    }
  }

  /**
   * 记录调试日志
   */
  protected debug(message: string, data?: unknown): void {
    if (data !== undefined) {
      log.debug(`[${this.name}] ${message}`, data)
    } else {
      log.debug(`[${this.name}] ${message}`)
    }
  }

  /**
   * 记录错误日志
   */
  protected error(message: string, error?: unknown): void {
    log.error(`[${this.name}] ${message}`, error)
  }

  /**
   * 发出带日志的事件
   */
  protected emitEvent<T>(event: string, data: T): void {
    this.debug(`Emitting event: ${event}`)
    this.emit(event, data)
  }
}
