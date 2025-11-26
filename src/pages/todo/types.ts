import type { Attachment } from '@/shared/types'

export interface TodoFormValues {
  text: string
  category: string
  priority: 'low' | 'medium' | 'high'
  tags: string
  note?: string
  conclusion?: string
}

export interface TodoStats {
  total: number
  completed: number
  active: number
  highPriority: number
}

export interface FormAttachmentState {
  currentAttachments: Attachment[]
  onAddAttachment: () => void
  onRemoveAttachment: (index: number) => void
}
