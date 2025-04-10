import React from 'react'

import type { StoryObj } from '@storybook/react'
import AriaText from '#/components/common/ariaText'

export default {
  component: AriaText,
  title: 'Design system old/AriaText',
  tags: ['autodocs'],
}

type Story = StoryObj<typeof AriaText>

export const Primary: Story = {
  args: {
    uiText: 'This text is invisible to screen readers',
    screenReaderText: 'this text only shows up for screen readers',
  },
}
