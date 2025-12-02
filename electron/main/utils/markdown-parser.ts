/**
 * GitHub 仓库 Markdown 解析工具
 */

export interface GitHubRepoEntry {
  id: string
  name: string
  path: string
  remoteUrl?: string
  branch?: string
  tags: string[]
  favorite: boolean
}

/**
 * 解析 GitHub 仓库 Markdown 表格
 */
export function parseGitHubReposMarkdown(content: string, hostname: string): GitHubRepoEntry[] {
  const repos: GitHubRepoEntry[] = []
  const lines = content.split('\n')

  let inSection = false
  let headerFound = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // 查找对应主机名的章节
    if (line === `## ${hostname}`) {
      inSection = true
      headerFound = false
      continue
    }

    // 遇到下一个章节标题，停止解析
    if (inSection && line.startsWith('##') && line !== `## ${hostname}`) {
      break
    }

    // 跳过表头
    if (inSection && line.startsWith('|') && line.includes('Name')) {
      headerFound = true
      i++ // 跳过分隔行
      continue
    }

    // 解析表格行
    if (inSection && headerFound && line.startsWith('|')) {
      const parts = line
        .split('|')
        .map((p) => p.trim())
        .filter(Boolean)
      if (parts.length >= 4) {
        repos.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: parts[0],
          path: parts[1],
          remoteUrl: parts[2] || undefined,
          branch: parts[3] || undefined,
          tags: parts[4] ? parts[4].split(',').map((t) => t.trim()) : [],
          favorite: parts[5] === '⭐',
        })
      }
    }
  }

  return repos
}

/**
 * 更新 GitHub 仓库 Markdown 表格
 */
export function updateGitHubReposMarkdown(
  content: string,
  hostname: string,
  repos: GitHubRepoEntry[]
): string {
  const lines = content.split('\n')
  const result: string[] = []

  let inSection = false
  let sectionFound = false

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed === `## ${hostname}`) {
      inSection = true
      sectionFound = true
      result.push(line)

      // 添加表头
      result.push('')
      result.push('| Name | Path | Remote | Branch | Tags | Favorite |')
      result.push('|------|------|--------|--------|------|----------|')

      // 添加仓库数据
      for (const repo of repos) {
        const row = [
          repo.name,
          repo.path,
          repo.remoteUrl || '',
          repo.branch || '',
          repo.tags?.join(',') || '',
          repo.favorite ? '⭐' : '',
        ]
        result.push(`| ${row.join(' | ')} |`)
      }

      result.push('')
      continue
    }

    if (inSection && trimmed.startsWith('##')) {
      inSection = false
    }

    if (!inSection || !sectionFound) {
      result.push(line)
    }
  }

  // 如果章节不存在，在末尾添加
  if (!sectionFound) {
    result.push('')
    result.push(`## ${hostname}`)
    result.push('')
    result.push('| Name | Path | Remote | Branch | Tags | Favorite |')
    result.push('|------|------|--------|--------|------|----------|')

    for (const repo of repos) {
      const row = [
        repo.name,
        repo.path,
        repo.remoteUrl || '',
        repo.branch || '',
        repo.tags?.join(',') || '',
        repo.favorite ? '⭐' : '',
      ]
      result.push(`| ${row.join(' | ')} |`)
    }
    result.push('')
  }

  return result.join('\n')
}

/**
 * 解析 GitHub 收藏夹部分
 */
export function parseGitHubFavoritesSection(content: string): string[] {
  const favorites = new Set<string>()
  const lines = content.split('\n')
  let inSection = false

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (line === '## Favorites') {
      inSection = true
      continue
    }

    if (inSection && line.startsWith('##')) {
      break
    }

    if (!inSection || !line) {
      continue
    }

    const normalized =
      line.startsWith('-') || line.startsWith('*') ? line.replace(/^[-*]\s*/, '').trim() : line

    if (normalized) {
      favorites.add(normalized)
    }
  }

  return Array.from(favorites)
}

/**
 * 更新 GitHub 收藏夹部分
 */
export function updateGitHubFavoritesSection(content: string, favorites: string[]): string {
  const lines = content.split('\n')
  const result: string[] = []

  let inSection = false
  let sectionFound = false

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed === '## Favorites') {
      inSection = true
      sectionFound = true

      if (favorites.length > 0) {
        result.push('## Favorites')
        result.push('')
        for (const fav of favorites) {
          result.push(`- ${fav}`)
        }
        result.push('')
      }
      continue
    }

    if (inSection && trimmed.startsWith('##') && trimmed !== '## Favorites') {
      inSection = false
    }

    if (inSection) {
      continue
    }

    result.push(line)
  }

  if (!sectionFound && favorites.length > 0) {
    if (result.length && result[result.length - 1].trim() !== '') {
      result.push('')
    }
    result.push('## Favorites')
    result.push('')
    for (const fav of favorites) {
      result.push(`- ${fav}`)
    }
    result.push('')
  }

  return result.join('\n')
}
