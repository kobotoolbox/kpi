import React from 'react'

import type { StoryObj } from '@storybook/react-webpack5'
import DiffValue from '#/components/common/diffValue.component'

export default {
  title: 'Design system old/DiffValue',
  component: DiffValue,
}

export const Primary: StoryObj<typeof DiffValue> = {
  args: {
    before: 'The document movie is about the weird production of Fitzcarraldo bu Werner Herzog made in 1982.',
    after:
      "The film is a making-of documentary about the chaotic production of Werner Herzog's 1982 film Fitzcarraldo.",
  },
}
