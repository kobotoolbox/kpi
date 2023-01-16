import React from 'react';
import type {ComponentStory, ComponentMeta} from '@storybook/react';
import TextBox from './textBox';

export default {
  title: 'common/TextBox',
  component: TextBox,
  argTypes: {},
} as ComponentMeta<typeof TextBox>;

const Template: ComponentStory<typeof TextBox> = (args) => (
  <TextBox {...args} />
);

export const Primary = Template.bind({});
Primary.args = {
  type: 'text',
  errors: '',
  label: 'Your real name',
  description: 'We need your first and last name only.',
  placeholder: 'Type your name...',
  readOnly: false,
  disabled: false,
};

export const WithErrors = Template.bind({});
WithErrors.args = {
  label: 'Well done.',
  description: 'Here are the test results',
  placeholder: "We weren't even testing for that",
  errors: [
    'Horrible person',
    "I'm serious, that's what it says: 'A horrible person.'",
  ],
};
