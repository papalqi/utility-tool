/**
 * 番茄钟 Widget
 * 对应 Python: src/widgets/pomodoro_widget.py
 *
 * 功能:
 * - 番茄工作法计时器 (25分钟工作 + 5分钟短休息 + 15分钟长休息)
 * - 工作记录保存和查看
 * - 自定义工作/休息时长
 * - 完成提示音效
 * - 工作会话统计
 */

import React, { useState, useEffect, useRef } from 'react'
import { Button, Input, Modal, App, Space, Card, List, Radio } from 'antd'
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  FastForwardOutlined,
  SettingOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import { WidgetLayout } from '@/components/widgets'
import { useConfig, useConfigUpdate } from '@/hooks/useConfig'
import { obsidianManager } from '@/core/ObsidianManager'
import { TodoItem } from '@/shared/types'
import { useAppContext } from '@/context/AppContext'
import useNotifier from '@/hooks/useNotifier'
import { useTheme } from '@/contexts/ThemeContext'

// 工作记录类型
interface WorkRecord {
  content: string
  duration: number
  completed_time: string
  session_number: number
  status: '完成' | '跳过'
}

// 番茄钟模式
type PomodoroMode = 'work' | 'short_break' | 'long_break'

export const PomodoroWidget: React.FC = () => {
  const { message } = App.useApp()
  const config = useConfig()
  const { updateConfig } = useConfigUpdate()
  const { currentPomodoroTask, setCurrentPomodoroTask } = useAppContext()
  const { notify } = useNotifier()
  const { colors } = useTheme()

  // 配置状态
  const [workDuration, setWorkDuration] = useState(25) // 分钟
  const [shortBreakDuration, setShortBreakDuration] = useState(5)
  const [longBreakDuration, setLongBreakDuration] = useState(15)
  const [longBreakInterval, setLongBreakInterval] = useState(4)

  // 计时器状态
  const [currentMode, setCurrentMode] = useState<PomodoroMode>('work')
  const [timeRemaining, setTimeRemaining] = useState(25 * 60) // 秒
  const [isRunning, setIsRunning] = useState(false)
  const [sessionCount, setSessionCount] = useState(0)
  const [currentWorkContent, setCurrentWorkContent] = useState('')

  // 工作记录
  const [workRecords, setWorkRecords] = useState<WorkRecord[]>([])

  // 对话框状态
  const [settingsVisible, setSettingsVisible] = useState(false)
  const [recordsVisible, setRecordsVisible] = useState(false)
  const [todoSelectionVisible, setTodoSelectionVisible] = useState(false)
  const [workInputVisible, setWorkInputVisible] = useState(false)
  const [tempWorkContent, setTempWorkContent] = useState('')
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null)
  const [manualInputInTodoDialog, setManualInputInTodoDialog] = useState('')

  // TODO 集成
  const [todoItems, setTodoItems] = useState<TodoItem[]>([])

  // Timer ref
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<Date | null>(null)
  const elapsedTimeRef = useRef(0)

  /**
   * 加载配置和 TODO 列表
   */
  useEffect(() => {
    const pomodoroConfig = config.pomodoro || {}
    setWorkDuration(pomodoroConfig.work_duration || 25)
    setShortBreakDuration(pomodoroConfig.short_break_duration || 5)
    setLongBreakDuration(pomodoroConfig.long_break_duration || 15)
    setLongBreakInterval(pomodoroConfig.long_break_interval || 4)

    // 从 localStorage 加载工作记录
    const savedRecords = localStorage.getItem('pomodoro_records')
    if (savedRecords) {
      setWorkRecords(JSON.parse(savedRecords))
    }

    // 从 Obsidian 加载 TODO 列表
    loadTodoItems()

    resetTimer()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config])

  /**
   * 从 Obsidian 加载 TODO 列表
   */
  const loadTodoItems = async () => {
    try {
      // 使用与周记相同的模板
      const template = config.global?.obsidian?.content_files?.template || '{year}-W{week}.md'
      console.log('Loading TODO items from template:', template)

      const items = await obsidianManager.readTodoItems(template)
      console.log('Loaded TODO items:', items)

      // 只显示未完成的任务
      const incompleteTodos = items.filter((item) => !item.done)
      setTodoItems(incompleteTodos)
    } catch (error) {
      console.error('Failed to load TODO items:', error)
    }
  }

  /**
   * 处理从TODO页面传递过来的任务
   */
  useEffect(() => {
    if (currentPomodoroTask && !isRunning) {
      // 设置工作内容为TODO任务
      setCurrentWorkContent(currentPomodoroTask.text)
      setSelectedTodoId(currentPomodoroTask.id)
      message.info(`番茄钟已准备，点击开始按钮开始计时`)
      // 清除任务引用（避免重复触发）
      // setCurrentPomodoroTask(null)  // 保留，让用户可以看到是哪个任务
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPomodoroTask])

  /**
   * 清理定时器
   */
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  /**
   * 格式化时间显示
   */
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  /**
   * 获取当前模式显示文本
   */
  const getModeText = (mode: PomodoroMode): string => {
    switch (mode) {
      case 'work':
        return '🍅 工作时间'
      case 'short_break':
        return '☕ 短休息'
      case 'long_break':
        return '🌟 长休息'
    }
  }

  /**
   * 开始计时器
   */
  const startTimer = (skipContentCheck: boolean = false) => {
    // 如果是工作模式且没有工作内容，先询问
    if (!skipContentCheck && currentMode === 'work' && !currentWorkContent) {
      // 如果有 TODO 列表，优先显示 TODO 选择对话框
      if (todoItems.length > 0) {
        setTodoSelectionVisible(true)
      } else {
        // 否则显示手动输入对话框
        setWorkInputVisible(true)
      }
      return
    }

    setIsRunning(true)
    startTimeRef.current = new Date()

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          sessionComplete()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  /**
   * 暂停计时器
   */
  const pauseTimer = () => {
    setIsRunning(false)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    // 累计已用时间
    if (startTimeRef.current) {
      const elapsed = (new Date().getTime() - startTimeRef.current.getTime()) / 1000
      elapsedTimeRef.current += elapsed
    }
  }

  /**
   * 重置计时器
   */
  const resetTimer = () => {
    pauseTimer()
    setCurrentMode('work')
    setTimeRemaining(workDuration * 60)
    setCurrentWorkContent('')
    startTimeRef.current = null
    elapsedTimeRef.current = 0
  }

  /**
   * 跳过当前会话
   */
  const skipSession = () => {
    if (currentMode === 'work' && currentWorkContent && startTimeRef.current) {
      // 计算实际工作时间
      const currentRunTime = isRunning
        ? (new Date().getTime() - startTimeRef.current.getTime()) / 1000
        : 0
      const actualDuration = (elapsedTimeRef.current + currentRunTime) / 60

      // 记录跳过的工作
      const newSessionCount = sessionCount + 1
      const record: WorkRecord = {
        content: currentWorkContent,
        duration: Math.round(actualDuration * 10) / 10,
        completed_time: new Date().toLocaleString('zh-CN'),
        session_number: newSessionCount,
        status: '跳过',
      }

      saveWorkRecord(record)
      setSessionCount(newSessionCount)
      message.info(`已跳过工作会话，实际工作时间: ${record.duration}分钟`)
    }

    pauseTimer()
    moveToNextMode()
  }

  /**
   * 会话完成处理
   */
  const sessionComplete = async () => {
    pauseTimer()

    // 播放提示音
    playNotificationSound()

    if (currentMode === 'work') {
      const newSessionCount = sessionCount + 1
      setSessionCount(newSessionCount)

      // 保存工作记录
      if (currentWorkContent) {
        const record: WorkRecord = {
          content: currentWorkContent,
          duration: workDuration,
          completed_time: new Date().toLocaleString('zh-CN'),
          session_number: newSessionCount,
          status: '完成',
        }
        saveWorkRecord(record)
      }

      // 如果有关联的TODO任务，标记为完成
      if (selectedTodoId && currentPomodoroTask) {
        try {
          const template = config.global?.obsidian?.content_files?.template || '{year}-W{week}.md'
          const items = await obsidianManager.readTodoItems(template)
          const updatedItems = items.map((item) =>
            item.id === selectedTodoId ? { ...item, done: true, updatedAt: Date.now() } : item
          )
          await obsidianManager.syncTodoItems(updatedItems, template)
          message.success(`任务已完成: ${currentWorkContent}`)
          setSelectedTodoId(null)
          setCurrentPomodoroTask(null)
        } catch (error) {
          console.error('Failed to mark TODO as complete:', error)
        }
      }

      setCurrentWorkContent('')

      // 决定下一个模式
      if (newSessionCount % longBreakInterval === 0) {
        setCurrentMode('long_break')
        setTimeRemaining(longBreakDuration * 60)
        message.success('工作会话完成！开始长休息。')
      } else {
        setCurrentMode('short_break')
        setTimeRemaining(shortBreakDuration * 60)
        message.success('工作会话完成！开始短休息。')
      }
    } else {
      // 休息结束，回到工作模式
      setCurrentMode('work')
      setTimeRemaining(workDuration * 60)
      message.success('休息结束！开始工作。')
    }

    elapsedTimeRef.current = 0
  }

  /**
   * 移动到下一个模式（跳过时使用）
   */
  const moveToNextMode = () => {
    elapsedTimeRef.current = 0

    if (currentMode === 'work') {
      setCurrentWorkContent('')

      if (sessionCount % longBreakInterval === 0) {
        setCurrentMode('long_break')
        setTimeRemaining(longBreakDuration * 60)
      } else {
        setCurrentMode('short_break')
        setTimeRemaining(shortBreakDuration * 60)
      }
    } else {
      setCurrentMode('work')
      setTimeRemaining(workDuration * 60)
    }
  }

  /**
   * 播放通知声音并显示系统通知
   */
  const playNotificationSound = async () => {
    const body = currentMode === 'work' ? '工作会话完成！该休息一下了 ☕' : '休息结束！继续加油 🍅'
    const result = await notify(
      {
        channel: 'system',
        severity: 'success',
        title: '番茄钟',
        message: body,
      },
      { fallback: ['local'] }
    )
    if (!result.delivered) {
      console.error('Failed to show notification:', result.error)
    }
    // TODO: 播放音效
    // 可以使用 Web Audio API 或 HTML5 Audio
  }

  /**
   * 保存工作记录
   * 参考 Python: src/widgets/pomodoro_widget.py save_work_records()
   */
  const saveWorkRecord = async (record: WorkRecord) => {
    const newRecords = [...workRecords, record]
    setWorkRecords(newRecords)
    localStorage.setItem('pomodoro_records', JSON.stringify(newRecords))

    // 同步到 Markdown 文件
    try {
      const vaultPath =
        config.computer?.[await window.electronAPI.getHostname()]?.obsidian?.vault_path
      if (vaultPath) {
        // 使用 Obsidian Vault 中的周记文件
        const now = new Date()
        const year = now.getFullYear()
        const week = getWeekNumber(now)
        const fileName = `${year}-W${week.toString().padStart(2, '0')}.md`
        const filePath = `${vaultPath}/${fileName}`

        const markdownContent = `- [${record.completed_time}] ${record.content} (${record.duration}分钟) - ${record.status}`

        await obsidianManager.appendToSection(filePath, '番茄钟记录', markdownContent)
      }
    } catch (error) {
      console.error('Failed to sync to markdown:', error)
    }
  }

  /**
   * 获取 ISO 周数
   */
  const getWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  }

  /**
   * 确认 TODO 选择
   */
  const handleTodoSelectionConfirm = () => {
    if (selectedTodoId) {
      // 选择了 TODO 任务
      const selectedTodo = todoItems.find((t) => t.id === selectedTodoId)
      if (selectedTodo) {
        setCurrentWorkContent(selectedTodo.text)
      }
    } else if (manualInputInTodoDialog.trim()) {
      // 手动输入
      setCurrentWorkContent(manualInputInTodoDialog)
    } else {
      message.warning('请选择任务或输入工作内容')
      return
    }

    setTodoSelectionVisible(false)
    setSelectedTodoId(null)
    setManualInputInTodoDialog('')

    // 确认后开始计时
    setTimeout(() => startTimer(true), 100)
  }

  /**
   * 确认工作内容（手动输入）
   */
  const handleWorkContentConfirm = () => {
    if (!tempWorkContent.trim()) {
      message.warning('请输入工作内容')
      return
    }

    setCurrentWorkContent(tempWorkContent)
    setWorkInputVisible(false)
    setTempWorkContent('')

    // 确认后开始计时，跳过内容检查（因为我们刚设置了内容）
    setTimeout(() => startTimer(true), 100)
  }

  /**
   * 保存设置
   */
  const handleSaveSettings = async () => {
    try {
      const updatedConfig = {
        ...config,
        pomodoro: {
          work_duration: workDuration,
          short_break_duration: shortBreakDuration,
          long_break_duration: longBreakDuration,
          long_break_interval: longBreakInterval,
        },
      }

      await updateConfig(updatedConfig)
      setSettingsVisible(false)
      message.success('设置已保存')
      resetTimer()
    } catch (error) {
      message.error('保存失败')
    }
  }

  return (
    <WidgetLayout title="番茄时钟" icon="🍅">
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        {/* 计时器显示 */}
        <div style={{ marginBottom: 30 }}>
          <div
            style={{
              fontSize: 72,
              fontWeight: 'bold',
              fontFamily: 'monospace',
              marginBottom: 10,
              color:
                currentMode === 'work'
                  ? colors.primary
                  : currentMode === 'short_break'
                    ? colors.success
                    : colors.warning,
            }}
          >
            {formatTime(timeRemaining)}
          </div>
          <div style={{ fontSize: 20, color: colors.textSecondary, marginBottom: 20 }}>
            {getModeText(currentMode)}
          </div>
          {currentWorkContent && (
            <div style={{ fontSize: 16, color: colors.textPrimary }}>
              📝 当前工作: {currentWorkContent}
            </div>
          )}
        </div>

        {/* 控制按钮 */}
        <Space size="large" style={{ marginBottom: 40 }}>
          <Button
            type="primary"
            size="large"
            icon={isRunning ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
            onClick={() => (isRunning ? pauseTimer() : startTimer())}
          >
            {isRunning ? '暂停' : currentWorkContent ? '继续' : '开始'}
          </Button>
          <Button size="large" icon={<ReloadOutlined />} onClick={resetTimer}>
            重置
          </Button>
          <Button size="large" icon={<FastForwardOutlined />} onClick={skipSession}>
            跳过
          </Button>
        </Space>

        {/* 统计信息 */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, color: colors.textSecondary }}>📊 已完成: {sessionCount} 个</div>
        </div>

        {/* 底部按钮 */}
        <Space>
          <Button icon={<SettingOutlined />} onClick={() => setSettingsVisible(true)}>
            设置
          </Button>
          <Button icon={<FileTextOutlined />} onClick={() => setRecordsVisible(true)}>
            工作记录
          </Button>
        </Space>
      </div>

      {/* TODO 选择对话框 */}
      <Modal
        title="📋 选择待办任务"
        open={todoSelectionVisible}
        onOk={handleTodoSelectionConfirm}
        onCancel={() => {
          setTodoSelectionVisible(false)
          setSelectedTodoId(null)
          setManualInputInTodoDialog('')
        }}
        okText="确定"
        cancelText="取消"
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, color: colors.textSecondary }}>💡 提示：选择要专注完成的任务</div>
          <Radio.Group
            value={selectedTodoId}
            onChange={(e) => {
              setSelectedTodoId(e.target.value)
              setManualInputInTodoDialog('') // 清空手动输入
            }}
            style={{ width: '100%' }}
          >
            <List
              size="small"
              bordered
              dataSource={todoItems}
              locale={{ emptyText: '暂无待办任务' }}
              style={{ maxHeight: 300, overflow: 'auto', marginBottom: 16 }}
              renderItem={(todo) => (
                <List.Item>
                  <Radio value={todo.id} style={{ width: '100%' }}>
                    <span>
                      {todo.priority === 'high' && '🔴 '}
                      {todo.priority === 'low' && '🔵 '}
                      {todo.category && todo.category !== 'default' && `[${todo.category}] `}
                      {todo.text}
                    </span>
                  </Radio>
                </List.Item>
              )}
            />
          </Radio.Group>
        </div>

        <div style={{ borderTop: `1px solid ${colors.borderPrimary}`, paddingTop: 16 }}>
          <div style={{ marginBottom: 8, color: colors.textSecondary }}>✏️ 或手动输入工作内容</div>
          <Input
            placeholder="手动输入工作内容..."
            value={manualInputInTodoDialog}
            onChange={(e) => {
              setManualInputInTodoDialog(e.target.value)
              setSelectedTodoId(null) // 清空选择
            }}
          />
        </div>
      </Modal>

      {/* 工作内容输入对话框 */}
      <Modal
        title="工作内容"
        open={workInputVisible}
        onOk={handleWorkContentConfirm}
        onCancel={() => {
          setWorkInputVisible(false)
          setTempWorkContent('')
        }}
        okText="确定"
        cancelText="取消"
      >
        <Input.TextArea
          placeholder="请输入本次工作的内容..."
          value={tempWorkContent}
          onChange={(e) => setTempWorkContent(e.target.value)}
          rows={4}
          autoFocus
        />
      </Modal>

      {/* 设置对话框 */}
      <Modal
        title="⚙️ 番茄钟设置"
        open={settingsVisible}
        onOk={handleSaveSettings}
        onCancel={() => setSettingsVisible(false)}
        okText="保存"
        cancelText="取消"
        width={500}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <div style={{ marginBottom: 8 }}>🍅 工作时长 (分钟):</div>
            <Input
              type="number"
              value={workDuration}
              onChange={(e) => setWorkDuration(Number(e.target.value))}
              min={1}
              max={120}
            />
          </div>
          <div>
            <div style={{ marginBottom: 8 }}>☕ 短休息 (分钟):</div>
            <Input
              type="number"
              value={shortBreakDuration}
              onChange={(e) => setShortBreakDuration(Number(e.target.value))}
              min={1}
              max={60}
            />
          </div>
          <div>
            <div style={{ marginBottom: 8 }}>🌟 长休息 (分钟):</div>
            <Input
              type="number"
              value={longBreakDuration}
              onChange={(e) => setLongBreakDuration(Number(e.target.value))}
              min={1}
              max={120}
            />
          </div>
          <div>
            <div style={{ marginBottom: 8 }}>🔄 长休息间隔:</div>
            <Input
              type="number"
              value={longBreakInterval}
              onChange={(e) => setLongBreakInterval(Number(e.target.value))}
              min={2}
              max={10}
            />
          </div>
        </Space>
      </Modal>

      {/* 工作记录对话框 */}
      <Modal
        title="📝 工作记录"
        open={recordsVisible}
        onCancel={() => setRecordsVisible(false)}
        footer={[
          <Button key="close" onClick={() => setRecordsVisible(false)}>
            关闭
          </Button>,
        ]}
        width={700}
      >
        {workRecords.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: colors.textSecondary }}>
            暂无工作记录
            <br />
            <br />
            💡 完成番茄钟后，这里会显示工作历史记录
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: 16, fontWeight: 'bold' }}>
              总计完成: {workRecords.length} 个番茄钟
            </div>
            <div style={{ maxHeight: 400, overflow: 'auto' }}>
              {workRecords
                .slice()
                .reverse()
                .slice(0, 20)
                .map((record, index) => (
                  <Card key={index} size="small" style={{ marginBottom: 8 }}>
                    <div>
                      {record.status === '完成' ? '✅' : '⏭️'} #{record.session_number} -{' '}
                      {record.content}
                    </div>
                    <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
                      ⏱️ 时长: {record.duration}分钟 | 📅 {record.completed_time} | 📊{' '}
                      {record.status}
                    </div>
                  </Card>
                ))}
            </div>
          </div>
        )}
      </Modal>
    </WidgetLayout>
  )
}

export default PomodoroWidget
