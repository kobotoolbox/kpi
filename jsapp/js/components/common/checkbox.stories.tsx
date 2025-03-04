import React from 'react'

import type { ComponentMeta, ComponentStory } from '@storybook/react'
import Checkbox from './checkbox'

export default {
  title: 'common/Checkbox',
  component: Checkbox,
  argTypes: {},
} as ComponentMeta<typeof Checkbox>

const Template: ComponentStory<typeof Checkbox> = (args) => <Checkbox {...args} onChange={() => {}} />

export const Primary = Template.bind({})
Primary.args = {
  label: 'I approve',
}
