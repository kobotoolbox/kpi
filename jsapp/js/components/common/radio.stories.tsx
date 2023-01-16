import React from 'react';
import type {ComponentStory, ComponentMeta} from '@storybook/react';
import Radio from './radio';
import type {RadioOption} from './radio';

const defaultOptions: RadioOption[] = [
  {
    label: 'Pizza',
    value: 'pizza',
  },
  {
    label: 'Peanut butter and jelly sandwich',
    value: 'pbj_sandwich',
  },
  {
    label: 'Apple pie',
    value: 'apple_pie',
    isDisabled: true,
  },
  {
    label: 'Banana',
    value: 'banana',
  },
];

export default {
  title: 'common/Radio',
  component: Radio,
  argTypes: {},
} as ComponentMeta<typeof Radio>;

const Template: ComponentStory<typeof Radio> = (args) => (
  <Radio {...args} options={defaultOptions} />
);

export const Primary = Template.bind({});
Primary.args = {title: 'Pick your favourite food'};
