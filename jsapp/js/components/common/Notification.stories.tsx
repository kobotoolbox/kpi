import type { MantineSize } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/react-webpack5'
import * as TablerIcons from '@tabler/icons-react'
import type { TablerIcon } from '@tabler/icons-react'
import KoboIcon from './KoboIcon'
import Notification, { type NotificationProps } from './Notification'

const tablerIconEntries = Object.entries(TablerIcons).filter(
  (entry): entry is [string, TablerIcon] =>
    entry[0].startsWith('Icon') &&
    (typeof entry[1] === 'function' || (typeof entry[1] === 'object' && entry[1] !== null)),
)
const tablerIconOptions = tablerIconEntries.map(([tablerIconName]) => tablerIconName).sort((a, b) => a.localeCompare(b))
const tablerIconMapping = Object.fromEntries(tablerIconEntries)

interface NotificationStory extends NotificationProps {
  iconSize: MantineSize
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
    icon: {
      description: 'Tabler icon component rendered via KoboIcon',
      options: tablerIconOptions,
      control: { type: 'select' },
    },
    iconSize: {
      description: 'Icon size',
      options: ['xs', 'sm', 'md', 'lg', 'xl'],
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
    icon: 'IconCheckFilled',
    iconSize: 'xs',
  },
  render: (args) => {
    const selectedTablerIcon = typeof args.icon === 'string' ? tablerIconMapping[args.icon] : undefined
    return (
      <Notification
        {...args}
        icon={selectedTablerIcon ? <KoboIcon icon={selectedTablerIcon} size={args.iconSize} /> : undefined}
      >
        <a href='#'>Click here</a> to monitor your progress or to cancel this job
      </Notification>
    )
  },
}
