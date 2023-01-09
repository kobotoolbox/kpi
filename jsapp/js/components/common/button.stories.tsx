import React from 'react';
import type {ComponentStory, ComponentMeta} from '@storybook/react';
import Button from './button';

export default {
  title: 'common/Button',
  component: Button,
  argTypes: {},
} as ComponentMeta<typeof Button>;

const Template: ComponentStory<typeof Button> = (args) => <Button {...args} />;

export const Primary = Template.bind({});
Primary.args = {
  type: 'full',
  color: 'blue',
  size: 'l',
  label: 'click me',
};
