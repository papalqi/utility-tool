/**
 * GitHub Widget - GitHub 仓库管理（重构版）
 *
 * 功能：
 * 1. GitHub Token 配置（存储到 Obsidian secrets）
 * 2. 本地仓库管理（添加、删除、打开、查看状态）
 * 3. 远程仓库浏览和克隆
 */

import { useState, useMemo, useCallback } from 'react'
import {
  App,
  Tabs,
  Button,
  Input,
  Tag,
  Space,
  Empty,
  Modal,
  Form,
  Select,
  Alert,
  Tooltip,
  Typography,
  Spin,
  Dropdown,
  Card,
  Row,
  Col,
  Avatar,
} from 'antd'
import type { MenuProps } from 'antd'
import {
  GithubOutlined,
  FolderOpenOutlined,
  PlusOutlined,
  DeleteOutlined,
  FolderOutlined,
  StarOutlined,
  StarFilled,
  ReloadOutlined,
  DownloadOutlined,
  LinkOutlined,
  BranchesOutlined,
  SettingOutlined,
  MoreOutlined,
  GlobalOutlined,
} from '@ant-design/icons'
import { motion } from 'framer-motion'
import { useTheme } from '@/contexts/ThemeContext'
import type { WidgetMetadata } from '@/shared/widget-types'
import type { LocalRepository, GitHubRepository } from '@/shared/github-types'
import { useWidget } from '@/hooks/useWidget'
import { useWidgetStorage } from '@/hooks/useWidgetStorage'
import { WidgetLayout, WidgetSection } from '@/components/widgets'
import { useObsidian } from '@/hooks/useObsidian'
import { useGitHub, type GitAction } from '@/hooks/api/useGitHub'

const { Text, Paragraph } = Typography
const { Search } = Input

// ==================== Metadata ====================

const metadata: WidgetMetadata = {
  id: 'github',
  displayName: 'GitHub 管理',
  icon: <GithubOutlined />,
  description: '管理 GitHub 仓库，克隆远程仓库，管理本地仓库集合',
  category: 'tools',
  order: 9,
  enabled: true,
}

// ==================== 类型定义 ====================

type FavoriteEntry = {
  remoteUrl: string
  fullName: string
  htmlUrl: string
  repo?: GitHubRepository
}

// ==================== 工具函数 ====================

const getRepoHtmlUrlFromRemote = (remoteUrl: string, normalizeGitRemote: (url?: string) => string, getRepoSlugFromRemote: (url: string) => string) => {
  const normalized = normalizeGitRemote(remoteUrl).replace(/\.git$/i, '')
  if (!normalized) return 'https://github.com'
  if (normalized.startsWith('http')) return normalized
  const slug = getRepoSlugFromRemote(normalized)
  return slug ? `https://github.com/${slug.replace(/^\/+/, '')}` : 'https://github.com'
}

// ==================== 组件实现 ====================

const GitHubWidget = () => {
  const { message, modal } = App.useApp()
  const { colors } = useTheme()
  const { isEnabled: obsidianEnabled } = useObsidian()

  // 使用重构后的 Hook
  const github = useGitHub({
    onMessage: (type, content) => message[type](content),
    onLog: (level, msg, data) => widgetLogger[level](msg, data),
  })

  const { state, widgetLogger } = useWidget({ metadata })

  // ========== UI 状态 ==========
  const [activeTab, setActiveTab] = useState<'local' | 'remote' | 'favorites'>('local')
  const [searchText, setSearchText] = useState('')
  const [newFavoriteUrl, setNewFavoriteUrl] = useState('')
  const [tokenModalVisible, setTokenModalVisible] = useState(false)
  const [addRepoModalVisible, setAddRepoModalVisible] = useState(false)

  const [tokenForm] = Form.useForm()
  const [addRepoForm] = Form.useForm()

  const { value: uiState } = useWidgetStorage({
    key: 'github-ui-state',
    defaultValue: { sortBy: 'name', favoriteOnly: false },
  })

  // ========== 计算属性 ==========

  const remoteRepoMap = useMemo(() => {
    const map = new Map<string, GitHubRepository>()
    github.remoteRepos.forEach((repo) => {
      const normalized = github.normalizeGitRemote(repo.clone_url)
      if (normalized && !map.has(normalized)) {
        map.set(normalized, repo)
      }
    })
    return map
  }, [github.remoteRepos, github.normalizeGitRemote])

  const filteredLocalRepos = useMemo(() => {
    let filtered = [...github.localRepos]

    if (searchText) {
      filtered = filtered.filter(
        (repo) =>
          repo.name.toLowerCase().includes(searchText.toLowerCase()) ||
          repo.path.toLowerCase().includes(searchText.toLowerCase()) ||
          repo.description?.toLowerCase().includes(searchText.toLowerCase())
      )
    }

    if (uiState.favoriteOnly) {
      filtered = filtered.filter((repo) => github.isRepoFavorited(repo.remoteUrl))
    }

    filtered.sort((a, b) => {
      const aFav = github.isRepoFavorited(a.remoteUrl)
      const bFav = github.isRepoFavorited(b.remoteUrl)
      if (aFav && !bFav) return -1
      if (!aFav && bFav) return 1
      return uiState.sortBy === 'lastOpened'
        ? (b.lastOpened || 0) - (a.lastOpened || 0)
        : a.name.localeCompare(b.name)
    })

    return filtered
  }, [github.localRepos, searchText, uiState, github.isRepoFavorited])

  const filteredRemoteRepos = useMemo(() => {
    if (!searchText) return github.remoteRepos
    return github.remoteRepos.filter(
      (repo) =>
        repo.name.toLowerCase().includes(searchText.toLowerCase()) ||
        repo.description?.toLowerCase().includes(searchText.toLowerCase()) ||
        repo.full_name.toLowerCase().includes(searchText.toLowerCase())
    )
  }, [github.remoteRepos, searchText])

  const favoriteEntries = useMemo<FavoriteEntry[]>(() => {
    return github.favoriteRemotes.map((remoteUrl) => {
      const normalized = github.normalizeGitRemote(remoteUrl)
      const repo = normalized ? remoteRepoMap.get(normalized) : undefined
      const fullName = repo?.full_name || github.getRepoSlugFromRemote(remoteUrl) || remoteUrl
      return {
        remoteUrl,
        repo,
        fullName,
        htmlUrl: repo?.html_url || getRepoHtmlUrlFromRemote(remoteUrl, github.normalizeGitRemote, github.getRepoSlugFromRemote),
      }
    })
  }, [github.favoriteRemotes, remoteRepoMap, github.normalizeGitRemote, github.getRepoSlugFromRemote])

  const filteredFavoriteEntries = useMemo(() => {
    if (!searchText) return favoriteEntries
    const query = searchText.toLowerCase()
    return favoriteEntries.filter(
      (entry) =>
        entry.fullName.toLowerCase().includes(query) ||
        entry.remoteUrl.toLowerCase().includes(query)
    )
  }, [favoriteEntries, searchText])

  const localEmptyDescription = useMemo(() => {
    if (searchText) return '没有匹配的仓库'
    if (!obsidianEnabled) return 'Obsidian 未启用，无法加载已保存的本地仓库。'
    if (!github.hostname) return '正在读取当前计算机信息...'
    return `Obsidian 中没有 ${github.hostname} 的仓库记录，可能保存在其他电脑。可使用「远程仓库」快速克隆。`
  }, [searchText, obsidianEnabled, github.hostname])

  // ========== 事件处理 ==========

  const handleAddLocalRepo = async () => {
    try {
      const values = await addRepoForm.validateFields()
      const path = values.path.trim()

      if (github.localRepos.some((repo) => repo.path === path)) {
        message.warning('该路径已存在于列表中')
        return
      }

      const gitInfo = await github.getGitInfo(path)

      await github.addLocalRepo({
        name: values.name || path.split('/').pop() || 'Unknown',
        path,
        remoteUrl: gitInfo.remoteUrl,
        branch: gitInfo.branch,
        description: values.description,
        tags: values.tags || [],
        lastOpened: Date.now(),
      })

      setAddRepoModalVisible(false)
      addRepoForm.resetFields()
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return
      const errorMessage = error instanceof Error ? error.message : String(error)
      message.error(`添加仓库失败：${errorMessage}`)
    }
  }

  const handleDeleteLocalRepo = (repo: LocalRepository) => {
    modal.confirm({
      title: `确定要从列表中移除仓库「${repo.name}」？`,
      content: '这不会删除本地文件，仅从列表中移除',
      okText: '移除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => github.removeLocalRepo(repo.id),
    })
  }

  const handleGitAction = async (repo: LocalRepository, action: GitAction) => {
    const output = await github.execGitAction(repo, action)
    if (action === 'status' && output) {
      modal.info({
        title: `${repo.name} - Git 状态`,
        content: <pre style={{ maxHeight: 300, overflow: 'auto', marginBottom: 0 }}>{output}</pre>,
        width: 520,
      })
    }
  }

  const handleSelectDirectory = async () => {
    try {
      const path = await window.electronAPI.selectFolder({
        title: '选择仓库目录',
        properties: ['openDirectory'],
      })
      if (path) addRepoForm.setFieldsValue({ path })
    } catch {
      message.error('选择目录失败')
    }
  }

  const handleCloneRepo = async (repo: GitHubRepository) => {
    const success = await github.cloneRepo(repo.clone_url, repo.name, repo.description || undefined)
    if (success) setActiveTab('local')
  }

  const handleCloneFavoriteRepo = async (remoteUrl: string) => {
    const normalized = github.normalizeGitRemote(remoteUrl)
    const repo = normalized ? remoteRepoMap.get(normalized) : undefined
    const success = await github.cloneRepo(
      repo?.clone_url || remoteUrl,
      repo?.name || github.getRepoNameFromRemote(remoteUrl),
      repo?.description || undefined
    )
    if (success) setActiveTab('local')
  }

  const handleVerifyToken = useCallback(async (token: string) => {
    const success = await github.verifyToken(token)
    if (success) setTokenModalVisible(false)
  }, [github])

  const handleAddFavoriteUrl = useCallback(async (value?: string) => {
    const target = (value ?? newFavoriteUrl).trim()
    await github.addFavoriteUrl(target)
    setNewFavoriteUrl('')
  }, [github, newFavoriteUrl])

  const gitMenuItems: MenuProps['items'] = [
    { key: 'status', label: '查看状态' },
    { key: 'pull', label: '拉取 (git pull)' },
    { key: 'fetch', label: '更新引用 (git fetch)' },
    { key: 'push', label: '推送 (git push)' },
  ]

  // ========== Card 组件 ==========

  const LocalRepoCard = ({ repo }: { repo: LocalRepository }) => {
    const repoFavorited = github.isRepoFavorited(repo.remoteUrl)

    return (
      <motion.div layout whileHover={{ y: -4, transition: { duration: 0.2 } }} style={{ height: '100%' }}>
        <Card
          size="small"
          style={{ height: '100%', borderRadius: 12, border: `1px solid ${colors.borderPrimary}`, background: colors.bgSecondary }}
          styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column' } }}
          actions={[
            <Tooltip title={repoFavorited ? '取消收藏' : '收藏'} key="fav">
              <Button type="text" size="small" icon={repoFavorited ? <StarFilled style={{ color: colors.starYellow }} /> : <StarOutlined />} onClick={() => repo.remoteUrl && github.toggleFavorite(repo.remoteUrl)} />
            </Tooltip>,
            <Tooltip title="打开文件夹" key="folder">
              <Button type="text" size="small" icon={<FolderOpenOutlined />} onClick={() => github.openRepoDir(repo)} />
            </Tooltip>,
            <Dropdown key="more" menu={{ items: gitMenuItems, onClick: ({ key }) => handleGitAction(repo, key as GitAction) }}>
              <Tooltip title="Git 操作">
                <Button type="text" size="small" icon={<MoreOutlined />} loading={github.gitActionState?.repoId === repo.id} />
              </Tooltip>
            </Dropdown>,
            <Tooltip title="移除" key="remove">
              <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteLocalRepo(repo)} />
            </Tooltip>,
          ]}
        >
          <Card.Meta
            avatar={<Avatar shape="square" icon={<GithubOutlined />} style={{ backgroundColor: colors.bgTertiary, color: colors.textPrimary }} />}
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong ellipsis style={{ maxWidth: 140 }} title={repo.name}>{repo.name}</Text>
                {repo.branch && <Tag icon={<BranchesOutlined />} color="blue" style={{ margin: 0, fontSize: 10 }}>{repo.branch}</Tag>}
              </div>
            }
            description={
              <Space direction="vertical" size={0} style={{ width: '100%' }}>
                <Text type="secondary" style={{ fontSize: 12 }} ellipsis={{ tooltip: repo.path }}><FolderOutlined style={{ marginRight: 4 }} />{repo.path}</Text>
                <Text type="secondary" style={{ fontSize: 12 }} ellipsis={{ tooltip: repo.remoteUrl }}><GlobalOutlined style={{ marginRight: 4 }} />{repo.remoteUrl ? github.getRepoSlugFromRemote(repo.remoteUrl) : 'No Remote'}</Text>
              </Space>
            }
          />
        </Card>
      </motion.div>
    )
  }

  const RemoteRepoCard = ({ repo }: { repo: GitHubRepository }) => {
    const repoFavorited = github.isRepoFavorited(repo.clone_url)

    return (
      <motion.div layout whileHover={{ y: -4, transition: { duration: 0.2 } }} style={{ height: '100%' }}>
        <Card
          size="small"
          style={{ height: '100%', borderRadius: 12, border: `1px solid ${colors.borderPrimary}`, background: colors.bgSecondary }}
          styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column' } }}
          actions={[
            <Tooltip title={repoFavorited ? '取消收藏' : '收藏'} key="fav">
              <Button type="text" size="small" icon={repoFavorited ? <StarFilled style={{ color: colors.starYellow }} /> : <StarOutlined />} onClick={() => github.toggleFavorite(repo.clone_url)} />
            </Tooltip>,
            <Tooltip title="在浏览器打开" key="browser">
              <Button type="text" size="small" icon={<LinkOutlined />} onClick={() => window.electronAPI.openExternal(repo.html_url)} />
            </Tooltip>,
            <Tooltip title="克隆到本地" key="clone">
              <Button type="text" size="small" icon={<DownloadOutlined />} onClick={() => handleCloneRepo(repo)} />
            </Tooltip>,
          ]}
        >
          <Card.Meta
            avatar={<Avatar src={repo.owner?.avatar_url} icon={<GithubOutlined />} />}
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong ellipsis style={{ maxWidth: 160 }} title={repo.full_name}>{repo.name}</Text>
                <Space size={4}><StarOutlined style={{ fontSize: 12 }} /><Text type="secondary" style={{ fontSize: 12 }}>{repo.stargazers_count}</Text></Space>
              </div>
            }
            description={
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Text type="secondary" style={{ fontSize: 12 }} ellipsis={{ tooltip: repo.description }}>{repo.description || 'No description'}</Text>
                {repo.language && <Tag color="blue" style={{ margin: 0, alignSelf: 'flex-start' }}>{repo.language}</Tag>}
              </Space>
            }
          />
        </Card>
      </motion.div>
    )
  }

  const FavoriteCard = ({ entry }: { entry: FavoriteEntry }) => {
    const normalizedRemote = github.normalizeGitRemote(entry.remoteUrl)
    const alreadyCloned = github.localRepos.some((repo) => repo.remoteUrl && normalizedRemote && github.normalizeGitRemote(repo.remoteUrl) === normalizedRemote)

    return (
      <motion.div layout whileHover={{ y: -4, transition: { duration: 0.2 } }} style={{ height: '100%' }}>
        <Card
          size="small"
          style={{ height: '100%', borderRadius: 12, border: `1px solid ${colors.borderPrimary}`, background: colors.bgSecondary }}
          styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', textAlign: 'center' } }}
          actions={[
            <Tooltip title="移除收藏" key="remove">
              <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => github.toggleFavorite(entry.remoteUrl)} />
            </Tooltip>,
            <Tooltip title="在浏览器打开" key="browser">
              <Button type="text" size="small" icon={<LinkOutlined />} onClick={() => window.open(entry.htmlUrl, '_blank')} />
            </Tooltip>,
            <Tooltip title={alreadyCloned ? '本地已有副本' : '克隆仓库'} key="clone">
              <Button type="primary" size="small" icon={<DownloadOutlined />} onClick={() => handleCloneFavoriteRepo(entry.remoteUrl)} disabled={alreadyCloned} />
            </Tooltip>,
          ]}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: 12 }}><StarFilled style={{ color: colors.starYellow, fontSize: 24 }} /></div>
            <div style={{ marginBottom: 4 }}><Text strong ellipsis style={{ maxWidth: '100%' }} title={entry.fullName}>{entry.fullName}</Text></div>
            <div style={{ marginBottom: 8 }}><Text type="secondary" style={{ fontSize: 12 }} ellipsis={{ tooltip: entry.remoteUrl }}>{entry.remoteUrl}</Text></div>
            {entry.repo?.description && <div style={{ marginBottom: 4 }}><Text type="secondary" style={{ fontSize: 12 }} ellipsis={{ tooltip: entry.repo.description }}>{entry.repo.description}</Text></div>}
            {entry.repo?.language && <div><Tag color="blue" style={{ margin: 0, fontSize: 10 }}>{entry.repo.language}</Tag></div>}
          </div>
        </Card>
      </motion.div>
    )
  }

  // ========== UI 渲染 ==========

  if (!obsidianEnabled) {
    return (
      <WidgetLayout title={metadata.displayName} icon={metadata.icon} loading={state.loading}>
        <Alert type="warning" message="需要启用 Obsidian" description="GitHub 仓库数据需要存储在 Obsidian Vault 中。请在设置中配置 Obsidian Vault 路径。" showIcon />
      </WidgetLayout>
    )
  }

  return (
    <>
      <WidgetLayout
        title={metadata.displayName}
        icon={metadata.icon}
        loading={state.loading}
        bordered
        extra={
          <Space>
            <Button icon={<SettingOutlined />} onClick={() => setTokenModalVisible(true)} type={github.tokenVerified ? 'default' : 'primary'}>
              {github.tokenVerified ? '已配置 Token' : '配置 Token'}
            </Button>
          </Space>
        }
      >
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as 'local' | 'remote' | 'favorites')}
          items={[
            {
              key: 'local',
              label: <span><FolderOutlined /> 本地仓库 ({github.localRepos.length})</span>,
              children: (
                <WidgetSection
                  title="本地仓库"
                  icon={<FolderOutlined />}
                  extra={
                    <Space>
                      <Search placeholder="搜索仓库..." allowClear style={{ width: 200 }} value={searchText} onChange={(e) => setSearchText(e.target.value)} />
                      <Button icon={<PlusOutlined />} type="primary" onClick={() => setAddRepoModalVisible(true)}>添加仓库</Button>
                      <Button icon={<ReloadOutlined />} onClick={() => github.loadLocalRepos()}>刷新</Button>
                    </Space>
                  }
                >
                  <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                    {github.hostname ? `当前主机：${github.hostname}。本地仓库记录会存储在 Obsidian，并按计算机隔离。其他电脑将看到「没有本地数据」，可通过远程仓库快速克隆。` : '正在读取当前计算机名称，本地仓库将按照机器隔离存储。'}
                  </Paragraph>
                  {filteredLocalRepos.length === 0 ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={localEmptyDescription}>
                      {!searchText && <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddRepoModalVisible(true)}>添加第一个仓库</Button>}
                    </Empty>
                  ) : (
                    <Row gutter={[16, 16]}>
                      {filteredLocalRepos.map((repo) => (
                        <Col xs={24} sm={12} md={8} lg={6} key={repo.id}><LocalRepoCard repo={repo} /></Col>
                      ))}
                    </Row>
                  )}
                </WidgetSection>
              ),
            },
            {
              key: 'remote',
              label: <span><GithubOutlined /> 远程仓库 ({github.remoteRepos.length})</span>,
              children: (
                <WidgetSection
                  title="GitHub 仓库"
                  icon={<GithubOutlined />}
                  extra={
                    <Space>
                      <Search placeholder="搜索仓库..." allowClear style={{ width: 200 }} value={searchText} onChange={(e) => setSearchText(e.target.value)} />
                      <Button icon={<ReloadOutlined />} onClick={github.loadRemoteRepos} loading={github.loading} disabled={!github.tokenVerified}>
                        {github.remoteRepos.length > 0 ? '刷新' : '加载仓库'}
                      </Button>
                    </Space>
                  }
                >
                  <Paragraph type="secondary" style={{ marginBottom: 16 }}>远程仓库列表来自您的 GitHub 账户，可在其他电脑上快速克隆并与 Obsidian 中的本地记录保持同步。</Paragraph>
                  {!github.tokenVerified ? (
                    <Alert type="info" message="需要配置 GitHub Token" description="请先配置 GitHub Personal Access Token 以访问您的仓库" showIcon action={<Button type="primary" onClick={() => setTokenModalVisible(true)}>配置 Token</Button>} />
                  ) : github.remoteRepos.length === 0 ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="点击「加载仓库」按钮获取您的 GitHub 仓库列表">
                      <Button type="primary" icon={<ReloadOutlined />} onClick={github.loadRemoteRepos} loading={github.loading}>加载仓库</Button>
                    </Empty>
                  ) : (
                    <Spin spinning={github.loading}>
                      <Row gutter={[16, 16]}>
                        {filteredRemoteRepos.map((repo) => (
                          <Col xs={24} sm={12} md={8} lg={6} key={repo.id}><RemoteRepoCard repo={repo} /></Col>
                        ))}
                      </Row>
                    </Spin>
                  )}
                </WidgetSection>
              ),
            },
            {
              key: 'favorites',
              label: <span><StarOutlined /> 收藏 ({github.favoriteRemotes.length})</span>,
              children: (
                <WidgetSection
                  title="收藏仓库"
                  icon={<StarOutlined />}
                  extra={
                    <Space wrap>
                      <Search placeholder="搜索收藏..." allowClear style={{ width: 200 }} value={searchText} onChange={(e) => setSearchText(e.target.value)} />
                      <Search placeholder="粘贴 GitHub 仓库地址" allowClear style={{ width: 320 }} enterButton="添加收藏" value={newFavoriteUrl} onChange={(e) => setNewFavoriteUrl(e.target.value)} onSearch={(value) => handleAddFavoriteUrl(value)} />
                      <Button icon={<ReloadOutlined />} onClick={github.loadFavorites} loading={github.loading}>刷新</Button>
                    </Space>
                  }
                >
                  <Paragraph type="secondary" style={{ marginBottom: 16 }}>收藏列表只记录远程路径，可在任意设备快速打开浏览或克隆。</Paragraph>
                  {github.favoriteRemotes.length === 0 ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无收藏记录">
                      <Button type="primary" icon={<StarOutlined />} onClick={() => setActiveTab('remote')}>前往远程仓库收藏</Button>
                    </Empty>
                  ) : filteredFavoriteEntries.length === 0 ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有匹配的收藏" />
                  ) : (
                    <Row gutter={[16, 16]}>
                      {filteredFavoriteEntries.map((entry) => (
                        <Col xs={24} sm={12} md={8} lg={6} key={entry.remoteUrl}><FavoriteCard entry={entry} /></Col>
                      ))}
                    </Row>
                  )}
                </WidgetSection>
              ),
            },
          ]}
        />
      </WidgetLayout>

      {/* Token 配置 Modal */}
      <Modal title="配置 GitHub Token" open={tokenModalVisible} onCancel={() => setTokenModalVisible(false)} footer={null} destroyOnHidden>
        <Form form={tokenForm} layout="vertical" initialValues={{ token: github.githubToken }} onFinish={async (values) => { await handleVerifyToken(values.token) }}>
          <Alert
            type="info"
            message="如何创建 GitHub Personal Access Token？"
            description={
              <ol style={{ paddingLeft: 20, marginTop: 8 }}>
                <li>访问 GitHub Settings → Developer settings → Personal access tokens</li>
                <li>点击 &quot;Generate new token (classic)&quot;</li>
                <li>选择权限：repo (完整访问)</li>
                <li>生成并复制 Token</li>
              </ol>
            }
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Form.Item label="Personal Access Token" name="token" rules={[{ required: true, message: '请输入 Token' }]}>
            <Input.Password placeholder="ghp_..." />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setTokenModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={github.loading}>验证并保存</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 添加仓库 Modal */}
      <Modal
        title="添加本地仓库"
        open={addRepoModalVisible}
        onCancel={() => { setAddRepoModalVisible(false); addRepoForm.resetFields() }}
        onOk={handleAddLocalRepo}
        confirmLoading={github.loading}
      >
        <Form form={addRepoForm} layout="vertical">
          <Form.Item label="仓库路径" name="path" rules={[{ required: true, message: '请选择仓库路径' }]}>
            <Space.Compact style={{ width: '100%' }}>
              <Input placeholder="选择仓库所在目录" />
              <Button type="default" icon={<FolderOpenOutlined />} onClick={handleSelectDirectory}>浏览</Button>
            </Space.Compact>
          </Form.Item>
          <Form.Item label="仓库名称" name="name"><Input placeholder="留空则使用目录名" /></Form.Item>
          <Form.Item label="描述" name="description"><Input.TextArea rows={2} placeholder="可选" /></Form.Item>
          <Form.Item label="标签" name="tags"><Select mode="tags" placeholder="添加标签，如：work, personal" /></Form.Item>
        </Form>
      </Modal>
    </>
  )
}

export default GitHubWidget
