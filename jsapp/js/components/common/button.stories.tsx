import React from 'react';
import {ComponentStory, ComponentMeta} from '@storybook/react';
import Button from 'js/components/common/button';

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
