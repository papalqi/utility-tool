import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Checkbox,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  GatewayOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  StarFilled,
  StarOutlined,
  SearchOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons'
import { WidgetLayout, WidgetSection } from '@/components/widgets'
import { useWidget } from '@/hooks/useWidget'
import { useWidgetActions } from '@/hooks/useWidgetActions'
import { useWidgetStorage } from '@/hooks/useWidgetStorage'
import type {
  EnvironmentSnapshot,
  EnvironmentVariable,
  EnvironmentMutationPayload,
  EnvVarScope,
} from '@/shared/system'
import { WidgetMetadata } from '@/shared/widget-types'

const scopeLabels: Record<EnvVarScope, string> = {
  system: '系统',
  user: '用户',
  process: '进程',
}

const scopeColors: Record<EnvVarScope, string> = {
  system: 'volcano',
  user: 'geekblue',
  process: 'default',
}

type EditorScope = Exclude<EnvVarScope, 'process'>
type PathTabKey = EditorScope | 'process'

interface EnvEditorFormValues extends EnvironmentMutationPayload {
  scope: EditorScope
}

const metadata: WidgetMetadata = {
  id: 'environment-manager',
  displayName: '环境变量',
  icon: <GatewayOutlined />,
  description: '集中查看、搜索并管理本机环境变量，支持收藏、快速筛选与写入系统变量',
  category: 'tools',
  order: 32,
  enabled: true,
  requiresObsidian: false,
}

const favoriteKey = (variable: EnvironmentVariable) => `${variable.scope}:${variable.key}`

export const EnvironmentWidget: React.FC = () => {
  const { state, setStatus, setError, setLoading, widgetLogger } = useWidget({
    metadata,
  })

  const [snapshot, setSnapshot] = useState<EnvironmentSnapshot | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeScopes, setActiveScopes] = useState<EnvVarScope[]>([])
  const [isEditorOpen, setEditorOpen] = useState(false)
  const [isEditorSubmitting, setEditorSubmitting] = useState(false)
  const [editingVariable, setEditingVariable] = useState<EnvironmentVariable | null>(null)
  const [editorForm] = Form.useForm<EnvEditorFormValues>()
  const [activePathTab, setActivePathTab] = useState<PathTabKey>('user')
  const [pathDrafts, setPathDrafts] = useState<Record<EditorScope, string[]>>({
    user: [],
    system: [],
  })
  const [pathSaving, setPathSaving] = useState(false)

  const { value: favoriteIds, setValue: setFavoriteIds } = useWidgetStorage<string[]>({
    key: 'environment-widget:favorites',
    defaultValue: [],
    persist: true,
  })

  const loadEnvironmentSnapshot = useCallback(async () => {
    if (!window.electronAPI?.getEnvironmentVariables) {
      const fallback = '当前运行环境缺少 electronAPI.getEnvironmentVariables 接口'
      setError(fallback)
      return
    }

    try {
      setLoading(true)
      setError(null)
      setStatus('正在同步环境变量...')
      widgetLogger.info('Refreshing environment variables')

      const data = await window.electronAPI.getEnvironmentVariables()
      setSnapshot(data)
      setStatus(`已加载 ${data.variables.length} 个环境变量`)
      widgetLogger.info(`Loaded ${data.variables.length} environment variables`)
    } catch (error) {
      const messageText =
        error instanceof Error ? error.message : '无法读取系统环境变量，请查看日志'
      setError(messageText)
      message.error(messageText)
    } finally {
      setLoading(false)
    }
  }, [setError, setLoading, setStatus, widgetLogger])

  const { refresh, isActionInProgress } = useWidgetActions({
    widgetId: metadata.id,
    onRefresh: async () => {
      await loadEnvironmentSnapshot()
      message.success('环境变量已刷新')
    },
  })

  useEffect(() => {
    loadEnvironmentSnapshot()
  }, [loadEnvironmentSnapshot])

  useEffect(() => {
    if (!snapshot) {
      setPathDrafts({ user: [], system: [] })
      setActivePathTab('user')
      return
    }

    setPathDrafts({
      user: [...(snapshot.pathEntries.user || [])],
      system: [...(snapshot.pathEntries.system || [])],
    })

    setActivePathTab((prev) => {
      if (prev === 'process') {
        return prev
      }
      if (
        prev === 'user' &&
        (snapshot.pathEntries.user?.length || snapshot.capabilities.canEditUser)
      ) {
        return 'user'
      }
      if (snapshot.scopes.includes('system') || snapshot.capabilities.canEditSystem) {
        return 'system'
      }
      return snapshot.pathEntries.user?.length ? 'user' : 'process'
    })
  }, [snapshot])

  useEffect(() => {
    if (!snapshot) {
      return
    }

    setActiveScopes((prev) => {
      if (!prev.length) {
        return snapshot.scopes
      }
      const validScopes = prev.filter((scope) => snapshot.scopes.includes(scope))
      return validScopes.length ? validScopes : snapshot.scopes
    })
  }, [snapshot])

  const toggleFavorite = useCallback(
    (variable: EnvironmentVariable) => {
      const id = favoriteKey(variable)
      setFavoriteIds((prev) => {
        const next = prev.includes(id) ? prev.filter((item) => item !== id) : [id, ...prev]
        return next.slice(0, 24)
      })
    },
    [setFavoriteIds]
  )

  const handleOpenEditor = useCallback(
    (variable?: EnvironmentVariable) => {
      if (!snapshot?.capabilities.supportsEditing) {
        message.warning('当前平台暂不支持修改环境变量')
        return
      }

      const scope: EditorScope = variable?.scope === 'system' ? 'system' : 'user'

      editorForm.setFieldsValue({
        key: variable?.key ?? '',
        value: variable?.value ?? '',
        scope,
      })
      setEditingVariable(variable ?? null)
      setEditorOpen(true)
    },
    [editorForm, snapshot]
  )

  const handleEditorFinish = useCallback(
    async (values: EnvEditorFormValues) => {
      if (!window.electronAPI?.setEnvironmentVariable) {
        message.error('当前运行环境缺少写入接口')
        return
      }

      try {
        setEditorSubmitting(true)
        await window.electronAPI.setEnvironmentVariable(values)
        message.success(editingVariable ? '变量已更新' : '变量已创建')
        setEditorOpen(false)
        setEditingVariable(null)
        editorForm.resetFields()
        await loadEnvironmentSnapshot()
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '写入环境变量失败'
        message.error(errorMessage)
      } finally {
        setEditorSubmitting(false)
      }
    },
    [editorForm, editingVariable, loadEnvironmentSnapshot]
  )

  const handleDeleteVariable = useCallback(
    async (variable: EnvironmentVariable) => {
      if (!window.electronAPI?.deleteEnvironmentVariable) {
        message.error('当前运行环境缺少删除接口')
        return
      }

      try {
        await window.electronAPI.deleteEnvironmentVariable({
          key: variable.key,
          scope: variable.scope === 'system' ? 'system' : 'user',
        })
        message.success(`已删除 ${variable.key}`)
        await loadEnvironmentSnapshot()
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '删除环境变量失败'
        message.error(errorMessage)
      }
    },
    [loadEnvironmentSnapshot]
  )

  const handleCopyValue = useCallback(async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      message.success('已复制到剪贴板')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '复制失败'
      message.error(errorMessage)
    }
  }, [])

  const pinnedVariables = useMemo(() => {
    if (!snapshot?.variables.length || !favoriteIds.length) {
      return []
    }

    const map = new Map<string, EnvironmentVariable>()
    snapshot.variables.forEach((variable) => {
      if (variable.key.toUpperCase() !== 'PATH') {
        map.set(favoriteKey(variable), variable)
      }
    })

    return favoriteIds
      .map((id) => map.get(id))
      .filter((item): item is EnvironmentVariable => Boolean(item))
  }, [favoriteIds, snapshot])

  const filteredVariables = useMemo(() => {
    if (!snapshot) {
      return []
    }

    const scopes = new Set(activeScopes)
    const keyword = searchTerm.trim().toLowerCase()

    return snapshot.variables
      .filter((variable) => variable.key.toUpperCase() !== 'PATH')
      .filter((variable) => {
        if (scopes.size > 0 && !scopes.has(variable.scope)) {
          return false
        }

        if (!keyword) {
          return true
        }

        return (
          variable.key.toLowerCase().includes(keyword) ||
          variable.value.toLowerCase().includes(keyword)
        )
      })
  }, [activeScopes, searchTerm, snapshot])

  const canEditVariable = useCallback(
    (variable: EnvironmentVariable) => {
      if (!snapshot?.capabilities.supportsEditing) {
        return false
      }
      if (variable.scope === 'system') {
        return snapshot.capabilities.canEditSystem
      }
      if (variable.scope === 'user') {
        return snapshot.capabilities.canEditUser
      }
      return snapshot.capabilities.canEditUser
    },
    [snapshot]
  )

  const canDeleteVariable = useCallback(
    (variable: EnvironmentVariable) => {
      if (!snapshot?.capabilities.canDelete) {
        return false
      }
      if (variable.scope === 'process') {
        return false
      }
      return variable.scope === 'system'
        ? snapshot.capabilities.canEditSystem
        : snapshot.capabilities.canEditUser
    },
    [snapshot]
  )

  const isEditablePathTab = useCallback(
    (tabKey: PathTabKey): tabKey is EditorScope => tabKey === 'user' || tabKey === 'system',
    []
  )

  const handlePathEntryChange = useCallback(
    (index: number, value: string, scope?: EditorScope) => {
      const targetScope = scope ?? (isEditablePathTab(activePathTab) ? activePathTab : null)
      if (!targetScope) return
      setPathDrafts((prev) => {
        const next = [...prev[targetScope]]
        next[index] = value
        return { ...prev, [targetScope]: next }
      })
    },
    [activePathTab, isEditablePathTab]
  )

  const handleAddPathEntry = useCallback(
    (scope?: EditorScope) => {
      const targetScope = scope ?? (isEditablePathTab(activePathTab) ? activePathTab : null)
      if (!targetScope) return
      setPathDrafts((prev) => ({
        ...prev,
        [targetScope]: [...prev[targetScope], ''],
      }))
    },
    [activePathTab, isEditablePathTab]
  )

  const handleMovePathEntry = useCallback(
    (index: number, direction: 'up' | 'down', scope?: EditorScope) => {
      const targetScope = scope ?? (isEditablePathTab(activePathTab) ? activePathTab : null)
      if (!targetScope) return
      setPathDrafts((prev) => {
        const entries = [...prev[targetScope]]
        const targetIndex = direction === 'up' ? index - 1 : index + 1
        if (targetIndex < 0 || targetIndex >= entries.length) {
          return prev
        }
        const temp = entries[index]
        entries[index] = entries[targetIndex]
        entries[targetIndex] = temp
        return { ...prev, [targetScope]: entries }
      })
    },
    [activePathTab, isEditablePathTab]
  )

  const handleDeletePathEntry = useCallback(
    (index: number, scope?: EditorScope) => {
      const targetScope = scope ?? (isEditablePathTab(activePathTab) ? activePathTab : null)
      if (!targetScope) return
      setPathDrafts((prev) => ({
        ...prev,
        [targetScope]: prev[targetScope].filter((_, i) => i !== index),
      }))
    },
    [activePathTab, isEditablePathTab]
  )

  const handleResetPathEntries = useCallback(
    (scope?: EditorScope) => {
      if (!snapshot) return
      const targetScope = scope ?? (isEditablePathTab(activePathTab) ? activePathTab : null)
      if (!targetScope) return
      setPathDrafts((prev) => ({
        ...prev,
        [targetScope]:
          targetScope === 'user'
            ? [...(snapshot.pathEntries.user || [])]
            : [...(snapshot.pathEntries.system || [])],
      }))
    },
    [activePathTab, isEditablePathTab, snapshot]
  )

  const handleSavePathEntries = useCallback(
    async (scope?: EditorScope) => {
      if (!window.electronAPI?.setPathEntries) {
        message.error('当前运行环境缺少 PATH 写入接口')
        return
      }
      const targetScope = scope ?? (isEditablePathTab(activePathTab) ? activePathTab : null)
      if (!targetScope) {
        return
      }

      try {
        setPathSaving(true)
        await window.electronAPI.setPathEntries({
          scope: targetScope,
          entries: pathDrafts[targetScope],
        })
        message.success('PATH 已保存')
        await loadEnvironmentSnapshot()
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '保存 PATH 失败'
        message.error(errorMessage)
      } finally {
        setPathSaving(false)
      }
    },
    [activePathTab, isEditablePathTab, loadEnvironmentSnapshot, pathDrafts]
  )

  const columns: ColumnsType<EnvironmentVariable> = [
    {
      title: '变量名',
      dataIndex: 'key',
      width: 220,
      render: (_text, record) => {
        const favorite = favoriteIds.includes(favoriteKey(record))
        return (
          <Space>
            <Typography.Text strong>{record.key}</Typography.Text>
            <Tooltip title={favorite ? '取消收藏' : '收藏到上方'}>
              <Button
                type="text"
                size="small"
                icon={favorite ? <StarFilled style={{ color: '#fadb14' }} /> : <StarOutlined />}
                onClick={() => toggleFavorite(record)}
              />
            </Tooltip>
          </Space>
        )
      },
    },
    {
      title: '值',
      dataIndex: 'value',
      ellipsis: true,
      render: (value: string) => (
        <Typography.Paragraph
          style={{ margin: 0 }}
          ellipsis={{ rows: 2, tooltip: value }}
          copyable={false}
        >
          {value || <Typography.Text type="secondary">（空）</Typography.Text>}
        </Typography.Paragraph>
      ),
    },
    {
      title: '作用域',
      dataIndex: 'scope',
      width: 120,
      render: (scope: EnvVarScope) => (
        <Tag color={scopeColors[scope]}>{scopeLabels[scope] ?? scope}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      render: (_value, record) => (
        <Space>
          <Tooltip title="复制值">
            <Button
              icon={<CopyOutlined />}
              size="small"
              onClick={() => handleCopyValue(record.value)}
            />
          </Tooltip>
          <Tooltip title={canEditVariable(record) ? '编辑' : '当前作用域不可写'}>
            <Button
              icon={<EditOutlined />}
              size="small"
              disabled={!canEditVariable(record)}
              onClick={() => handleOpenEditor(record)}
            />
          </Tooltip>
          <Popconfirm
            title={`确认删除 ${record.key} ?`}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            disabled={!canDeleteVariable(record)}
            onConfirm={() => handleDeleteVariable(record)}
          >
            <Tooltip title={canDeleteVariable(record) ? '删除' : '当前作用域不可删除'}>
              <Button
                icon={<DeleteOutlined />}
                size="small"
                danger
                disabled={!canDeleteVariable(record)}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const summaryItems = useMemo(() => {
    if (!snapshot) {
      return []
    }
    return [
      { label: '平台', value: snapshot.platform },
      { label: '变量总数', value: snapshot.variables.length },
      {
        label: '可编辑',
        value: snapshot.capabilities.supportsEditing ? '是 (Windows)' : '否',
      },
      {
        label: '上次刷新',
        value: new Date(snapshot.generatedAt).toLocaleString(),
      },
    ]
  }, [snapshot])

  return (
    <WidgetLayout
      title={metadata.displayName}
      icon={metadata.icon}
      loading={state.loading}
      error={state.error}
      showRefresh={Boolean(refresh)}
      onRefresh={refresh}
      actionInProgress={isActionInProgress}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <WidgetSection
          title="环境概况"
          extra={
            snapshot ? (
              <Typography.Text type="secondary">共 {snapshot.variables.length} 项</Typography.Text>
            ) : null
          }
        >
          {summaryItems.length ? (
            <Space direction="vertical" size="small">
              {summaryItems.map((item) => (
                <Typography.Text key={item.label}>
                  <Typography.Text type="secondary">{item.label}: </Typography.Text>
                  {item.value}
                </Typography.Text>
              ))}
            </Space>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未加载环境变量" />
          )}

          {snapshot && !snapshot.capabilities.supportsEditing && (
            <Alert
              type="info"
              showIcon
              style={{ marginTop: 12 }}
              message="当前平台仅支持查看"
              description={snapshot.capabilities.notes || '后续版本将提供跨平台写入支持'}
            />
          )}
        </WidgetSection>

        {pinnedVariables.length > 0 && (
          <WidgetSection
            title="常用变量"
            extra={<Typography.Text type="secondary">{pinnedVariables.length} 项</Typography.Text>}
          >
            <Space size={[8, 8]} wrap>
              {pinnedVariables.map((variable) => (
                <Tag
                  key={favoriteKey(variable)}
                  color={scopeColors[variable.scope]}
                  closable
                  onClose={(event) => {
                    event.preventDefault()
                    toggleFavorite(variable)
                  }}
                >
                  {variable.key}
                  <Typography.Text type="secondary" style={{ marginLeft: 4 }}>
                    ({scopeLabels[variable.scope]})
                  </Typography.Text>
                </Tag>
              ))}
            </Space>
          </WidgetSection>
        )}

        <WidgetSection
          title="搜索与筛选"
          extra={
            snapshot && (
              <Typography.Text type="secondary">
                已选 {activeScopes.length || snapshot.scopes.length} 个作用域
              </Typography.Text>
            )
          }
        >
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Input
              allowClear
              value={searchTerm}
              prefix={<SearchOutlined />}
              placeholder="输入变量名或值进行搜索 (支持模糊匹配)"
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            <Space align="center" wrap>
              <Typography.Text type="secondary">作用域:</Typography.Text>
              <Checkbox.Group
                options={(snapshot?.scopes || []).map((scope) => ({
                  label: scopeLabels[scope],
                  value: scope,
                }))}
                value={activeScopes}
                onChange={(values) => setActiveScopes(values as EnvVarScope[])}
              />
              <Button size="small" onClick={() => setActiveScopes(snapshot?.scopes || [])}>
                全选
              </Button>
              <Button size="small" onClick={() => setActiveScopes([])}>
                清空
              </Button>
            </Space>
          </Space>
        </WidgetSection>

        <WidgetSection
          title="变量列表"
          extra={
            <Button
              icon={<PlusOutlined />}
              type="primary"
              size="small"
              disabled={!snapshot?.capabilities.supportsEditing}
              onClick={() => handleOpenEditor()}
            >
              新增变量
            </Button>
          }
        >
          {snapshot ? (
            <Table
              size="small"
              rowKey={(record) => favoriteKey(record)}
              dataSource={filteredVariables}
              columns={columns}
              pagination={{ pageSize: 15, showSizeChanger: true }}
              scroll={{ y: 360 }}
            />
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
          )}
        </WidgetSection>

        <WidgetSection title="PATH 管理">
          {snapshot ? (
            <Tabs
              type="card"
              activeKey={activePathTab}
              onChange={(key) => setActivePathTab(key as PathTabKey)}
              tabBarExtraContent={
                snapshot.capabilities.supportsEditing && isEditablePathTab(activePathTab) ? (
                  <Space size="small">
                    <Button
                      icon={<PlusOutlined />}
                      size="small"
                      onClick={() => handleAddPathEntry(activePathTab as EditorScope)}
                    >
                      新增目录
                    </Button>
                    <Button
                      size="small"
                      onClick={() => handleResetPathEntries(activePathTab as EditorScope)}
                      disabled={pathSaving}
                    >
                      还原
                    </Button>
                    <Button
                      type="primary"
                      size="small"
                      loading={pathSaving}
                      onClick={() => handleSavePathEntries(activePathTab as EditorScope)}
                    >
                      保存 PATH
                    </Button>
                  </Space>
                ) : undefined
              }
              items={(() => {
                const tabs: PathTabKey[] = []
                const userAvailable =
                  snapshot.scopes.includes('user') ||
                  (snapshot.pathEntries.user?.length ?? 0) > 0 ||
                  snapshot.capabilities.canEditUser
                const systemAvailable =
                  snapshot.scopes.includes('system') ||
                  (snapshot.pathEntries.system?.length ?? 0) > 0 ||
                  snapshot.capabilities.canEditSystem
                if (userAvailable) tabs.push('user')
                if (systemAvailable) tabs.push('system')
                tabs.push('process')

                return tabs.map((tabKey) => ({
                  key: tabKey,
                  label:
                    tabKey === 'user'
                      ? '用户 PATH'
                      : tabKey === 'system'
                        ? '系统 PATH'
                        : '进程 PATH',
                  children: (
                    <PathEntriesTable
                      snapshot={snapshot}
                      tabKey={tabKey}
                      pathDrafts={pathDrafts}
                      onChange={handlePathEntryChange}
                      onMove={handleMovePathEntry}
                      onDelete={handleDeletePathEntry}
                      isEditable={
                        snapshot.capabilities.supportsEditing && isEditablePathTab(tabKey)
                      }
                    />
                  ),
                }))
              })()}
            />
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
          )}
        </WidgetSection>
      </div>

      <Modal
        title={editingVariable ? `编辑 ${editingVariable.key}` : '新增环境变量'}
        open={isEditorOpen}
        okText={editingVariable ? '保存' : '创建'}
        cancelText="取消"
        onCancel={() => {
          setEditorOpen(false)
          setEditingVariable(null)
          editorForm.resetFields()
        }}
        onOk={() => editorForm.submit()}
        confirmLoading={isEditorSubmitting}
        destroyOnHidden
      >
        <Form<EnvEditorFormValues>
          form={editorForm}
          layout="vertical"
          onFinish={handleEditorFinish}
          initialValues={{ scope: 'user' }}
        >
          <Form.Item
            name="key"
            label="变量名"
            rules={[
              { required: true, message: '请输入变量名' },
              {
                pattern: /^[A-Za-z_][A-Za-z0-9_]*$/,
                message: '仅允许字母/数字/下划线，并且不能以数字开头',
              },
            ]}
          >
            <Input placeholder="例如 PATH、NODE_ENV" disabled={Boolean(editingVariable)} />
          </Form.Item>

          <Form.Item
            name="value"
            label="变量值"
            rules={[{ required: true, message: '请输入变量值' }]}
          >
            <Input.TextArea placeholder="支持多行拼接" autoSize={{ minRows: 3, maxRows: 6 }} />
          </Form.Item>

          <Form.Item
            name="scope"
            label="作用域"
            rules={[{ required: true, message: '请选择写入范围' }]}
          >
            <Select<EditorScope>
              options={[
                { label: '用户 (无需管理员)', value: 'user' },
                { label: '系统 (需要管理员)', value: 'system' },
              ]}
              disabled={
                editingVariable?.scope === 'system' && !snapshot?.capabilities.canEditSystem
              }
            />
          </Form.Item>
        </Form>
      </Modal>
    </WidgetLayout>
  )
}

interface PathEntriesTableProps {
  snapshot: EnvironmentSnapshot
  tabKey: PathTabKey
  pathDrafts: Record<EditorScope, string[]>
  onChange: (index: number, value: string, scope?: EditorScope) => void
  onMove: (index: number, direction: 'up' | 'down', scope?: EditorScope) => void
  onDelete: (index: number, scope?: EditorScope) => void
  isEditable: boolean
}

interface PathRow {
  key: string
  order: number
  value: string
}

const PathEntriesTable: React.FC<PathEntriesTableProps> = ({
  snapshot,
  tabKey,
  pathDrafts,
  onChange,
  onMove,
  onDelete,
  isEditable,
}) => {
  const isProcess = tabKey === 'process'
  const entries = isProcess ? snapshot.pathEntries.process || [] : pathDrafts[tabKey as EditorScope]

  if (!entries.length) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={isProcess ? '暂无进程 PATH 信息' : '当前作用域暂无 PATH 条目'}
      />
    )
  }

  const dataSource: PathRow[] = entries.map((value, index) => ({
    key: `${tabKey}-${index}`,
    order: index + 1,
    value,
  }))

  const columns: ColumnsType<PathRow> = [
    {
      title: '#',
      dataIndex: 'order',
      width: 60,
      align: 'center',
    },
    {
      title: '目录',
      dataIndex: 'value',
      render: (value: string, _record, index) =>
        isProcess || !isEditable ? (
          <Typography.Paragraph
            style={{ margin: 0 }}
            ellipsis={{ rows: 1, tooltip: value }}
            copyable={Boolean(value)}
          >
            {value || <Typography.Text type="secondary">（空）</Typography.Text>}
          </Typography.Paragraph>
        ) : (
          <Input
            value={value}
            placeholder="目录路径"
            onChange={(event) => onChange(index, event.target.value, tabKey as EditorScope)}
          />
        ),
    },
  ]

  if (!isProcess && isEditable) {
    columns.push({
      title: '操作',
      key: 'operations',
      width: 180,
      render: (_value, _record, index) => (
        <Space>
          <Tooltip title="上移">
            <Button
              icon={<ArrowUpOutlined />}
              size="small"
              disabled={index === 0}
              onClick={() => onMove(index, 'up', tabKey as EditorScope)}
            />
          </Tooltip>
          <Tooltip title="下移">
            <Button
              icon={<ArrowDownOutlined />}
              size="small"
              disabled={index === entries.length - 1}
              onClick={() => onMove(index, 'down', tabKey as EditorScope)}
            />
          </Tooltip>
          <Popconfirm
            title="确认删除该目录？"
            okText="删除"
            cancelText="取消"
            onConfirm={() => onDelete(index, tabKey as EditorScope)}
          >
            <Button icon={<DeleteOutlined />} size="small" danger />
          </Popconfirm>
        </Space>
      ),
    })
  }

  return (
    <Table<PathRow>
      size="small"
      rowKey="key"
      columns={columns}
      dataSource={dataSource}
      pagination={false}
      scroll={{ y: 280 }}
    />
  )
}

export default EnvironmentWidget
