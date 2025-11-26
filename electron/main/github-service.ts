/**
 * GitHub Service - 处理 GitHub API 和 Git 操作
 */

import { Octokit } from '@octokit/rest'
import simpleGit, { SimpleGit, type RemoteWithRefs } from 'simple-git'
import { exec } from 'child_process'
import { promisify } from 'util'
import log from './logger'

const execAsync = promisify(exec)

/**
 * 验证 GitHub Token
 */
export async function verifyGitHubToken(token: string): Promise<{ success: boolean; username?: string; error?: string }> {
  try {
    const octokit = new Octokit({ auth: token })
    const { data: user } = await octokit.rest.users.getAuthenticated()

    log.info('[GitHub] Token verified', { username: user.login })
    return {
      success: true,
      username: user.login,
    }
  } catch (error: any) {
    log.error('[GitHub] Token verification failed', error)
    return {
      success: false,
      error: error.message || 'Token verification failed',
    }
  }
}

/**
 * 列出用户的所有仓库
 */
export async function listUserRepositories(token: string): Promise<any[]> {
  try {
    const octokit = new Octokit({ auth: token })
    const repos: any[] = []

    // 获取用户自己的仓库
    let page = 1
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data } = await octokit.rest.repos.listForAuthenticatedUser({
        per_page: 100,
        page,
        sort: 'updated',
        direction: 'desc',
      })

      if (data.length === 0) break

      repos.push(...data)
      page++

      // 限制最多获取 500 个仓库
      if (repos.length >= 500) break
    }

    log.info('[GitHub] Listed user repositories', { count: repos.length })
    return repos
  } catch (error: any) {
    log.error('[GitHub] Failed to list repositories', error)
    throw new Error(error.message || 'Failed to list repositories')
  }
}

/**
 * 克隆仓库
 */
export async function cloneRepository(url: string, targetPath: string): Promise<{ success: boolean; error?: string }> {
  try {
    log.info('[GitHub] Cloning repository', { url, targetPath })

    const git: SimpleGit = simpleGit()
    await git.clone(url, targetPath)

    log.info('[GitHub] Repository cloned successfully', { targetPath })
    return { success: true }
  } catch (error: any) {
    log.error('[GitHub] Failed to clone repository', error)
    return {
      success: false,
      error: error.message || 'Clone failed',
    }
  }
}

/**
 * 获取 Git 仓库信息
 */
export async function getGitInfo(repoPath: string): Promise<any> {
  try {
    const git: SimpleGit = simpleGit(repoPath)

    // 检查是否是 Git 仓库
    const isRepo = await git.checkIsRepo()
    if (!isRepo) {
      return { isRepo: false }
    }

    // 获取当前分支
    const branch = await git.branchLocal()
    const currentBranch = branch.current

    // 获取远程 URL
    const remotes = await git.getRemotes(true)
    const originRemote = remotes.find((r: RemoteWithRefs) => r.name === 'origin')
    const remoteUrl = originRemote?.refs?.fetch || originRemote?.refs?.push

    // 获取状态
    const status = await git.status()

    return {
      isRepo: true,
      branch: currentBranch,
      remoteUrl,
      ahead: status.ahead,
      behind: status.behind,
      modified: status.modified.length,
      created: status.created.length,
      deleted: status.deleted.length,
      renamed: status.renamed.length,
      conflicted: status.conflicted.length,
    }
  } catch (error: any) {
    log.error('[GitHub] Failed to get git info', { repoPath, error })
    throw new Error(error.message || 'Failed to get git info')
  }
}

/**
 * 执行 Git 命令
 */
export async function execGitCommand(repoPath: string, command: string): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync(command, { cwd: repoPath })
    return stdout || stderr
  } catch (error: any) {
    log.error('[GitHub] Failed to execute git command', { repoPath, command, error })
    throw new Error(error.message || 'Git command failed')
  }
}
