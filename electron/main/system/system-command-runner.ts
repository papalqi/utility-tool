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

    const candidates = ['pwsh', 'powershell']
    for (const candidate of candidates) {
      try {
        await execAsync(`${candidate} -NoProfile -Command "exit 0"`)
        this.detectedPowerShell = candidate
        log.debug(`[SystemCommandRunner] Using PowerShell ${candidate}`)
        return candidate
      } catch (error) {
        log.debug(`[SystemCommandRunner] ${candidate} is not available`, error)
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
    const fullCommand = `${psCmd} -NoProfile -Command ${command}`
    return this.exec(fullCommand, options)
  }
}

export const systemCommandRunner = new SystemCommandRunner()
