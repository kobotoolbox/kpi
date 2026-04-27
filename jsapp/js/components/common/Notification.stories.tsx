import { Notification, type NotificationProps } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { IconNames } from '#/k-icons'
import { recordKeys } from '#/utils'
import Icon, { type IconSize } from './icon'

interface NotificationStory extends NotificationProps {
  iconName: keyof typeof IconNames
  iconSize: IconSize
  message: string
}

const meta: Meta<NotificationStory> = {
  title: 'Design system/Notification',
  component: Notification,
  argTypes: {
    title: {
      description: 'Text in the notification',
      control: { type: 'text' },
    },
    message: {
      description:
        'Child message — supports HTML, e.g. <code>&lt;a href="#"&gt;Click here&lt;/a&gt; to continue</code>',
      control: { type: 'text' },
    },
    iconName: {
      description: 'Icon to display',
      options: [undefined, ...recordKeys(IconNames)],
      control: { type: 'select' },
    },
    iconSize: {
      description: 'Icon size',
      options: ['xxs', 'xs', 's', 'm', 'l', 'xl'],
      control: { type: 'select' },
    },
  },
  parameters: { a11y: { test: 'todo' } },
}

export default meta

type Story = StoryObj<NotificationStory>

export const Default: Story = {
  args: {
    title: 'Your transcripts are on their way!',
    message: '<a href="#">Click here</a> to monitor your progress or to cancel this job',
    iconName: 'check',
    iconSize: 's',
  },
  render: (args) => (
    <Notification {...args} icon={args.iconName ? <Icon name={args.iconName} size={args.iconSize} /> : undefined}>
      <span dangerouslySetInnerHTML={{ __html: args.message }} />
    </Notification>
  ),
}
