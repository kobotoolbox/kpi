import React from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import KoboPrompt from './koboPrompt'
import { IconNames } from 'jsapp/fonts/k-icons'

const meta: Meta<typeof KoboPrompt> = {
  title: 'common/KoboPrompt',
  component: KoboPrompt,
  argTypes: {
    titleIcon: {
      options: Object.keys(IconNames),
      control: { type: 'select' },
    },
  },
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
