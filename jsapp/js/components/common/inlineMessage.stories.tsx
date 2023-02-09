import React from 'react';
import {ComponentStory, ComponentMeta} from '@storybook/react';
import InlineMessage from 'js/components/common/inlineMessage';

export default {
  title: 'common/Inline Message',
  component: InlineMessage,
  argTypes: {},
} as ComponentMeta<typeof InlineMessage>;

const Template: ComponentStory<typeof InlineMessage> = (args) => (
  <InlineMessage {...args} />
);

export const Primary = Template.bind({});
Primary.args = {
  type: 'default',
  message:
    'If debugging is the process of removing software bugs, then programming must be the process of putting them in.',
};
