import React from 'react';
import {ComponentStory, ComponentMeta} from '@storybook/react';
import Checkbox from 'js/components/common/checkbox';

export default {
  title: 'common/Checkbox',
  component: Checkbox,
  argTypes: {},
} as ComponentMeta<typeof Checkbox>;

const Template: ComponentStory<typeof Checkbox> = (args) => (
  <Checkbox {...args} />
);

export const Primary = Template.bind({});
Primary.args = {
  label: 'I approve',
};
