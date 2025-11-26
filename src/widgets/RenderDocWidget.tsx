import { Card, Typography } from 'antd'

const { Title, Paragraph } = Typography

const RenderDocWidget = () => {
  return (
    <div>
      <Title level={2}>RenderDoc</Title>
      <Card>
        <Paragraph>Rendering debug scripts, configuration files, and capture management.</Paragraph>
        <Paragraph type="secondary">Implementation coming soon...</Paragraph>
      </Card>
    </div>
  )
}

export default RenderDocWidget
