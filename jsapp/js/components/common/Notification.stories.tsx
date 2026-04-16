import { Notification } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { IconNames } from '#/k-icons'
import { recordKeys } from '#/utils'
import Icon from './icon'

const meta: Meta<typeof Notification> = {
  title: 'Design system/Notification',
  component: Notification,
  argTypes: {
    title: {
      description: 'Text in the notification',
      control: { type: 'text' },
    },
    icon: {
      description: 'Icon to display',
      options: [undefined, ...recordKeys(IconNames)],
      mapping: {
        ...recordKeys(IconNames).reduce(
          (componentList, iconName) => {
            componentList[iconName] = <Icon name={iconName} size='m' />
            return componentList
          },
          {} as Record<string, JSX.Element>,
        ),
        undefined: undefined,
      },
      control: { type: 'select' },
    },
  },
}

export default meta

type Story = StoryObj<typeof Notification>

export const Default: Story = {
  args: {
    title: 'Your transcripts are on their way!',
    children: 'Click here to monitor your progress or to cancel this job',
    icon: <Icon name='check' />,
  },
}
