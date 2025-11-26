export const DEFAULT_VISIBLE_TABS = [
  'dashboard',
  'ai-cli',
  'generic-ai',
  'ai-chat',
  'todo',
  'pomodoro',
  'calendar',
  'scripts',
  'environment',
  'terminal',
  'renderdoc',
  'adb',
  'projects',
  'github',
  'web-archive',
]

export type WidgetTabKey = (typeof DEFAULT_VISIBLE_TABS)[number]
