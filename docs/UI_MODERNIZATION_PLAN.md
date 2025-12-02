# PC Utility Tool - 前端现代化改造方案

> **版本**: v2.0
> **日期**: 2025-12-02
> **状态**: 待审核
> **预计实施周期**: 4-6 周

---

## 目录

1. [设计理念](#1-设计理念)
2. [全局设计系统升级](#2-全局设计系统升级)
3. [各 Widget 改造方案](#3-各-widget-改造方案)
4. [新增交互特性](#4-新增交互特性)
5. [技术实现方案](#5-技术实现方案)
6. [实施优先级](#6-实施优先级)
7. [验收标准](#7-验收标准)

---

## 1. 设计理念

### 1.1 核心原则

**"流畅、高效、美观"**

- **流畅 (Fluid)**: 丝滑的动画、自然的过渡、即时的反馈
- **高效 (Efficient)**: 减少点击步骤、智能快捷操作、上下文感知
- **美观 (Beautiful)**: 现代化视觉、科技感、专业级品质

### 1.2 设计语言

#### 视觉风格
- **新拟态主义 (Neomorphism)** + **玻璃态 (Glassmorphism)** 混合
- **渐变与光影**: 使用细腻的渐变营造深度
- **动态图形**: 数据可视化优先，用图表代替文字
- **微交互**: 每个操作都有视觉反馈

#### 色彩系统
```
主色调 (Primary):
  - Light Mode: #6366F1 (Indigo-500)
  - Dark Mode:  #818CF8 (Indigo-400)

强调色 (Accent):
  - Success: #10B981 (Emerald-500)
  - Warning: #F59E0B (Amber-500)
  - Danger:  #EF4444 (Red-500)
  - Info:    #3B82F6 (Blue-500)

渐变组合:
  - Primary Gradient:   linear-gradient(135deg, #667EEA 0%, #764BA2 100%)
  - Success Gradient:   linear-gradient(135deg, #10B981 0%, #059669 100%)
  - Warning Gradient:   linear-gradient(135deg, #F59E0B 0%, #D97706 100%)
  - Danger Gradient:    linear-gradient(135deg, #EF4444 0%, #DC2626 100%)
  - Neutral Gradient:   linear-gradient(135deg, #6B7280 0%, #4B5563 100%)
```

#### 排版系统
```
标题层级:
  - H1: 32px/600 (Dashboard 欢迎语)
  - H2: 24px/600 (Widget 标题)
  - H3: 18px/600 (Section 标题)
  - H4: 16px/600 (卡片标题)

正文:
  - Body Large:  16px/400 (主要内容)
  - Body Medium: 14px/400 (次要内容)
  - Body Small:  12px/400 (辅助信息)

等宽字体 (代码):
  - JetBrains Mono, Fira Code, Consolas
```

#### 间距系统 (8px 基础单位)
```
xs:   4px   (紧凑间距)
sm:   8px   (小间距)
md:   16px  (默认间距)
lg:   24px  (大间距)
xl:   32px  (超大间距)
2xl:  48px  (章节间距)
```

#### 圆角系统
```
小圆角:   8px   (按钮、输入框)
中圆角:   12px  (小卡片)
大圆角:   16px  (主要卡片)
超大圆角: 24px  (Dashboard 卡片)
```

---

## 2. 全局设计系统升级

### 2.1 玻璃态增强

**当前问题**:
- Glass effect 使用较保守
- 透明度和模糊度不够
- 缺少光影层次

**改造方案**:
```css
/* 新的 Glass 变量 (src/styles/index.css) */
[data-theme='dark'] {
  --glass-bg: rgba(30, 30, 30, 0.7);           /* 更透明 */
  --glass-backdrop: blur(20px) saturate(180%); /* 更强模糊 */
  --glass-border: rgba(255, 255, 255, 0.12);   /* 更柔和边框 */
  --glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.3),
                  0 2px 8px rgba(0, 0, 0, 0.2); /* 双层阴影 */

  /* 光泽效果 */
  --glass-highlight: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.1) 0%,
    rgba(255, 255, 255, 0) 50%
  );
}

[data-theme='light'] {
  --glass-bg: rgba(255, 255, 255, 0.6);
  --glass-backdrop: blur(20px) saturate(180%);
  --glass-border: rgba(0, 0, 0, 0.08);
  --glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.08),
                  0 2px 8px rgba(0, 0, 0, 0.04);

  --glass-highlight: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.9) 0%,
    rgba(255, 255, 255, 0) 50%
  );
}

/* 应用到卡片 */
.modern-glass-card {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-backdrop);
  -webkit-backdrop-filter: var(--glass-backdrop);
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow);
  position: relative;
  overflow: hidden;
}

.modern-glass-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 50%;
  background: var(--glass-highlight);
  pointer-events: none;
}
```

**效果**:
- 更强的通透感
- 更丰富的光影层次
- 更明显的深度感

---

### 2.2 动画系统升级

**新增动画库** (`src/styles/animations.css`):

```css
/* 渐入动画 */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeInLeft {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes fadeInRight {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* 缩放动画 */
@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* 脉冲动画 */
@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.8;
  }
}

/* 闪烁动画 (用于通知) */
@keyframes blink {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}

/* 渐变移动动画 (用于背景) */
@keyframes gradientShift {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

/* 加载骨架动画 */
@keyframes shimmer {
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
}

/* 工具类 */
.animate-fade-in-up {
  animation: fadeInUp 0.5s ease-out;
}

.animate-fade-in-down {
  animation: fadeInDown 0.5s ease-out;
}

.animate-scale-in {
  animation: scaleIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.animate-gradient {
  background-size: 200% 200%;
  animation: gradientShift 3s ease infinite;
}
```

**使用方式**:
```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.4, ease: 'easeOut' }}
>
  {content}
</motion.div>
```

---

### 2.3 新增通用组件

#### 2.3.1 现代统计卡片 (`src/components/modern/StatCard.tsx`)

```tsx
import React from 'react'
import { Card, Typography, Space } from 'antd'
import { motion } from 'framer-motion'
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  gradient: string
  trend?: {
    value: number
    isUp: boolean
  }
  onClick?: () => void
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  gradient,
  trend,
  onClick,
}) => {
  return (
    <motion.div
      whileHover={{ scale: 1.05, y: -5 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 300 }}
    >
      <Card
        hoverable
        onClick={onClick}
        className="modern-glass-card"
        style={{
          background: gradient,
          border: 'none',
          cursor: onClick ? 'pointer' : 'default',
          position: 'relative',
          overflow: 'hidden',
        }}
        styles={{
          body: {
            padding: '24px',
          },
        }}
      >
        {/* 背景装饰图标 */}
        <div
          style={{
            position: 'absolute',
            top: -20,
            right: -20,
            fontSize: 120,
            opacity: 0.15,
            color: '#fff',
          }}
        >
          {icon}
        </div>

        {/* 内容 */}
        <Space direction="vertical" size={4} style={{ position: 'relative' }}>
          <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14 }}>{title}</Text>
          <Title level={2} style={{ color: '#fff', margin: 0 }}>
            {value}
          </Title>
          {trend && (
            <Space size={4}>
              {trend.isUp ? (
                <ArrowUpOutlined style={{ color: '#10B981' }} />
              ) : (
                <ArrowDownOutlined style={{ color: '#EF4444' }} />
              )}
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
                {Math.abs(trend.value)}% vs 上周
              </Text>
            </Space>
          )}
        </Space>
      </Card>
    </motion.div>
  )
}
```

**效果**:
- 悬停时放大并上升
- 渐变背景
- 半透明背景图标
- 趋势指示器

---

#### 2.3.2 数据图表卡片 (`src/components/modern/ChartCard.tsx`)

```tsx
import React from 'react'
import { Card, Typography, Space } from 'antd'
import { Line, Bar, Pie } from '@ant-design/charts'

const { Title } = Typography

interface ChartCardProps {
  title: string
  icon?: React.ReactNode
  chartType: 'line' | 'bar' | 'pie'
  data: any[]
  config?: any
}

export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  icon,
  chartType,
  data,
  config,
}) => {
  const renderChart = () => {
    const defaultConfig = {
      data,
      height: 200,
      smooth: true,
      animation: {
        appear: {
          animation: 'path-in',
          duration: 1000,
        },
      },
      ...config,
    }

    switch (chartType) {
      case 'line':
        return <Line {...defaultConfig} />
      case 'bar':
        return <Bar {...defaultConfig} />
      case 'pie':
        return <Pie {...defaultConfig} />
      default:
        return null
    }
  }

  return (
    <Card
      className="modern-glass-card"
      bordered={false}
      title={
        <Space>
          {icon}
          <Title level={4} style={{ margin: 0 }}>
            {title}
          </Title>
        </Space>
      }
    >
      {renderChart()}
    </Card>
  )
}
```

**依赖**: `@ant-design/charts` (需要安装)

---

#### 2.3.3 快速操作按钮 (`src/components/modern/QuickActionButton.tsx`)

```tsx
import React from 'react'
import { Button, Tooltip } from 'antd'
import { motion } from 'framer-motion'

interface QuickActionButtonProps {
  icon: React.ReactNode
  label: string
  onClick: () => void
  gradient?: string
  size?: 'small' | 'middle' | 'large'
}

export const QuickActionButton: React.FC<QuickActionButtonProps> = ({
  icon,
  label,
  onClick,
  gradient = 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)',
  size = 'large',
}) => {
  return (
    <Tooltip title={label}>
      <motion.div
        whileHover={{ scale: 1.1, rotate: 5 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 400 }}
      >
        <Button
          type="primary"
          shape="circle"
          size={size}
          icon={icon}
          onClick={onClick}
          style={{
            background: gradient,
            border: 'none',
            boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
          }}
        />
      </motion.div>
    </Tooltip>
  )
}
```

---

## 3. 各 Widget 改造方案

### 3.1 DashboardWidget - 智能仪表盘

#### 当前问题
1. 布局单调，缺少视觉焦点
2. 数据展示以文字为主，缺少图表
3. 卡片设计同质化
4. 缺少个性化和自定义

#### 改造方案

##### 3.1.1 整体布局重构

**新布局结构**:
```
┌─────────────────────────────────────────────────────────────┐
│  Hero Section (欢迎区域)                                     │
│  ┌─────────────────┬───────────────┬───────────────┐        │
│  │ 时间卡片 (大)   │ 天气卡片      │ 番茄钟紧凑版  │        │
│  └─────────────────┴───────────────┴───────────────┘        │
├─────────────────────────────────────────────────────────────┤
│  Quick Stats (快速统计)                                      │
│  ┌──────┬──────┬──────┬──────┬──────┐                      │
│  │ TODO │ 日程 │ 项目 │ 终端 │ 自定义│                      │
│  └──────┴──────┴──────┴──────┴──────┘                      │
├─────────────────────────────────────────────────────────────┤
│  Main Content Area                                           │
│  ┌─────────────────────┬─────────────────────────────┐     │
│  │ 左侧 (2/3)          │ 右侧 (1/3)                  │     │
│  │ ┌─────────────────┐ │ ┌─────────────────────────┐ │     │
│  │ │ 活动时间线      │ │ │ 今日待办 (可拖拽)       │ │     │
│  │ └─────────────────┘ │ └─────────────────────────┘ │     │
│  │ ┌─────────────────┐ │ ┌─────────────────────────┐ │     │
│  │ │ 资源监控图表    │ │ │ 今日日程                │ │     │
│  │ └─────────────────┘ │ └─────────────────────────┘ │     │
│  │ ┌─────────────────┐ │ ┌─────────────────────────┐ │     │
│  │ │ 最近项目        │ │ │ 快速链接                │ │     │
│  │ └─────────────────┘ │ └─────────────────────────┘ │     │
│  └─────────────────────┴─────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

##### 3.1.2 Hero Section 改造

**时间卡片增强**:
```tsx
<motion.div
  initial={{ opacity: 0, scale: 0.9 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={{ duration: 0.6, ease: 'easeOut' }}
>
  <Card
    className="time-hero-card"
    style={{
      background: 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)',
      border: 'none',
      height: 200,
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    {/* 动态背景粒子 */}
    <div className="particles-background" />

    <div style={{ position: 'relative', zIndex: 1 }}>
      <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 16 }}>
        {getGreeting()}
      </Text>
      <Title level={1} style={{ color: '#fff', margin: '8px 0', fontSize: 48 }}>
        {time.toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit'
        })}
      </Title>
      <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14 }}>
        {time.toLocaleDateString('zh-CN', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}
      </Text>
    </div>
  </Card>
</motion.div>
```

**新增天气卡片**:
```tsx
<Card
  className="weather-card modern-glass-card"
  style={{ height: 200 }}
>
  <Space direction="vertical" align="center" style={{ width: '100%' }}>
    <div style={{ fontSize: 64 }}>☀️</div>
    <Title level={2} style={{ margin: 0 }}>24°C</Title>
    <Text type="secondary">晴天 · 空气良好</Text>
    <Space size={16} style={{ marginTop: 8 }}>
      <Text type="secondary">💧 60%</Text>
      <Text type="secondary">🌬️ 5m/s</Text>
    </Space>
  </Space>
</Card>
```

##### 3.1.3 Quick Stats 统计卡片

**使用新的 StatCard 组件**:
```tsx
<Row gutter={[16, 16]}>
  <Col span={4}>
    <StatCard
      title="待办任务"
      value={todoCount}
      icon={<CheckSquareOutlined />}
      gradient="linear-gradient(135deg, #667EEA 0%, #764BA2 100%)"
      trend={{ value: 12, isUp: true }}
      onClick={() => setActiveWidget('todo')}
    />
  </Col>
  <Col span={4}>
    <StatCard
      title="今日日程"
      value={eventCount}
      icon={<CalendarOutlined />}
      gradient="linear-gradient(135deg, #10B981 0%, #059669 100%)"
      onClick={() => setActiveWidget('calendar')}
    />
  </Col>
  {/* 其他统计卡片... */}
</Row>
```

##### 3.1.4 活动时间线 (Timeline)

**新增组件** (`src/components/dashboard/ActivityTimeline.tsx`):
```tsx
import { Timeline, Typography, Space, Avatar } from 'antd'
import {
  CheckCircleOutlined,
  CodeOutlined,
  RocketOutlined,
} from '@ant-design/icons'

const { Text } = Typography

interface Activity {
  time: string
  type: 'todo' | 'commit' | 'build' | 'other'
  title: string
  description?: string
}

export const ActivityTimeline: React.FC<{ activities: Activity[] }> = ({
  activities,
}) => {
  const getIcon = (type: string) => {
    switch (type) {
      case 'todo':
        return <CheckCircleOutlined style={{ color: '#10B981' }} />
      case 'commit':
        return <CodeOutlined style={{ color: '#3B82F6' }} />
      case 'build':
        return <RocketOutlined style={{ color: '#F59E0B' }} />
      default:
        return <CheckCircleOutlined />
    }
  }

  return (
    <Card title="活动时间线" className="modern-glass-card">
      <Timeline
        items={activities.map((activity) => ({
          dot: (
            <Avatar
              size="small"
              icon={getIcon(activity.type)}
              style={{ backgroundColor: 'transparent' }}
            />
          ),
          children: (
            <Space direction="vertical" size={0}>
              <Text strong>{activity.title}</Text>
              {activity.description && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {activity.description}
                </Text>
              )}
              <Text type="secondary" style={{ fontSize: 11 }}>
                {activity.time}
              </Text>
            </Space>
          ),
        }))}
      />
    </Card>
  )
}
```

##### 3.1.5 资源监控图表增强

**改用图表展示** (替换现有的 ResourceMonitorCard):
```tsx
import { ChartCard } from '@/components/modern/ChartCard'

<ChartCard
  title="系统资源"
  icon={<DesktopOutlined />}
  chartType="line"
  data={resourceHistory.map((item, index) => [
    { time: index, type: 'CPU', value: item.cpu },
    { time: index, type: '内存', value: item.memory },
    { time: index, type: 'GPU', value: item.gpu },
  ]).flat()}
  config={{
    xField: 'time',
    yField: 'value',
    seriesField: 'type',
    smooth: true,
    color: ['#667EEA', '#10B981', '#F59E0B'],
  }}
/>
```

##### 3.1.6 可拖拽布局

**使用 `react-grid-layout`**:
```tsx
import GridLayout from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'

const layout = [
  { i: 'timeline', x: 0, y: 0, w: 8, h: 4 },
  { i: 'todos', x: 8, y: 0, w: 4, h: 4 },
  { i: 'resources', x: 0, y: 4, w: 8, h: 3 },
  { i: 'calendar', x: 8, y: 4, w: 4, h: 3 },
]

<GridLayout
  className="dashboard-grid"
  layout={layout}
  cols={12}
  rowHeight={80}
  width={1200}
  isDraggable
  isResizable
  onLayoutChange={saveLayout}
>
  <div key="timeline">
    <ActivityTimeline activities={activities} />
  </div>
  <div key="todos">
    <TodoQuickPanel />
  </div>
  {/* 其他卡片... */}
</GridLayout>
```

**预计改造时间**: 3-4 天

---

### 3.2 TodoWidget - 现代任务管理

#### 当前问题
1. 列表展示单调
2. 优先级视觉化不够
3. 缺少看板视图
4. AI 功能隐藏较深

#### 改造方案

##### 3.2.1 多视图模式

**新增视图切换**:
```
┌─────────────────────────────────────────────┐
│ TODO  [列表视图 | 看板视图 | 日历视图]      │
│ ┌─────────────────────────────────────────┐ │
│ │ 列表视图 (默认)                         │ │
│ │ ┌─────────┬─────────┬─────────┐         │ │
│ │ │ 📁 分类1│ 📁 分类2│ 📁 分类3│         │ │
│ │ │         │         │         │         │ │
│ │ │ ▢ 任务  │ ▢ 任务  │ ▢ 任务  │         │ │
│ │ └─────────┴─────────┴─────────┘         │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ 看板视图 (Kanban)                       │ │
│ │ ┌──────┬──────┬──────┬──────┐          │ │
│ │ │ TODO │ 进行中│ 审核 │ 完成 │          │ │
│ │ │ [卡片]│ [卡片]│ [卡片]│ [卡片]│          │ │
│ │ └──────┴──────┴──────┴──────┘          │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

**实现代码**:
```tsx
import { Segmented } from 'antd'
import { UnorderedListOutlined, AppstoreOutlined, CalendarOutlined } from '@ant-design/icons'

const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'calendar'>('list')

<Segmented
  options={[
    { label: '列表', value: 'list', icon: <UnorderedListOutlined /> },
    { label: '看板', value: 'kanban', icon: <AppstoreOutlined /> },
    { label: '日历', value: 'calendar', icon: <CalendarOutlined /> },
  ]}
  value={viewMode}
  onChange={(value) => setViewMode(value as any)}
/>

{/* 根据 viewMode 渲染不同视图 */}
{viewMode === 'list' && <TodoListView items={todoItems} />}
{viewMode === 'kanban' && <TodoKanbanView items={todoItems} />}
{viewMode === 'calendar' && <TodoCalendarView items={todoItems} />}
```

##### 3.2.2 看板视图实现

**使用 `@dnd-kit/core`** (已安装):
```tsx
import { DndContext, closestCenter, DragOverlay } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'

const TodoKanbanView: React.FC<{ items: TodoItem[] }> = ({ items }) => {
  const columns = [
    { id: 'todo', title: 'TODO', color: '#6B7280' },
    { id: 'in-progress', title: '进行中', color: '#3B82F6' },
    { id: 'review', title: '审核', color: '#F59E0B' },
    { id: 'done', title: '完成', color: '#10B981' },
  ]

  return (
    <div style={{ display: 'flex', gap: 16, overflowX: 'auto' }}>
      {columns.map((column) => (
        <Card
          key={column.id}
          title={
            <Space>
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: column.color,
                }}
              />
              <Text strong>{column.title}</Text>
              <Text type="secondary">
                ({items.filter((item) => item.status === column.id).length})
              </Text>
            </Space>
          }
          style={{
            minWidth: 280,
            background: 'var(--glass-bg)',
            backdropFilter: 'var(--glass-backdrop)',
          }}
          styles={{
            body: { minHeight: 400 },
          }}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            {items
              .filter((item) => item.status === column.id)
              .map((item) => (
                <TodoKanbanCard key={item.id} item={item} />
              ))}
          </Space>
        </Card>
      ))}
    </div>
  )
}

const TodoKanbanCard: React.FC<{ item: TodoItem }> = ({ item }) => {
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ type: 'spring', stiffness: 300 }}
    >
      <Card
        size="small"
        hoverable
        style={{
          borderLeft: `4px solid ${getPriorityColor(item.priority)}`,
        }}
      >
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <Text strong ellipsis>
            {item.text}
          </Text>
          {item.tags && (
            <Space size={4} wrap>
              {item.tags.map((tag) => (
                <Tag key={tag} size="small">
                  {tag}
                </Tag>
              ))}
            </Space>
          )}
          {item.dueDate && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              ⏰ {dayjs(item.dueDate).format('MM-DD HH:mm')}
            </Text>
          )}
        </Space>
      </Card>
    </motion.div>
  )
}
```

##### 3.2.3 优先级视觉化增强

**彩色标记条**:
```tsx
const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'high':
      return '#EF4444'
    case 'medium':
      return '#F59E0B'
    case 'low':
      return '#3B82F6'
    default:
      return '#6B7280'
  }
}

<div
  style={{
    width: 4,
    height: '100%',
    background: getPriorityColor(item.priority),
    borderRadius: 2,
    marginRight: 12,
  }}
/>
```

**优先级筛选器**:
```tsx
<Space>
  <Button
    type={priorityFilter === 'all' ? 'primary' : 'default'}
    onClick={() => setPriorityFilter('all')}
  >
    全部
  </Button>
  <Button
    type={priorityFilter === 'high' ? 'primary' : 'default'}
    danger={priorityFilter === 'high'}
    onClick={() => setPriorityFilter('high')}
  >
    🔴 高优先级
  </Button>
  <Button
    type={priorityFilter === 'medium' ? 'primary' : 'default'}
    onClick={() => setPriorityFilter('medium')}
  >
    🟡 中优先级
  </Button>
  <Button
    type={priorityFilter === 'low' ? 'primary' : 'default'}
    onClick={() => setPriorityFilter('low')}
  >
    🔵 低优先级
  </Button>
</Space>
```

##### 3.2.4 AI 功能前置

**浮动 AI 助手按钮**:
```tsx
import { FloatButton } from 'antd'
import { RobotOutlined } from '@ant-design/icons'

<FloatButton
  icon={<RobotOutlined />}
  type="primary"
  tooltip="AI 助手"
  onClick={() => setClipboardModalVisible(true)}
  style={{
    right: 24,
    bottom: 80,
    width: 60,
    height: 60,
    background: 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)',
    boxShadow: '0 8px 24px rgba(102, 126, 234, 0.4)',
  }}
/>

<FloatButton.Group
  trigger="hover"
  type="primary"
  icon={<RobotOutlined />}
  style={{ right: 24, bottom: 80 }}
>
  <FloatButton
    icon={<ThunderboltOutlined />}
    tooltip="快速解析剪贴板"
    onClick={handleQuickAIParse}
  />
  <FloatButton
    icon={<FileTextOutlined />}
    tooltip="生成任务建议"
    onClick={handleGenerateSuggestions}
  />
  <FloatButton
    icon={<BulbOutlined />}
    tooltip="智能优先级排序"
    onClick={handleAISort}
  />
</FloatButton.Group>
```

##### 3.2.5 任务详情面板美化

**侧边抽屉式详情**:
```tsx
<Drawer
  title={
    <Space>
      <div
        style={{
          width: 6,
          height: 24,
          background: getPriorityColor(selectedTodo.priority),
          borderRadius: 3,
        }}
      />
      <Text strong ellipsis style={{ maxWidth: 300 }}>
        {selectedTodo.text}
      </Text>
    </Space>
  }
  placement="right"
  width={600}
  open={!!selectedTodo}
  onClose={() => setSelectedTodo(null)}
  styles={{
    body: {
      background: 'var(--color-bg-secondary)',
    },
  }}
>
  {/* 详情内容 */}
  <Space direction="vertical" size={24} style={{ width: '100%' }}>
    {/* 状态卡片 */}
    <Card size="small" title="状态">
      <Row gutter={16}>
        <Col span={12}>
          <Statistic title="优先级" value={selectedTodo.priority} />
        </Col>
        <Col span={12}>
          <Statistic
            title="截止时间"
            value={selectedTodo.dueDate}
            formatter={(value) => dayjs(value).fromNow()}
          />
        </Col>
      </Row>
    </Card>

    {/* 描述 */}
    {selectedTodo.notes && (
      <Card size="small" title="详细说明">
        <Paragraph>{selectedTodo.notes}</Paragraph>
      </Card>
    )}

    {/* 附件 */}
    {selectedTodo.attachments && selectedTodo.attachments.length > 0 && (
      <Card size="small" title="附件">
        <List
          dataSource={selectedTodo.attachments}
          renderItem={(attachment) => (
            <List.Item>
              <List.Item.Meta
                avatar={<FileOutlined />}
                title={attachment.name}
                description={attachment.type}
              />
            </List.Item>
          )}
        />
      </Card>
    )}
  </Space>
</Drawer>
```

**预计改造时间**: 4-5 天

---

### 3.3 CalendarWidget - 智能日历

#### 当前问题
1. FullCalendar 样式默认，不够现代
2. 缺少快速添加事件功能
3. 缺少事件分类色彩编码
4. 缺少日程提醒

#### 改造方案

##### 3.3.1 自定义 FullCalendar 样式

**CSS 覆盖** (`src/styles/calendar-modern.css`):
```css
/* 现代化日历样式 */
.fc {
  /* 更圆润的边角 */
  --fc-border-radius: 8px;

  /* 更柔和的边框 */
  --fc-border-color: var(--glass-border);

  /* 今日高亮 */
  --fc-today-bg-color: rgba(102, 126, 234, 0.1);
}

/* 事件卡片玻璃态 */
.fc-event {
  background: var(--glass-bg) !important;
  backdrop-filter: var(--glass-backdrop);
  border: none !important;
  border-left: 4px solid var(--event-color) !important;
  border-radius: 8px !important;
  padding: 6px 10px !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
  transition: all 0.2s ease !important;
}

.fc-event:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
}

/* 日期单元格 hover */
.fc-daygrid-day:hover {
  background-color: rgba(102, 126, 234, 0.05);
  cursor: pointer;
}

/* 星期标题 */
.fc-col-header-cell {
  background: linear-gradient(
    135deg,
    rgba(102, 126, 234, 0.1) 0%,
    rgba(118, 75, 162, 0.1) 100%
  ) !important;
  padding: 12px 0 !important;
}

/* 当前时间线 (周/日视图) */
.fc-timegrid-now-indicator-line {
  border-color: #EF4444 !important;
  border-width: 2px !important;
}
```

##### 3.3.2 快速添加事件

**日期单元格点击创建**:
```tsx
const handleDateClick = (info: DateClickArg) => {
  Modal.confirm({
    title: '快速创建事件',
    content: (
      <Form>
        <Form.Item label="标题">
          <Input placeholder="输入事件标题" />
        </Form.Item>
        <Form.Item label="时间">
          <TimePicker.RangePicker format="HH:mm" />
        </Form.Item>
        <Form.Item label="分类">
          <Select
            options={[
              { label: '📋 工作', value: 'work' },
              { label: '👥 会议', value: 'meeting' },
              { label: '💡 学习', value: 'study' },
              { label: '🏃 运动', value: 'sport' },
              { label: '🎯 其他', value: 'other' },
            ]}
          />
        </Form.Item>
      </Form>
    ),
    okText: '创建',
    onOk: async (values) => {
      await createEvent({
        date: info.dateStr,
        ...values,
      })
    },
  })
}

<FullCalendar
  dateClick={handleDateClick}
  // ...其他配置
/>
```

##### 3.3.3 事件分类色彩系统

**预定义分类**:
```ts
const EVENT_CATEGORIES = {
  work: {
    label: '工作',
    color: '#3B82F6',
    gradient: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
    icon: '📋',
  },
  meeting: {
    label: '会议',
    color: '#10B981',
    gradient: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    icon: '👥',
  },
  study: {
    label: '学习',
    color: '#8B5CF6',
    gradient: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
    icon: '💡',
  },
  sport: {
    label: '运动',
    color: '#F59E0B',
    gradient: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
    icon: '🏃',
  },
  personal: {
    label: '个人',
    color: '#EC4899',
    gradient: 'linear-gradient(135deg, #EC4899 0%, #DB2777 100%)',
    icon: '💖',
  },
  other: {
    label: '其他',
    color: '#6B7280',
    gradient: 'linear-gradient(135deg, #6B7280 0%, #4B5563 100%)',
    icon: '🎯',
  },
}

// 应用到事件
const events = calendarEvents.map((event) => ({
  ...event,
  backgroundColor: EVENT_CATEGORIES[event.category]?.color || '#6B7280',
  borderColor: EVENT_CATEGORIES[event.category]?.color || '#6B7280',
}))
```

**分类筛选器**:
```tsx
<Space wrap style={{ marginBottom: 16 }}>
  {Object.entries(EVENT_CATEGORIES).map(([key, category]) => (
    <CheckableTag
      key={key}
      checked={selectedCategories.includes(key)}
      onChange={(checked) => {
        if (checked) {
          setSelectedCategories([...selectedCategories, key])
        } else {
          setSelectedCategories(selectedCategories.filter((c) => c !== key))
        }
      }}
      style={{
        background: selectedCategories.includes(key)
          ? category.gradient
          : 'transparent',
        color: selectedCategories.includes(key) ? '#fff' : category.color,
        border: `1px solid ${category.color}`,
        padding: '4px 12px',
        borderRadius: 16,
      }}
    >
      {category.icon} {category.label}
    </CheckableTag>
  ))}
</Space>
```

##### 3.3.4 日程提醒系统

**新增组件** (`src/components/calendar/EventReminder.tsx`):
```tsx
import { useEffect } from 'react'
import { notification } from 'antd'
import dayjs from 'dayjs'

export const useEventReminder = (events: CalendarEvent[]) => {
  useEffect(() => {
    const checkReminders = () => {
      const now = dayjs()

      events.forEach((event) => {
        // 提前 15 分钟提醒
        const eventTime = dayjs(`${event.date} ${event.time}`)
        const diff = eventTime.diff(now, 'minute')

        if (diff === 15 && !event.reminded) {
          notification.warning({
            message: '日程提醒',
            description: `${event.title} 将在 15 分钟后开始`,
            icon: <ClockCircleOutlined style={{ color: '#F59E0B' }} />,
            duration: 0, // 不自动关闭
            btn: (
              <Space>
                <Button
                  type="link"
                  size="small"
                  onClick={() => {
                    notification.close(event.id)
                    // 跳转到日历
                    setActiveWidget('calendar')
                  }}
                >
                  查看
                </Button>
                <Button
                  type="link"
                  size="small"
                  onClick={() => {
                    notification.close(event.id)
                    // 推迟 10 分钟
                    scheduleReminder(event.id, 10)
                  }}
                >
                  推迟
                </Button>
              </Space>
            ),
          })

          // 标记已提醒
          markEventReminded(event.id)
        }
      })
    }

    // 每分钟检查一次
    const interval = setInterval(checkReminders, 60000)

    return () => clearInterval(interval)
  }, [events])
}
```

**预计改造时间**: 2-3 天

---

### 3.4 TerminalWidget - 智能终端

#### 当前问题
1. 标签页样式传统
2. 缺少终端主题切换
3. 缺少命令历史智能提示
4. SSH 配置界面不够直观

#### 改造方案

##### 3.4.1 标签页美化

**使用现代标签样式**:
```tsx
<Tabs
  type="editable-card"
  activeKey={activeTab}
  onChange={setActiveTab}
  onEdit={handleTabEdit}
  className="modern-terminal-tabs"
  items={terminals.map((terminal) => ({
    key: terminal.id,
    label: (
      <Space size={4}>
        {getTabIcon(terminal.mode)}
        <Text style={{ fontSize: 13 }}>{terminal.name}</Text>
        {terminal.isRunning && (
          <Badge status="processing" />
        )}
      </Space>
    ),
    children: (
      <div className="terminal-container">
        <XTerminal terminalId={terminal.id} />
      </div>
    ),
  }))}
  tabBarExtraContent={
    <Space>
      <Dropdown
        menu={{
          items: [
            {
              key: 'interactive',
              label: '交互式终端',
              icon: <DesktopOutlined />,
            },
            {
              key: 'task',
              label: '任务终端',
              icon: <CodeOutlined />,
            },
            {
              key: 'ssh',
              label: 'SSH 终端',
              icon: <CloudServerOutlined />,
            },
          ],
          onClick: ({ key }) => createTerminal(key as TerminalMode),
        }}
      >
        <Button type="primary" icon={<PlusOutlined />}>
          新建终端
        </Button>
      </Dropdown>
    </Space>
  }
/>
```

**CSS 样式**:
```css
/* 现代终端标签 */
.modern-terminal-tabs .ant-tabs-tab {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-backdrop);
  border: 1px solid var(--glass-border);
  border-radius: 8px 8px 0 0;
  margin-right: 4px;
  transition: all 0.2s ease;
}

.modern-terminal-tabs .ant-tabs-tab-active {
  background: var(--color-bg-secondary);
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
}

.modern-terminal-tabs .ant-tabs-tab:hover {
  background: var(--color-bg-tertiary);
}
```

##### 3.4.2 终端主题系统

**预定义主题**:
```ts
const TERMINAL_THEMES = {
  dracula: {
    name: 'Dracula',
    background: '#282a36',
    foreground: '#f8f8f2',
    cursor: '#f8f8f2',
    black: '#000000',
    red: '#ff5555',
    green: '#50fa7b',
    yellow: '#f1fa8c',
    blue: '#bd93f9',
    magenta: '#ff79c6',
    cyan: '#8be9fd',
    white: '#bfbfbf',
  },
  monokai: {
    name: 'Monokai',
    background: '#272822',
    foreground: '#f8f8f2',
    cursor: '#f8f8f0',
    black: '#272822',
    red: '#f92672',
    green: '#a6e22e',
    yellow: '#f4bf75',
    blue: '#66d9ef',
    magenta: '#ae81ff',
    cyan: '#a1efe4',
    white: '#f8f8f2',
  },
  solarizedDark: {
    name: 'Solarized Dark',
    background: '#002b36',
    foreground: '#839496',
    cursor: '#839496',
    black: '#073642',
    red: '#dc322f',
    green: '#859900',
    yellow: '#b58900',
    blue: '#268bd2',
    magenta: '#d33682',
    cyan: '#2aa198',
    white: '#eee8d5',
  },
}

// 应用主题
const applyTheme = (terminal: Terminal, theme: TerminalTheme) => {
  terminal.options.theme = {
    background: theme.background,
    foreground: theme.foreground,
    cursor: theme.cursor,
    // ...其他颜色
  }
}
```

**主题选择器**:
```tsx
<Dropdown
  menu={{
    items: Object.entries(TERMINAL_THEMES).map(([key, theme]) => ({
      key,
      label: (
        <Space>
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: 4,
              background: theme.background,
              border: '1px solid var(--glass-border)',
            }}
          />
          <Text>{theme.name}</Text>
        </Space>
      ),
    })),
    onClick: ({ key }) => setTheme(key),
  }}
>
  <Button icon={<BgColorsOutlined />} />
</Dropdown>
```

##### 3.4.3 命令历史智能提示

**命令历史管理**:
```tsx
const [commandHistory, setCommandHistory] = useState<string[]>([])

const handleCommandInput = (command: string) => {
  // 添加到历史
  if (command.trim()) {
    setCommandHistory((prev) => {
      const newHistory = [...prev, command]
      // 保留最近 100 条
      return newHistory.slice(-100)
    })
  }
}

// AutoComplete 智能提示
<AutoComplete
  options={commandHistory
    .filter((cmd) => cmd.includes(inputValue))
    .map((cmd) => ({ value: cmd }))
  }
  placeholder="输入命令..."
  onSelect={handleCommandInput}
/>
```

##### 3.4.4 SSH 配置可视化

**配置卡片式界面**:
```tsx
<Space direction="vertical" style={{ width: '100%' }}>
  {sshConfigs.map((config) => (
    <Card
      key={config.id}
      className="ssh-config-card"
      hoverable
      onClick={() => connectSSH(config)}
      actions={[
        <EditOutlined key="edit" onClick={(e) => {
          e.stopPropagation()
          editConfig(config)
        }} />,
        <DeleteOutlined key="delete" onClick={(e) => {
          e.stopPropagation()
          deleteConfig(config.id)
        }} />,
      ]}
    >
      <Card.Meta
        avatar={
          <Avatar
            style={{
              background: 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)',
            }}
            icon={<CloudServerOutlined />}
          />
        }
        title={config.name}
        description={
          <Space direction="vertical" size={2}>
            <Text type="secondary">
              <UserOutlined /> {config.user}@{config.host}:{config.port}
            </Text>
            {config.lastConnected && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                上次连接: {dayjs(config.lastConnected).fromNow()}
              </Text>
            )}
          </Space>
        }
      />
    </Card>
  ))}
</Space>
```

**预计改造时间**: 2-3 天

---

### 3.5 PomodoroWidget - 现代番茄钟

#### 当前问题
1. 计时器视觉效果简单
2. 缺少统计图表
3. 缺少声音和通知自定义

#### 改造方案

##### 3.5.1 圆环进度计时器

**使用 `antd Progress.Circle` + 动画**:
```tsx
import { Progress, Typography, Space, Button } from 'antd'
import { PlayCircleOutlined, PauseCircleOutlined, ReloadOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

<Space direction="vertical" align="center" style={{ width: '100%' }}>
  <motion.div
    animate={{
      scale: isRunning ? [1, 1.02, 1] : 1,
    }}
    transition={{
      duration: 1,
      repeat: isRunning ? Infinity : 0,
    }}
  >
    <Progress
      type="circle"
      percent={(timeLeft / totalTime) * 100}
      format={() => (
        <Space direction="vertical" align="center" size={0}>
          <Title level={1} style={{ margin: 0, fontSize: 48 }}>
            {formatTime(timeLeft)}
          </Title>
          <Text type="secondary">
            {isWorkSession ? '工作中' : '休息中'}
          </Text>
        </Space>
      )}
      strokeColor={{
        '0%': isWorkSession ? '#667EEA' : '#10B981',
        '100%': isWorkSession ? '#764BA2' : '#059669',
      }}
      trailColor="var(--color-border)"
      strokeWidth={8}
      width={280}
    />
  </motion.div>

  <Space size={16}>
    <Button
      type="primary"
      shape="circle"
      size="large"
      icon={isRunning ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
      onClick={toggleTimer}
      style={{
        width: 64,
        height: 64,
        background: 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)',
      }}
    />
    <Button
      shape="circle"
      size="large"
      icon={<ReloadOutlined />}
      onClick={resetTimer}
      style={{
        width: 64,
        height: 64,
      }}
    />
  </Space>

  <Space size={24} style={{ marginTop: 24 }}>
    <Statistic title="今日完成" value={todayCount} suffix="个" />
    <Divider type="vertical" style={{ height: 40 }} />
    <Statistic title="本周完成" value={weekCount} suffix="个" />
  </Space>
</Space>
```

##### 3.5.2 统计图表

**番茄钟历史图表**:
```tsx
import { ChartCard } from '@/components/modern/ChartCard'

<ChartCard
  title="本周番茄钟统计"
  icon={<ClockCircleOutlined />}
  chartType="bar"
  data={pomodoroStats.map((stat) => ({
    day: stat.date,
    count: stat.count,
    workTime: stat.workTime,
  }))}
  config={{
    xField: 'day',
    yField: 'count',
    label: {
      position: 'top',
      style: {
        fill: '#fff',
      },
    },
    color: ({ day }: any) =>
      day === dayjs().format('MM-DD')
        ? '#667EEA'
        : '#6B7280',
  }}
/>
```

##### 3.5.3 声音与通知自定义

**设置面板**:
```tsx
<Card title="通知设置">
  <Space direction="vertical" style={{ width: '100%' }}>
    <Form.Item label="提示音">
      <Select
        options={[
          { label: '🔔 默认', value: 'default' },
          { label: '🎵 柔和', value: 'soft' },
          { label: '📢 响亮', value: 'loud' },
          { label: '🔕 静音', value: 'none' },
        ]}
      />
    </Form.Item>

    <Form.Item label="桌面通知">
      <Switch defaultChecked />
    </Form.Item>

    <Form.Item label="全屏闪烁提示">
      <Switch />
    </Form.Item>

    <Form.Item label="自动开始休息">
      <Switch defaultChecked />
    </Form.Item>
  </Space>
</Card>
```

**预计改造时间**: 2-3 天

---

### 3.6 其他 Widgets 快速改造建议

#### ProjectsWidget
- **卡片网格布局**: 替换列表为卡片网格
- **项目状态徽章**: Active / Building / Error
- **快速操作悬浮菜单**: 悬停显示 Build / Open / Settings
- **构建进度可视化**: 使用进度条展示构建状态

#### GitHubWidget
- **仓库卡片**: 显示 Star / Fork / Language
- **贡献热力图**: GitHub 风格的贡献日历
- **快速克隆**: 一键克隆到本地

#### EnvironmentWidget
- **分组折叠面板**: System / User / Process 分组
- **搜索高亮**: 搜索时高亮匹配文字
- **快速编辑**: 双击变量名即可编辑

#### FileTransferWidget
- **拖拽上传区域**: 大而明显的拖拽区域
- **上传进度环形图**: 使用 Progress.Circle
- **文件预览**: 图片文件支持缩略图

#### WebArchiveWidget
- **瀑布流布局**: 类似 Pinterest
- **内容预览卡片**: 显示网页截图
- **标签管理**: 为网页添加标签分类

**预计改造时间**: 每个 1-2 天

---

## 4. 新增交互特性

### 4.1 全局快捷键

**快捷键系统** (`src/hooks/useGlobalHotkeys.ts`):
```tsx
import { useEffect } from 'react'

export const useGlobalHotkeys = () => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K: 快速搜索
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        openCommandPalette()
      }

      // Ctrl/Cmd + N: 快速新建 TODO
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        openQuickTodo()
      }

      // Ctrl/Cmd + Shift + C: 快速复制剪贴板到 TODO
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'c') {
        e.preventDefault()
        parseClipboardToTodo()
      }

      // Ctrl/Cmd + P: 启动番茄钟
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault()
        startPomodoro()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
```

### 4.2 命令面板 (Command Palette)

**类似 VS Code 的命令面板**:
```tsx
import { Modal, Input, List, Space, Typography } from 'antd'

const { Search } = Input
const { Text } = Typography

const COMMANDS = [
  {
    id: 'new-todo',
    label: '新建 TODO',
    icon: <CheckSquareOutlined />,
    keywords: ['todo', 'task', '任务'],
    action: () => openTodoForm(),
  },
  {
    id: 'new-event',
    label: '新建日程',
    icon: <CalendarOutlined />,
    keywords: ['calendar', 'event', '日程'],
    action: () => openCalendarForm(),
  },
  {
    id: 'start-pomodoro',
    label: '启动番茄钟',
    icon: <ClockCircleOutlined />,
    keywords: ['pomodoro', '番茄钟'],
    action: () => startPomodoro(),
  },
  // ...更多命令
]

<Modal
  open={commandPaletteVisible}
  onCancel={() => setCommandPaletteVisible(false)}
  footer={null}
  width={600}
  style={{ top: 100 }}
>
  <Space direction="vertical" style={{ width: '100%' }}>
    <Search
      placeholder="输入命令或搜索..."
      autoFocus
      size="large"
      onChange={(e) => setSearchQuery(e.target.value)}
    />
    <List
      dataSource={filteredCommands}
      renderItem={(command) => (
        <List.Item
          style={{ cursor: 'pointer' }}
          onClick={() => {
            command.action()
            setCommandPaletteVisible(false)
          }}
        >
          <List.Item.Meta
            avatar={command.icon}
            title={<Text strong>{command.label}</Text>}
            description={command.keywords.join(', ')}
          />
        </List.Item>
      )}
    />
  </Space>
</Modal>
```

### 4.3 Widget 间通信

**事件总线** (`src/core/EventBus.ts`):
```ts
import { EventEmitter } from 'events'

class EventBus extends EventEmitter {
  // Widget 间通信
  emitWidgetEvent(event: string, data: any) {
    this.emit(`widget:${event}`, data)
  }

  onWidgetEvent(event: string, handler: (data: any) => void) {
    this.on(`widget:${event}`, handler)
  }

  // 示例：TODO 创建时通知 Dashboard
  onTodoCreated(handler: (todo: TodoItem) => void) {
    this.onWidgetEvent('todo:created', handler)
  }

  emitTodoCreated(todo: TodoItem) {
    this.emitWidgetEvent('todo:created', todo)
  }
}

export const eventBus = new EventBus()
```

**使用示例**:
```tsx
// TodoWidget.tsx
const handleCreateTodo = async (todo: TodoItem) => {
  await createTodo(todo)

  // 通知其他 Widget
  eventBus.emitTodoCreated(todo)
}

// DashboardWidget.tsx
useEffect(() => {
  const handler = (todo: TodoItem) => {
    message.success(`新增任务: ${todo.text}`)
    refreshTodoCount()
  }

  eventBus.onTodoCreated(handler)

  return () => {
    eventBus.off('widget:todo:created', handler)
  }
}, [])
```

### 4.4 拖拽跨 Widget 操作

**示例：拖拽 TODO 到 Calendar**:
```tsx
import { DndContext, DragOverlay } from '@dnd-kit/core'

<DndContext onDragEnd={handleDragEnd}>
  {/* TodoWidget */}
  <Draggable id={todo.id} data={todo}>
    <TodoCard item={todo} />
  </Draggable>

  {/* CalendarWidget */}
  <Droppable id="calendar">
    <Calendar />
  </Droppable>
</DndContext>

const handleDragEnd = (event: DragEndEvent) => {
  if (event.over?.id === 'calendar') {
    const todo = event.active.data.current

    // 将 TODO 转换为日程
    convertTodoToEvent(todo)
    message.success('已将任务添加到日历')
  }
}
```

---

## 5. 技术实现方案

### 5.1 新增依赖包

```bash
# 图表库
npm install @ant-design/charts

# 拖拽布局
npm install react-grid-layout
npm install @types/react-grid-layout --save-dev

# 动画增强
npm install framer-motion  # (已安装)

# 事件总线
# (使用 Node.js 内置 events，无需安装)

# 日期处理增强
npm install dayjs  # (已安装)

# 通知音效
npm install howler
npm install @types/howler --save-dev
```

### 5.2 文件结构调整

**新增目录**:
```
src/
├── components/
│   ├── modern/              # 现代化通用组件
│   │   ├── StatCard.tsx
│   │   ├── ChartCard.tsx
│   │   ├── QuickActionButton.tsx
│   │   └── GradientCard.tsx
│   ├── dashboard/           # Dashboard 专用组件
│   │   ├── ActivityTimeline.tsx
│   │   ├── WeatherCard.tsx
│   │   └── QuickStatsGrid.tsx
│   ├── todo/                # TODO 专用组件
│   │   ├── TodoKanbanView.tsx
│   │   ├── TodoCalendarView.tsx
│   │   └── TodoQuickPanel.tsx
│   └── calendar/            # Calendar 专用组件
│       ├── EventReminder.tsx
│       └── QuickEventForm.tsx
│
├── hooks/
│   ├── useGlobalHotkeys.ts  # 全局快捷键
│   ├── useCommandPalette.ts # 命令面板
│   └── useEventBus.ts       # 事件总线 Hook
│
├── core/
│   └── EventBus.ts          # 事件总线实现
│
├── styles/
│   ├── animations.css       # 动画库
│   ├── calendar-modern.css  # 日历样式
│   └── glassmorphism.css    # 玻璃态样式
│
└── utils/
    ├── hotkeys.ts           # 快捷键工具
    └── sound.ts             # 音效管理
```

### 5.3 性能优化

#### 5.3.1 虚拟化长列表

**使用 `react-window`**:
```bash
npm install react-window
npm install @types/react-window --save-dev
```

```tsx
import { FixedSizeList as List } from 'react-window'

<List
  height={600}
  itemCount={todoItems.length}
  itemSize={80}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <TodoCard item={todoItems[index]} />
    </div>
  )}
</List>
```

#### 5.3.2 懒加载图表

```tsx
import React, { Suspense, lazy } from 'react'

const ChartCard = lazy(() => import('@/components/modern/ChartCard'))

<Suspense fallback={<Spin />}>
  <ChartCard {...props} />
</Suspense>
```

#### 5.3.3 防抖搜索

```tsx
import { useDebouncedValue } from 'ahooks'

const [searchQuery, setSearchQuery] = useState('')
const debouncedQuery = useDebouncedValue(searchQuery, 300)

useEffect(() => {
  performSearch(debouncedQuery)
}, [debouncedQuery])
```

---

## 6. 实施优先级

### 阶段一：基础升级 (Week 1-2)

**优先级 P0 (必须完成)**:
- [ ] 全局设计系统升级 (玻璃态增强、动画库)
- [ ] 通用组件开发 (StatCard, ChartCard, QuickActionButton)
- [ ] DashboardWidget 整体改造
- [ ] TodoWidget 多视图模式 (列表 + 看板)

**工作量**: 8-10 个工作日
**负责人**: 前端开发
**验收标准**:
- Dashboard 视觉效果达到设计稿 90% 相似度
- TODO 看板视图可拖拽，数据同步正常
- 新组件通过单元测试

---

### 阶段二：交互增强 (Week 3-4)

**优先级 P1 (高优先级)**:
- [ ] CalendarWidget 样式美化 + 快速添加
- [ ] PomodoroWidget 圆环计时器 + 统计图表
- [ ] TerminalWidget 标签美化 + 主题系统
- [ ] 全局快捷键系统
- [ ] 命令面板 (Command Palette)

**工作量**: 8-10 个工作日
**验收标准**:
- 日历支持快速添加事件
- 番茄钟计时器视觉效果出色
- 快捷键系统工作正常

---

### 阶段三：其他 Widgets (Week 5-6)

**优先级 P2 (中优先级)**:
- [ ] ProjectsWidget 卡片网格布局
- [ ] GitHubWidget 仓库卡片 + 贡献热力图
- [ ] EnvironmentWidget 分组折叠
- [ ] FileTransferWidget 拖拽上传
- [ ] WebArchiveWidget 瀑布流布局
- [ ] Widget 间通信 (EventBus)

**工作量**: 8-10 个工作日
**验收标准**:
- 所有 Widget 视觉风格统一
- Widget 间通信正常

---

### 阶段四：完善与优化 (Week 7)

**优先级 P3 (低优先级)**:
- [ ] 性能优化 (虚拟化列表、懒加载)
- [ ] 单元测试补充
- [ ] 用户反馈修复
- [ ] 文档完善

**工作量**: 4-5 个工作日
**验收标准**:
- 所有主要功能通过测试
- 文档完整

---

## 7. 验收标准

### 7.1 视觉标准

- [ ] **玻璃态效果**: 所有卡片具有明显的玻璃态效果，透明度和模糊度适中
- [ ] **动画流畅**: 所有动画帧率 ≥ 60fps，无卡顿
- [ ] **响应式布局**: 在 1920x1080 和 1366x768 分辨率下正常显示
- [ ] **主题适配**: 亮/暗主题下所有组件可读性良好
- [ ] **色彩一致**: 使用统一的色彩系统，无突兀颜色

### 7.2 交互标准

- [ ] **操作反馈**: 所有操作（点击、悬停、拖拽）都有视觉反馈
- [ ] **错误提示**: 错误信息清晰，提供解决建议
- [ ] **加载状态**: 所有异步操作都有加载提示
- [ ] **快捷键**: 快捷键系统工作正常，无冲突
- [ ] **拖拽**: 拖拽操作流畅，有明确的 Drop 区域提示

### 7.3 性能标准

- [ ] **首次加载**: Dashboard 首次加载时间 < 2 秒
- [ ] **Widget 切换**: 切换 Widget 响应时间 < 300ms
- [ ] **列表渲染**: 1000+ 条 TODO 时滚动流畅
- [ ] **内存占用**: 长时间运行内存占用 < 500MB
- [ ] **CPU 占用**: 空闲时 CPU 占用 < 5%

### 7.4 功能标准

- [ ] **数据同步**: Obsidian 同步功能正常，无数据丢失
- [ ] **跨 Widget 通信**: Widget 间通信正常，无消息丢失
- [ ] **快捷键**: 所有快捷键功能正常
- [ ] **命令面板**: 命令面板搜索准确
- [ ] **通知系统**: 日程提醒和番茄钟通知正常

---

## 8. 风险评估

### 8.1 技术风险

| 风险 | 影响 | 概率 | 应对措施 |
|------|------|------|----------|
| 新依赖包兼容性问题 | 中 | 低 | 提前测试，准备回退方案 |
| 性能下降（图表渲染） | 高 | 中 | 使用虚拟化、懒加载 |
| Obsidian 同步冲突 | 高 | 低 | 增强冲突检测和提示 |
| 动画导致 CPU 占用高 | 中 | 中 | 提供"性能模式"禁用动画 |

### 8.2 时间风险

| 风险 | 影响 | 概率 | 应对措施 |
|------|------|------|----------|
| 设计迭代次数多 | 中 | 高 | 提前确定设计规范，减少返工 |
| 测试发现大量问题 | 高 | 中 | 每个阶段进行充分测试 |
| 依赖的库更新导致问题 | 低 | 低 | 锁定依赖版本 |

---

## 9. 总结

### 9.1 改造亮点

1. **视觉焕然一新**: 玻璃态 + 渐变 + 动画，科技感十足
2. **交互极致流畅**: 每个操作都有反馈，拖拽丝滑
3. **功能更智能**: AI 前置、快捷键、命令面板
4. **性能不降反升**: 虚拟化长列表、懒加载图表
5. **设计系统完善**: 统一的色彩、排版、间距系统

### 9.2 预期效果

- **用户体验**: 从"功能可用"升级为"赏心悦目"
- **生产力**: 快捷键和命令面板大幅提升效率
- **专业感**: 达到商业软件级别的视觉质量
- **可扩展性**: 新 Widget 可快速套用设计系统

### 9.3 后续规划

- **用户反馈收集**: 发布内测版，收集反馈
- **A/B 测试**: 对比新旧设计的用户留存率
- **持续优化**: 根据用户反馈迭代
- **移动端适配**: 考虑响应式设计支持平板

---

## 附录

### A. 参考设计资源

- **Dribbble**: 搜索 "dashboard ui", "todo app", "glassmorphism"
- **Figma Community**: 免费设计系统模板
- **Ant Design Pro**: 官方企业级 UI 方案

### B. 代码仓库

- 主分支: `main`
- 开发分支: `feature/ui-modernization`
- 测试分支: `test/ui-modernization`

### C. 协作工具

- **设计稿**: Figma
- **任务管理**: GitHub Issues
- **代码审查**: GitHub Pull Request
- **文档**: 本 Markdown 文档

---

**文档结束**

> 💡 如有任何疑问或建议，请联系项目负责人。
