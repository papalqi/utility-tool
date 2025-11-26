import { Card, Typography } from 'antd'

const { Title, Paragraph } = Typography

const QuickAccessWidget = () => {
  return (
    <div>
      <Title level={2}>Quick Access</Title>
      <Card>
        <Paragraph>
          Quick shortcuts to local applications and web URLs with custom categories and icons.
        </Paragraph>
        <Paragraph type="secondary">Implementation coming soon...</Paragraph>
      </Card>
    </div>
  )
}

export default QuickAccessWidget
