/**
 * ExampleWidget - 示例 Widget
 *
 * 展示如何使用新的 Widget 架构：
 * - useWidget: 生命周期管理
 * - useWidgetStorage: 本地存储
 * - useWidgetActions: 操作管理
 * - WidgetLayout: 统一布局
 * - WidgetSection: 分组区域
 *
 * 这是一个简单的计数器 Widget，作为开发其他 Widget 的模板
 */

import React, { useState } from 'react'
import { Button, Space, Typography, InputNumber, message } from 'antd'
import { PlusOutlined, MinusOutlined, ExperimentOutlined } from '@ant-design/icons'
import { useWidget } from '@/hooks/useWidget'
import { useWidgetStorage } from '@/hooks/useWidgetStorage'
import { useWidgetActions } from '@/hooks/useWidgetActions'
import { WidgetLayout, WidgetSection } from '@/components/widgets'
import { WidgetMetadata } from '@/shared/widget-types'

const { Title, Text } = Typography

/**
 * Widget 本地状态类型
 */
interface CounterState {
  count: number
  history: number[]
  lastUpdated: number
}

/**
 * Widget 元数据
 */
const metadata: WidgetMetadata = {
  id: 'example-counter',
  displayName: '计数器示例',
  icon: <ExperimentOutlined />,
  description: '演示新 Widget 架构的示例计数器',
  category: 'development',
  order: 999,
  enabled: true,
  requiresObsidian: false,
}

/**
 * ExampleWidget 组件
 */
export const ExampleWidget: React.FC = () => {
  // ==================== Hooks ====================

  /**
   * 核心 Widget 生命周期管理
   */
  const { state, setStatus, widgetLogger } = useWidget({
    metadata,
    lifecycle: {
      onInit: async () => {
        widgetLogger.info('Initializing example widget...')
        // 模拟异步初始化
        await new Promise((resolve) => setTimeout(resolve, 500))
        widgetLogger.info('Example widget initialized')
      },
      onMount: () => {
        widgetLogger.debug('Example widget mounted')
        setStatus('就绪')
      },
      onUnmount: () => {
        widgetLogger.debug('Example widget unmounting')
      },
      onConfigChange: () => {
        widgetLogger.debug('Config changed')
      },
      onThemeChange: () => {
        widgetLogger.debug('Theme changed')
      },
    },
  })

  /**
   * 本地存储管理
   */
  const { value: counterData, setValue: setCounterData } = useWidgetStorage<CounterState>({
    key: 'example-counter-data',
    defaultValue: {
      count: 0,
      history: [],
      lastUpdated: Date.now(),
    },
    persist: true,
  })

  /**
   * Widget 操作管理
   */
  const { refresh, save, isActionInProgress } = useWidgetActions({
    widgetId: metadata.id,
    onRefresh: async () => {
      widgetLogger.info('Refreshing data...')
      // 模拟刷新操作
      await new Promise((resolve) => setTimeout(resolve, 1000))
      message.success('刷新成功')
    },
    onSave: async () => {
      widgetLogger.info('Saving data...')
      // 模拟保存操作
      await new Promise((resolve) => setTimeout(resolve, 800))
      message.success('保存成功')
    },
  })

  // ==================== Local State ====================

  const [step, setStep] = useState(1)

  // ==================== Handlers ====================

  /**
   * 增加计数
   */
  const handleIncrement = () => {
    const newCount = counterData.count + step
    setCounterData({
      count: newCount,
      history: [...counterData.history, newCount],
      lastUpdated: Date.now(),
    })
    widgetLogger.debug(`Count incremented to: ${newCount}`)
  }

  /**
   * 减少计数
   */
  const handleDecrement = () => {
    const newCount = counterData.count - step
    setCounterData({
      count: newCount,
      history: [...counterData.history, newCount],
      lastUpdated: Date.now(),
    })
    widgetLogger.debug(`Count decremented to: ${newCount}`)
  }

  /**
   * 重置计数
   */
  const handleReset = () => {
    setCounterData({
      count: 0,
      history: [],
      lastUpdated: Date.now(),
    })
    widgetLogger.info('Counter reset')
    message.info('计数器已重置')
  }

  // ==================== Render ====================

  return (
    <WidgetLayout
      title={metadata.displayName}
      icon={metadata.icon}
      loading={state.loading}
      error={state.error}
      showRefresh={true}
      onRefresh={refresh}
      showSave={true}
      onSave={save}
      actionInProgress={isActionInProgress}
    >
      {/* 当前计数 */}
      <WidgetSection title="当前计数" icon={<ExperimentOutlined />}>
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <Title level={1} style={{ margin: 0, fontSize: 64 }}>
            {counterData.count}
          </Title>
          <Text type="secondary">
            上次更新: {new Date(counterData.lastUpdated).toLocaleString()}
          </Text>
        </div>

        <Space direction="vertical" style={{ width: '100%', marginTop: 16 }} size="middle">
          {/* 步长设置 */}
          <div style={{ textAlign: 'center' }}>
            <Text>步长: </Text>
            <InputNumber
              min={1}
              max={100}
              value={step}
              onChange={(val) => setStep(val || 1)}
              style={{ width: 100, marginLeft: 8 }}
            />
          </div>

          {/* 操作按钮 */}
          <Space style={{ width: '100%', justifyContent: 'center' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleIncrement} size="large">
              增加
            </Button>
            <Button icon={<MinusOutlined />} onClick={handleDecrement} size="large">
              减少
            </Button>
            <Button onClick={handleReset} size="large" danger>
              重置
            </Button>
          </Space>
        </Space>
      </WidgetSection>

      {/* 历史记录 */}
      <WidgetSection
        title="历史记录"
        extra={
          <Text type="secondary" style={{ fontSize: 12 }}>
            共 {counterData.history.length} 条
          </Text>
        }
        collapsible
        defaultCollapsed={true}
      >
        {counterData.history.length === 0 ? (
          <Text type="secondary">暂无历史记录</Text>
        ) : (
          <div
            style={{
              maxHeight: 200,
              overflowY: 'auto',
            }}
          >
            {counterData.history.map((value, index) => (
              <div
                key={index}
                style={{
                  padding: '4px 8px',
                  borderBottom: '1px solid #f0f0f0',
                }}
              >
                <Text>
                  #{index + 1}: <strong>{value}</strong>
                </Text>
              </div>
            ))}
          </div>
        )}
      </WidgetSection>

      {/* 状态信息 */}
      <WidgetSection title="Widget 状态">
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <div>
            <Text type="secondary">状态消息: </Text>
            <Text>{state.statusMessage}</Text>
          </div>
          <div>
            <Text type="secondary">已初始化: </Text>
            <Text>{state.initialized ? '是' : '否'}</Text>
          </div>
          <div>
            <Text type="secondary">正在加载: </Text>
            <Text>{state.loading ? '是' : '否'}</Text>
          </div>
        </Space>
      </WidgetSection>

      {/* 架构说明 */}
      <WidgetSection title="架构说明" collapsible defaultCollapsed={true}>
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <Text>
            <strong>✅ useWidget:</strong> 自动生命周期管理、日志、错误处理
          </Text>
          <Text>
            <strong>✅ useWidgetStorage:</strong> 本地持久化存储
          </Text>
          <Text>
            <strong>✅ useWidgetActions:</strong> 统一操作管理（刷新、保存）
          </Text>
          <Text>
            <strong>✅ WidgetLayout:</strong> 统一布局和 UI 组件
          </Text>
          <Text>
            <strong>✅ WidgetSection:</strong> 可折叠的内容分组
          </Text>
        </Space>
      </WidgetSection>
    </WidgetLayout>
  )
}

export default ExampleWidget
