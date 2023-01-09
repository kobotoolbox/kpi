import React from 'react';
import type {ComponentStory, ComponentMeta} from '@storybook/react';
import KoboRange, {KoboRangeColors} from 'js/components/common/koboRange';

export default {
  title: 'common/KoboRange',
  component: KoboRange,
  argTypes: {
    color: {
      options: KoboRangeColors,
      control: {type: 'select'},
    },
  },
} as ComponentMeta<typeof KoboRange>;

const Template: ComponentStory<typeof KoboRange> = (args) => (
  <KoboRange {...args} />
);

export const Primary = Template.bind({});
Primary.args = {
  color: KoboRangeColors.default,
  totalLabel: '',
  currentLabel: '',
  max: 10,
  value: 4,
  isTime: false,
  isDisabled: false
};
