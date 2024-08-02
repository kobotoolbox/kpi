import React from 'react';
import {ComponentStory, ComponentMeta} from '@storybook/react';
import KoboPrompt from './koboPrompt';
import {IconNames} from 'jsapp/fonts/k-icons';

export default {
  title: 'common/KoboPrompt',
  component: KoboPrompt,
  argTypes: {
    titleIcon: {
      options: IconNames,
      control: {type: 'select'},
    },
  },
} as ComponentMeta<typeof KoboPrompt>;

const Template: ComponentStory<typeof KoboPrompt> = (args) => (
  <KoboPrompt {...args}>This is just some basic prompt example with single button.</KoboPrompt>
);

export const Primary = Template.bind({});
Primary.args = {
  title: 'Have a nice day!',
  titleIcon: 'information',
  titleIconColor: 'blue',
  isOpen: true,
  buttons: [
    {
      type: 'primary',
      label: 'ok, thanks',
      onClick: () => {},
    },
  ],
};
