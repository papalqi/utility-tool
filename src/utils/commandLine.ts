/**
 * 将命令行字符串拆分为参数数组
 * 支持单双引号与转义字符
 */
export function splitCommandLine(command: string): string[] {
  const args: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null
  let escapeNext = false

  for (const char of command) {
    if (escapeNext) {
      current += char
      escapeNext = false
      continue
    }

    if (char === '\\') {
      escapeNext = true
      continue
    }

    if (quote) {
      if (char === quote) {
        quote = null
      } else {
        current += char
      }
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }

    if (/\s/.test(char)) {
      if (current.length > 0) {
        args.push(current)
        current = ''
      }
      continue
    }

    current += char
  }

  if (current.length > 0) {
    args.push(current)
  }

  return args
}

/**
 * 拼接本地路径，自动处理分隔符
 */
export function joinLocalPath(dir: string, file: string): string {
  if (!dir) {
    return file
  }

  const separator = dir.includes('\\') ? '\\' : '/'
  if (dir.endsWith('/') || dir.endsWith('\\')) {
    return `${dir}${file}`
  }

  return `${dir}${separator}${file}`
}
