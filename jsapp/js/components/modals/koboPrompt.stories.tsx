import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { IconNames } from '#/k-icons'
import KoboPrompt from './koboPrompt'

const meta: Meta<typeof KoboPrompt> = {
  title: 'Design system old/KoboPrompt',
  component: KoboPrompt,
  argTypes: {
    titleIcon: {
      options: Object.keys(IconNames),
      control: { type: 'select' },
    },
  },
  parameters: { a11y: { test: 'todo' } },
}

export default meta

type Story = StoryObj<typeof KoboPrompt>

export const Primary: Story = {
  args: {
    title: 'Have a nice day!',
    titleIcon: IconNames.information,
    titleIconColor: 'blue',
    isOpen: true,
    buttons: [
      {
        type: 'primary',
        label: 'ok, thanks',
        onClick: () => {},
      },
    ],
  },
  render: (args) => <KoboPrompt {...args}>This is just some basic prompt example with single button.</KoboPrompt>,
}
