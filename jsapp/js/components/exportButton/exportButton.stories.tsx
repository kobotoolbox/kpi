import type {Meta, StoryFn} from '@storybook/react';

import ExportButton from './exportButton.component';

import buttonStory from '../common/button.stories';

export default {
  title: 'misc/ExportButton',
  component: ExportButton,
  argTypes: {
    label: buttonStory.argTypes?.label,
    type: buttonStory.argTypes?.type,
    size: buttonStory.argTypes?.size,
    tooltip: buttonStory.argTypes?.tooltip,
    tooltipPosition: buttonStory.argTypes?.tooltipPosition,
    isDisabled: buttonStory.argTypes?.isDisabled,
    isFullWidth: buttonStory.argTypes?.isFullWidth,
  },
} as Meta<typeof ExportButton>;

const Template: StoryFn<typeof ExportButton> = (args) => (
  <ExportButton {...args} />
);

export const Primary = Template.bind({});
Primary.args = {
  label: 'Export all data',
  exportFunction: () => new Promise((resolve) => setTimeout(resolve, 500)),
};
