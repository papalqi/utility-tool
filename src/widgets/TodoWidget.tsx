import { Card, Typography } from 'antd'

const { Title, Paragraph } = Typography

const TodoWidget = () => {
  return (
    <div>
      <Title level={2}>TODO List</Title>
      <Card>
        <Paragraph>
          Manage your tasks with Obsidian bidirectional sync, template content, auto-save, and AI
          clipboard parsing.
        </Paragraph>
        <Paragraph type="secondary">Implementation coming soon...</Paragraph>
      </Card>
    </div>
  )
}

export default TodoWidget
