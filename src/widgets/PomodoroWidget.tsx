import { Card, Typography } from 'antd'

const { Title, Paragraph } = Typography

const PomodoroWidget = () => {
  return (
    <div>
      <Title level={2}>Pomodoro Timer</Title>
      <Card>
        <Paragraph>
          Custom time intervals, sound alerts, and TODO workflow synchronization.
        </Paragraph>
        <Paragraph type="secondary">Implementation coming soon...</Paragraph>
      </Card>
    </div>
  )
}

export default PomodoroWidget
