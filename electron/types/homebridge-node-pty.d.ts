declare module '@homebridge/node-pty-prebuilt-multiarch' {
  export interface IPty {
    readonly pid: number
    readonly process: string
    write(data: string): void
    onData(listener: (data: string) => void): void
    onExit(listener: (event: { exitCode: number; signal?: number }) => void): void
    resize(columns: number, rows: number): void
    kill(signal?: number | string): void
  }

  export interface SpawnOptions {
    name?: string
    cols?: number
    rows?: number
    cwd?: string
    env?: Record<string, string | undefined>
  }

  export function spawn(shell: string, args?: string[], options?: SpawnOptions): IPty
}
