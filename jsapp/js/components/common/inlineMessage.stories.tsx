import React from 'react';
import {ComponentStory, ComponentMeta} from '@storybook/react';
import InlineMessage from 'js/components/common/inlineMessage';

export default {
  title: 'commonDeprecated/Inline Message',
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

export function Demo() {
  const message = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam"
  return (
    <div>
      <InlineMessage type='default' message={message}/>
      <InlineMessage icon='alert' type='default' message={message}/>
      <InlineMessage icon='alert' type='error' message={message}/>
      <InlineMessage icon='alert' type='info' message={message}/>
      <InlineMessage icon='alert' type='success' message={message}/>
      <InlineMessage icon='alert' type='warning' message={message}/>
    </div>
  );
}
