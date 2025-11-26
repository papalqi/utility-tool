import { Card, Typography } from 'antd'

const { Title, Paragraph } = Typography

const ScriptsWidget = () => {
  return (
    <div>
      <Title level={2}>Script Runner</Title>
      <Card>
        <Paragraph>Batch script management, concurrent execution, and scheduled tasks.</Paragraph>
        <Paragraph type="secondary">Implementation coming soon...</Paragraph>
      </Card>
    </div>
  )
}

export default ScriptsWidget
