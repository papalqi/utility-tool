/**
 * 番茄钟 Widget
 * 使用全局状态，支持 compact 模式嵌入 Dashboard 和 TODO 页面
 */

import React, { useState, useEffect, useRef } from 'react'
import { Button, Input, Modal, App, Space, Card } from 'antd'
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  FastForwardOutlined,
  SettingOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'
import { WidgetLayout } from '@/components/widgets'
import { useConfig, useConfigUpdate } from '@/hooks/useConfig'
import { TodoItem } from '@/shared/types'
import { useAppContext } from '@/context/AppContext'
import { useTheme } from '@/contexts/ThemeContext'
import useNotifier from '@/hooks/useNotifier'
import { obsidianManager } from '@/core/ObsidianManager'

interface PomodoroWidgetProps {
  /** 紧凑模式 - 用于嵌入 Dashboard 和 TODO 页面 */
  compact?: boolean
  /** 关联的任务（紧凑模式下使用） */
  linkedTask?: TodoItem | null
}

export const PomodoroWidget: React.FC<PomodoroWidgetProps> = ({
  compact = false,
  linkedTask,
}) => {
  const { message } = App.useApp()
  const config = useConfig()
  const { updateConfig } = useConfigUpdate()
  const { pomodoroState, pomodoroActions } = useAppContext()
  const { colors } = useTheme()
  const { notify } = useNotifier()

  // 从全局状态读取，提供默认值防止 undefined
  const { mode, timeRemaining, isRunning, sessionCount, workContent } = pomodoroState || {
    mode: 'work' as const,
    timeRemaining: 25 * 60,
    isRunning: false,
    sessionCount: 0,
    workContent: '',
  }

  // 用于追踪上一次的状态，检测会话完成
  // 注意：需要带上 workContent，避免在会话结束后被清空导致无法写入 Obsidian
  const prevStateRef = useRef({
    timeRemaining,
    mode,
    sessionCount,
    workContent,
  })

  // 配置状态（用于设置对话框）
  const [workDuration, setWorkDuration] = useState(25)
  const [shortBreakDuration, setShortBreakDuration] = useState(5)
  const [longBreakDuration, setLongBreakDuration] = useState(15)
  const [longBreakInterval, setLongBreakInterval] = useState(4)

  // 对话框状态
  const [settingsVisible, setSettingsVisible] = useState(false)
  const [taskInputVisible, setTaskInputVisible] = useState(false)
  const [tempTaskContent, setTempTaskContent] = useState('')

  // 当 linkedTask 变化时，设置任务
  useEffect(() => {
    if (linkedTask && !isRunning) {
      pomodoroActions.setTask(linkedTask)
    }
  }, [linkedTask, isRunning, pomodoroActions])

  // 加载配置
  useEffect(() => {
    const pomodoroConfig = config.pomodoro || {}
    setWorkDuration(pomodoroConfig.work_duration || 25)
    setShortBreakDuration(pomodoroConfig.short_break_duration || 5)
    setLongBreakDuration(pomodoroConfig.long_break_duration || 15)
    setLongBreakInterval(pomodoroConfig.long_break_interval || 4)
  }, [config])

  // 检测会话完成，发送通知和保存工作记录
  useEffect(() => {
    const prev = prevStateRef.current

    // 检测工作会话完成（sessionCount 增加且之前是工作模式）
    if (sessionCount > prev.sessionCount && prev.mode === 'work') {
      // 发送通知
      notify({
        title: '🍅 番茄钟完成！',
        message: `工作时间结束，休息一下吧！${prev.workContent ? `\n${prev.workContent}` : ''}`,
        channel: 'system',
      })

      // 保存工作记录到 Obsidian
      if (prev.workContent) {
        saveWorkRecordToObsidian(prev.workContent, workDuration, sessionCount)
      }
    }

    // 检测休息完成（从休息模式切换到工作模式）
    if ((prev.mode === 'short_break' || prev.mode === 'long_break') && mode === 'work') {
      notify({
        title: '☕ 休息结束！',
        message: '准备开始下一个番茄钟',
        channel: 'system',
      })
    }

    // 更新 ref
    prevStateRef.current = { timeRemaining, mode, sessionCount, workContent }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionCount, mode, notify, workContent, workDuration])

  // 保存工作记录到 Obsidian
  const saveWorkRecordToObsidian = async (content: string, duration: number, session: number) => {
    try {
      if (!obsidianManager.isEnabled()) {
        console.log('Obsidian not enabled, skipping record save')
        return
      }

      // 优先使用专门的 Pomodoro 模板，其次回退到通用内容模板
      const pomodoroTemplate =
        config.global?.obsidian?.content_files?.pomodoro_template ||
        config.global?.obsidian?.content_files?.template ||
        '{year}-W{week}.md'

      const filePath = obsidianManager.getTemplatePath(pomodoroTemplate)
      const now = new Date()
      const record = `- 🍅 ${now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} [${duration}分钟] ${content} (#${session})`

      // 追加到 Pomodoro 段落
      await obsidianManager.appendToSection(filePath, 'Pomodoro', record)
      console.log('Work record saved to Obsidian:', {
        record,
        filePath,
      })
    } catch (error) {
      console.error('Failed to save work record:', error)
    }
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getModeText = () => {
    switch (mode) {
      case 'work': return '🍅 工作时间'
      case 'short_break': return '☕ 短休息'
      case 'long_break': return '🌟 长休息'
    }
  }

  const getModeColor = () => {
    switch (mode) {
      case 'work': return colors.primary
      case 'short_break': return colors.success
      case 'long_break': return colors.warning
    }
  }

  const handleStart = () => {
    // 如果没有任务内容且是工作模式，显示输入对话框
    if (mode === 'work' && !workContent && !linkedTask) {
      setTaskInputVisible(true)
      return
    }
    pomodoroActions.start(linkedTask)
  }

  const handleTaskInputConfirm = () => {
    if (tempTaskContent.trim()) {
      pomodoroActions.setWorkContent(tempTaskContent.trim())
      setTaskInputVisible(false)
      setTempTaskContent('')
      // 设置内容后开始计时
      setTimeout(() => pomodoroActions.start(), 100)
    } else {
      message.warning('请输入工作内容')
    }
  }

  const handlePause = () => {
    pomodoroActions.pause()
  }

  const handleReset = () => {
    pomodoroActions.reset(workDuration)
  }

  const handleSkip = () => {
    pomodoroActions.skip(shortBreakDuration, longBreakDuration, longBreakInterval)
  }

  // 立刻完成当前番茄（用于任务提前完成的场景）
  // 语义上等价于“本次工作会话视为完成，并立即进入休息/下一阶段”
  const handleCompleteNow = () => {
    if (mode !== 'work') return
    handleSkip()
  }

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
      handleReset()
    } catch {
      message.error('保存失败')
    }
  }

  // 任务输入对话框
  const TaskInputModal = (
    <Modal
      title="📝 输入工作内容"
      open={taskInputVisible}
      onOk={handleTaskInputConfirm}
      onCancel={() => {
        setTaskInputVisible(false)
        setTempTaskContent('')
      }}
      okText="开始"
      cancelText="取消"
      width={400}
    >
      <Input.TextArea
        placeholder="请输入本次要专注的工作内容..."
        value={tempTaskContent}
        onChange={(e) => setTempTaskContent(e.target.value)}
        rows={3}
        autoFocus
      />
    </Modal>
  )

  // 设置对话框
  const SettingsModal = (
    <Modal
      title="⚙️ 番茄钟设置"
      open={settingsVisible}
      onOk={handleSaveSettings}
      onCancel={() => setSettingsVisible(false)}
      okText="保存"
      cancelText="取消"
      width={400}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <div>
          <div style={{ marginBottom: 4 }}>🍅 工作时长 (分钟):</div>
          <Input type="number" value={workDuration} onChange={(e) => setWorkDuration(Number(e.target.value))} min={1} max={120} />
        </div>
        <div>
          <div style={{ marginBottom: 4 }}>☕ 短休息 (分钟):</div>
          <Input type="number" value={shortBreakDuration} onChange={(e) => setShortBreakDuration(Number(e.target.value))} min={1} max={60} />
        </div>
        <div>
          <div style={{ marginBottom: 4 }}>🌟 长休息 (分钟):</div>
          <Input type="number" value={longBreakDuration} onChange={(e) => setLongBreakDuration(Number(e.target.value))} min={1} max={120} />
        </div>
        <div>
          <div style={{ marginBottom: 4 }}>🔄 长休息间隔:</div>
          <Input type="number" value={longBreakInterval} onChange={(e) => setLongBreakInterval(Number(e.target.value))} min={2} max={10} />
        </div>
      </Space>
    </Modal>
  )

  // 紧凑模式渲染
  if (compact) {
    return (
      <Card
        size="small"
        style={{
          background: colors.bgSecondary,
          border: `1px solid ${colors.borderPrimary}`,
          borderRadius: 16,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: colors.textSecondary }}>
              {mode === 'work' ? '🍅 工作' : mode === 'short_break' ? '☕ 短休' : '🌟 长休'}
            </span>
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 'bold',
              fontFamily: 'monospace',
              color: getModeColor(),
              marginBottom: 8,
            }}
          >
            {formatTime(timeRemaining)}
          </div>
          {workContent && (
            <div style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 8 }}>
              📝 {workContent}
            </div>
          )}
          <Space size="small">
            <Button
              type={isRunning ? 'default' : 'primary'}
              size="small"
              icon={isRunning ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              onClick={isRunning ? handlePause : handleStart}
            />
            <Button size="small" icon={<ReloadOutlined />} onClick={handleReset} />
            {mode === 'work' ? (
              <Button size="small" icon={<CheckCircleOutlined />} onClick={handleCompleteNow} />
            ) : (
              <Button size="small" icon={<FastForwardOutlined />} onClick={handleSkip} />
            )}
            <Button size="small" icon={<SettingOutlined />} onClick={() => setSettingsVisible(true)} />
          </Space>
          <div style={{ marginTop: 8, fontSize: 11, color: colors.textSecondary }}>
            已完成: {sessionCount} 个
          </div>
        </div>
        {TaskInputModal}
        {SettingsModal}
      </Card>
    )
  }

  // 完整模式渲染
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
              color: getModeColor(),
            }}
          >
            {formatTime(timeRemaining)}
          </div>
          <div style={{ fontSize: 20, color: colors.textSecondary, marginBottom: 20 }}>
            {getModeText()}
          </div>
          {workContent && (
            <div style={{ fontSize: 16, color: colors.textPrimary }}>
              📝 当前工作: {workContent}
            </div>
          )}
        </div>

        {/* 控制按钮 */}
        <Space size="large" style={{ marginBottom: 40 }}>
          <Button
            type="primary"
            size="large"
            icon={isRunning ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
            onClick={isRunning ? handlePause : handleStart}
          >
            {isRunning ? '暂停' : workContent ? '继续' : '开始'}
          </Button>
          <Button size="large" icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
          {mode === 'work' ? (
            <Button size="large" icon={<CheckCircleOutlined />} onClick={handleCompleteNow}>
              立刻完成
            </Button>
          ) : (
            <Button size="large" icon={<FastForwardOutlined />} onClick={handleSkip}>
              跳过
            </Button>
          )}
        </Space>

        {/* 统计信息 */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, color: colors.textSecondary }}>
            📊 已完成: {sessionCount} 个番茄钟
          </div>
        </div>

        {/* 设置按钮 */}
        <Button icon={<SettingOutlined />} onClick={() => setSettingsVisible(true)}>
          设置
        </Button>
      </div>

      {TaskInputModal}
      {SettingsModal}
    </WidgetLayout>
  )
}

export default PomodoroWidget
