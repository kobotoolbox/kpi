import type { Meta, StoryObj } from '@storybook/react'
import { IconNames } from '#/k-icons'
import Badge from './badge'
import type { BadgeColor, BadgeSize } from './badge'

const badgeColors: BadgeColor[] = ['light-storm', 'light-amber', 'light-blue', 'light-red', 'light-teal', 'light-green']
const badgeSizes: BadgeSize[] = ['s', 'm', 'l']

const meta: Meta<typeof Badge> = {
  title: 'Design system old/Badge',
  component: Badge,
  argTypes: {
    color: {
      options: badgeColors,
      control: { type: 'select' },
    },
    size: {
      options: badgeSizes,
      control: { type: 'select' },
    },
    icon: {
      options: Object.keys(IconNames),
      control: { type: 'select' },
    },
  },
}

export default meta

type Story = StoryObj<typeof Badge>

export const Primary: Story = {
  args: {
    color: badgeColors[0],
    label: 'deployed',
    size: badgeSizes[0],
    icon: IconNames['project-deployed'],
  },
}
