/**
 * API Hooks - 类型安全的 IPC 调用封装
 */

export { useConfig } from './useConfig'
export { useFileSystem } from './useFileSystem'
export { useGitHubRepos } from './useGitHubRepos'
export { useGitHub } from './useGitHub'
export { useAI } from './useAI'
export { useADB } from './useADB'

// 类型导出
export type {
  GitHubRepo,
  GitHubRepoInfo,
} from './useGitHubRepos'

export type {
  GitAction,
  GitHubTokenVerifyResult,
  GitCloneResult,
  GitInfoResult,
} from './useGitHub'

export type {
  AIConfig,
  AIMessage,
  AICompletionResult,
} from './useAI'

export type {
  ADBDevice,
  ADBCommandResult,
} from './useADB'
