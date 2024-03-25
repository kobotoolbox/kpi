import React from 'react';
import type {ComponentStory, ComponentMeta} from '@storybook/react';
import LoadingSpinner from './loadingSpinner';
import type {LoadingSpinnerType} from './loadingSpinner';

const spinnerTypes: LoadingSpinnerType[] = ['regular', 'big'];

export default {
  title: 'common/LoadingSpinner',
  component: LoadingSpinner,
  argTypes: {
    type: {
      description: 'Type of LoadingSpinner',
      options: spinnerTypes,
      control: 'radio',
    },
    message: {
      description:
        'Displayed underneath the animating spinner. If custom message is not provided, default message will be displayed.',
      control: 'text',
    },
    hideMessage: {
      description: 'Hides the message (both custom and deafault)',
      control: 'boolean',
    },
  },
} as ComponentMeta<typeof LoadingSpinner>;

const Template: ComponentStory<typeof LoadingSpinner> = (args) => (
  <LoadingSpinner {...args} />
);

export const Regular = Template.bind({});
Regular.args = {
  type: 'regular',
  message: 'To infinity and beyond…',
};

export const Big = Template.bind({});
Big.args = {
  type: 'big',
  message: 'Working on it…',
};
