import {
  Suspense,
  lazy,
  useMemo,
  memo,
  type ComponentType,
  type LazyExoticComponent,
} from 'react'
import { Spin } from 'antd'

// Lazy load widgets
// 暂时不需要 - 示例 Widget
// const ExampleWidget = lazy(() => import('../widgets/ExampleWidget'))
const DashboardWidget = lazy(() => import('../widgets/DashboardWidget'))
const AICliWidget = lazy(() => import('../widgets/AICliWidget'))
const GenericAIWidget = lazy(() => import('../widgets/GenericAIWidget'))
const AIChatWidget = lazy(() => import('../widgets/AIChatWidget'))
const FileTransferWidget = lazy(() => import('../widgets/FileTransferWidget'))
const TodoWidget = lazy(() =>
  import('../pages/TodoWidget').then((m) => ({ default: m.TodoWidget }))
)
const PomodoroWidget = lazy(() => import('../pages/PomodoroWidget'))
const CalendarWidget = lazy(() => import('../widgets/CalendarWidget'))
const ScriptsWidget = lazy(() => import('../widgets/ScriptsWidget'))
const EnvironmentWidget = lazy(() => import('../widgets/EnvironmentWidget'))
// 暂时不需要 - Quick Access
// const QuickAccessWidget = lazy(() => import('../widgets/QuickAccessWidget'))
const TerminalWidget = lazy(() => import('../widgets/TerminalWidget'))
const RenderDocWidget = lazy(() => import('../widgets/RenderDocWidget'))
const ADBWidget = lazy(() => import('../widgets/ADBWidget'))
const ProjectsWidget = lazy(() => import('../widgets/ProjectsWidget'))
const GitHubWidget = lazy(() => import('../widgets/GitHubWidget'))
const WebArchiveWidget = lazy(() => import('../widgets/WebArchiveWidget'))
const isDev = import.meta.env.DEV
const TestWidget = isDev ? lazy(() => import('../widgets/TestWidget')) : null
// 暂时不需要 - Attachments 测试页面
// const AttachmentsWidget = lazy(() => import('../widgets/AttachmentsWidget'))

interface WidgetContainerProps {
  activeWidget: string
}

type WidgetEntry = {
  key: string
  Component: LazyExoticComponent<ComponentType<Record<string, unknown>>> | ComponentType<Record<string, unknown>>
  keepAlive?: boolean // 是否在后台保持运行（默认 false）
}

const BASE_WIDGETS: WidgetEntry[] = [
  // 纯展示类 widgets - 不需要后台运行
  { key: 'dashboard', Component: DashboardWidget, keepAlive: false },
  { key: 'todo', Component: TodoWidget, keepAlive: false },
  { key: 'calendar', Component: CalendarWidget, keepAlive: false },
  { key: 'projects', Component: ProjectsWidget, keepAlive: false },
  { key: 'github', Component: GitHubWidget, keepAlive: false },
  { key: 'web-archive', Component: WebArchiveWidget, keepAlive: false },
  { key: 'renderdoc', Component: RenderDocWidget, keepAlive: false },
  { key: 'scripts', Component: ScriptsWidget, keepAlive: false },
  { key: 'environment', Component: EnvironmentWidget, keepAlive: false },
  
  // 需要后台运行的 widgets
  { key: 'terminal', Component: TerminalWidget, keepAlive: true }, // 终端进程
  { key: 'file-transfer', Component: FileTransferWidget, keepAlive: true }, // 文件传输任务
  { key: 'adb', Component: ADBWidget, keepAlive: true }, // ADB 连接
  { key: 'pomodoro', Component: PomodoroWidget, keepAlive: true }, // 番茄钟计时器
  
  // AI 相关 - 根据需求配置
  { key: 'ai-cli', Component: AICliWidget, keepAlive: false },
  { key: 'generic-ai', Component: GenericAIWidget, keepAlive: false },
  { key: 'ai-chat', Component: AIChatWidget, keepAlive: true }, // 可能需要保持会话
]

const WIDGETS: WidgetEntry[] =
  isDev && TestWidget
    ? [...BASE_WIDGETS, { key: 'test-widget', Component: TestWidget, keepAlive: false }]
    : BASE_WIDGETS

const WidgetContainer = ({ activeWidget }: WidgetContainerProps) => {
  // 需要渲染的 widgets：当前激活的 + keepAlive 的
  const widgetsToRender = useMemo(() => {
    return WIDGETS.filter(
      ({ key, keepAlive }) => key === activeWidget || keepAlive === true
    )
  }, [activeWidget])

  return (
    <div
      style={{
        flex: 1,
        position: 'relative',
        minHeight: 0,
        height: '100%',
        background: 'transparent',
        overflow: 'hidden',
      }}
    >
      {widgetsToRender.map(({ key, Component }) => {
        const isActive = key === activeWidget

        return (
          <div
            key={key}
            style={{
              display: isActive ? 'block' : 'none',
              height: '100%',
              minHeight: 0,
              padding: '24px',
              overflow: 'auto',
            }}
          >
            <Suspense
              fallback={
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100%',
                  }}
                >
                  <Spin size="large" />
                </div>
              }
            >
              <Component />
            </Suspense>
          </div>
        )
      })}
    </div>
  )
}

export default memo(WidgetContainer)
