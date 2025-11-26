/**
 * useProjects Hook
 * 管理项目列表的状态和操作
 */

import { useState, useEffect, useCallback } from 'react'
import type { Project } from '../shared/types'
import { obsidianManager } from '../core/ObsidianManager'

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

  // 加载项目列表
  const loadProjects = useCallback(async () => {
    try {
      setLoading(true)

      // 获取当前计算机名称
      const hostname = await window.electronAPI.getHostname()

      // 从 Obsidian secrets.md 读取项目列表
      const projectList = await obsidianManager.getProjectsForComputer(hostname)

      setProjects(projectList)
    } catch (error) {
      console.error('Failed to load projects:', error)
      setProjects([])
    } finally {
      setLoading(false)
    }
  }, [])

  // 保存项目列表到 Obsidian
  const saveProjects = useCallback(async (updatedProjects: Project[]) => {
    try {
      // 获取当前计算机名称
      const hostname = await window.electronAPI.getHostname()

      // 保存到 Obsidian secrets.md
      const success = await obsidianManager.saveProjectsForComputer(hostname, updatedProjects)

      if (!success) {
        throw new Error('Failed to save projects to Obsidian')
      }

      setProjects(updatedProjects)
    } catch (error) {
      console.error('Failed to save projects:', error)
      throw error
    }
  }, [])

  // 添加项目
  const addProject = useCallback(
    async (project: Project) => {
      // 检查项目名是否重复
      if (projects.some((p) => p.name === project.name)) {
        throw new Error(`项目 '${project.name}' 已存在`)
      }

      const updatedProjects = [...projects, project]
      await saveProjects(updatedProjects)
    },
    [projects, saveProjects]
  )

  // 更新项目
  const updateProject = useCallback(
    async (oldName: string, updatedProject: Project) => {
      // 检查新名称是否与其他项目重复
      if (updatedProject.name !== oldName && projects.some((p) => p.name === updatedProject.name)) {
        throw new Error(`项目名 '${updatedProject.name}' 已被使用`)
      }

      const updatedProjects = projects.map((p) => (p.name === oldName ? updatedProject : p))
      await saveProjects(updatedProjects)

      // 更新选中的项目
      if (selectedProject?.name === oldName) {
        setSelectedProject(updatedProject)
      }
    },
    [projects, selectedProject, saveProjects]
  )

  // 删除项目
  const deleteProject = useCallback(
    async (projectName: string) => {
      const updatedProjects = projects.filter((p) => p.name !== projectName)
      await saveProjects(updatedProjects)

      // 如果删除的是当前选中的项目，清空选中状态
      if (selectedProject?.name === projectName) {
        setSelectedProject(null)
      }
    },
    [projects, selectedProject, saveProjects]
  )

  // 初始化加载
  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  return {
    projects,
    selectedProject,
    setSelectedProject,
    loading,
    addProject,
    updateProject,
    deleteProject,
    refreshProjects: loadProjects,
  }
}
