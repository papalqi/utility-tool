import { create } from 'zustand'

export type TerminalSessionStatus = 'running' | 'success' | 'error' | 'pending'
export type TerminalSessionMode = 'interactive' | 'task' | 'ssh'

export interface TerminalSession {
  id: string
  title: string
  command: string
  args: string[]
  cwd?: string
  status: TerminalSessionStatus
  createdAt: number
  exitCode?: number
  mode: TerminalSessionMode
  profileId?: string
  shell?: string
}

interface TerminalStoreState {
  sessions: TerminalSession[]
  activeSessionId?: string
  createSession: (payload: {
    title: string
    command?: string
    args?: string[]
    cwd?: string
    status?: TerminalSessionStatus
    mode?: TerminalSessionMode
    profileId?: string
    shell?: string
  }) => string
  updateSession: (id: string, patch: Partial<TerminalSession>) => void
  removeSession: (id: string) => void
  setActiveSession: (id: string) => void
  clearCompleted: () => void
}

const createSessionId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `terminal-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

export const useTerminalStore = create<TerminalStoreState>((set) => ({
  sessions: [],
  activeSessionId: undefined,
  createSession: ({
    title,
    command = '',
    args = [],
    cwd,
    status = 'running',
    mode,
    profileId,
    shell,
  }) => {
    const id = createSessionId()
    const session: TerminalSession = {
      id,
      title: title.trim() || command,
      command,
      args,
      cwd,
      status,
      createdAt: Date.now(),
      mode: mode || (command ? 'task' : 'interactive'),
      profileId,
      shell,
    }
    set((state) => ({
      sessions: [...state.sessions, session],
      activeSessionId: id,
    }))
    return id
  },
  updateSession: (id, patch) =>
    set((state) => ({
      sessions: state.sessions.map((session) =>
        session.id === id ? { ...session, ...patch } : session
      ),
    })),
  removeSession: (id) =>
    set((state) => {
      const nextSessions = state.sessions.filter((session) => session.id !== id)
      const activeSessionId =
        state.activeSessionId === id ? nextSessions.at(-1)?.id : state.activeSessionId
      return {
        sessions: nextSessions,
        activeSessionId,
      }
    }),
  setActiveSession: (id) => set(() => ({ activeSessionId: id })),
  clearCompleted: () =>
    set((state) => {
      const running = state.sessions.filter(
        (session) => session.status === 'running' || session.status === 'pending'
      )
      return {
        sessions: running,
        activeSessionId: running.at(-1)?.id,
      }
    }),
}))
