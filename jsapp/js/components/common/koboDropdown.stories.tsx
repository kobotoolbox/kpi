import type { Meta, StoryObj } from '@storybook/react'
import KoboDropdown from '#/components/common/koboDropdown'

const meta: Meta<typeof KoboDropdown> = {
  title: 'Design system old/KoboDropdown',
  component: KoboDropdown,
  argTypes: {
    placement: {
      options: ['down-center', 'down-left', 'down-right', 'up-center', 'up-left', 'up-right'],
      control: { type: 'select' },
    },
    isDisabled: {
      control: 'boolean',
    },
  },
}

export default meta

type Story = StoryObj<typeof KoboDropdown>

export const Default: Story = {
  args: {
    name: 'kobo-dropdown-demo',
    placement: 'down-center',
    triggerContent: 'click me',
    menuContent: (
      <ol>
        <li>Some menu</li>
        <li>Content is</li>
        <li>Here, and</li>
        <li>Says: hi</li>
      </ol>
    ),
  },
}
