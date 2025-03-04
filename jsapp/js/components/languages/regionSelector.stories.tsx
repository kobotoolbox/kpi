import React from 'react'

import type { ComponentMeta, ComponentStory } from '@storybook/react'
import RegionSelector from './regionSelector'

export default {
  title: 'common/RegionSelector',
  component: RegionSelector,
  argTypes: {},
} as ComponentMeta<typeof RegionSelector>

const Template: ComponentStory<typeof RegionSelector> = (args) => <RegionSelector {...args} />

export const Primary = Template.bind({})
Primary.args = {
  rootLanguage: 'en',
  isDisabled: false,
}
