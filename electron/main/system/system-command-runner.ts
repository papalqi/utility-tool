import { exec, ExecOptions } from 'child_process'
import { promisify } from 'util'
import log from '../logger'

const execAsync = promisify(exec)

export interface CommandExecutionOptions extends ExecOptions {
  encoding?: BufferEncoding
  maxBuffer?: number
}

/**
 * Centralized system command runner to keep shell/PowerShell invocations consistent.
 */
class SystemCommandRunner {
  private detectedPowerShell?: string | null

  async getPowerShellCommand(): Promise<string | null> {
    if (this.detectedPowerShell !== undefined) {
      return this.detectedPowerShell
    }

    // 优先使用 pwsh，符合仓库规则
    const candidates: Array<{ cmd: string; testFlag: string }> = [
      { cmd: 'pwsh', testFlag: '-c' },
      { cmd: 'powershell', testFlag: '-Command' },
    ]
    for (const { cmd, testFlag } of candidates) {
      try {
        await execAsync(`${cmd} ${testFlag} "exit 0"`)
        this.detectedPowerShell = cmd
        log.debug(`[SystemCommandRunner] Using PowerShell ${cmd}`)
        return cmd
      } catch (error) {
        log.debug(`[SystemCommandRunner] ${cmd} is not available`, error)
      }
    }

    log.error('[SystemCommandRunner] No PowerShell found on system')
    this.detectedPowerShell = null
    return null
  }

  resetPowerShellCache(): void {
    this.detectedPowerShell = undefined
  }

  async exec(command: string, options?: CommandExecutionOptions): Promise<string> {
    const { stdout } = await this.execWithResult(command, options)
    return stdout
  }

  async execWithResult(
    command: string,
    options?: CommandExecutionOptions
  ): Promise<{ stdout: string; stderr: string }> {
    const { encoding = 'utf8', maxBuffer = 1024 * 1024, ...execOptions } = options ?? {}
    const { stdout, stderr } = await execAsync(command, {
      ...execOptions,
      encoding: 'buffer',
      maxBuffer,
    })
    return {
      stdout: (stdout as unknown as Buffer).toString(encoding),
      stderr: (stderr as unknown as Buffer).toString(encoding),
    }
  }

  async execPowerShell(command: string, options?: CommandExecutionOptions): Promise<string | null> {
    const psCmd = await this.getPowerShellCommand()
    if (!psCmd) {
      return null
    }
    // 根据仓库规则：pwsh 使用 -c，powershell 使用 -Command
    const flag = psCmd === 'pwsh' ? '-c' : '-Command'
    const fullCommand = `${psCmd} ${flag} ${command}`
    return this.exec(fullCommand, options)
  }
}

export const systemCommandRunner = new SystemCommandRunner()
