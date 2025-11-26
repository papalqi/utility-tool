import { Card, Typography } from 'antd'

const { Title, Paragraph } = Typography

const AttachmentsWidget = () => {
  return (
    <div>
      <Title level={2}>Attachment Manager</Title>
      <Card>
        <Paragraph>
          File and image management with PicGo integration for uploads and markdown formatting.
        </Paragraph>
        <Paragraph type="secondary">Implementation coming soon...</Paragraph>
      </Card>
    </div>
  )
}

export default AttachmentsWidget
