import type { Meta, StoryObj } from '@storybook/react'
import { IconNames } from '#/k-icons'
import Icon from './icon'
import type { IconColor } from './icon'

const iconColors: Array<IconColor | undefined> = [undefined, 'mid-red', 'storm', 'teal', 'amber', 'blue']

const meta: Meta<typeof Icon> = {
  title: 'Design system old/Icon',
  component: Icon,
  argTypes: {
    color: {
      options: iconColors,
      control: { type: 'select' },
    },
    name: {
      options: Object.keys(IconNames),
      control: { type: 'select' },
    },
  },
}

export default meta

type Story = StoryObj<typeof Icon>

export const Primary: Story = {
  args: { color: iconColors[0], name: IconNames['skip-logic'] },
}

export const AllIcons: Story = {
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
      {(Object.keys(IconNames) as Array<keyof typeof IconNames>).map((iconName) => (
        <div key={iconName} style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Icon name={iconName} size='l' />
          {iconName}
        </div>
      ))}
    </div>
  ),
}
