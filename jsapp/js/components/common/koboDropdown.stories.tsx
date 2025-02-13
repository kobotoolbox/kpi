import React from 'react';
import type {ComponentStory, ComponentMeta} from '@storybook/react';
import KoboDropdown from 'js/components/common/koboDropdown';

export default {
  title: 'common/KoboDropdown',
  component: KoboDropdown,
  argTypes: {
    placement: {
      options: ['down-center', 'down-left', 'down-right', 'up-center', 'up-left', 'up-right'],
      control: {type: 'select'},
    },
    isDisabled: {
      control: 'boolean',
    },
  },
} as ComponentMeta<typeof KoboDropdown>;

const Template: ComponentStory<typeof KoboDropdown> = (args) => (
  <KoboDropdown {...args} />
);

export const Primary = Template.bind({});
Primary.args = {
  name: 'kobo-dropdown-demo',
  placement: 'down-center',
  triggerContent: 'click me',
  menuContent: (
    <ol>
      <li>Some menu</li>
      <li>Content is</li>
      <li>Here, and</li>
      <li>Says "hi"</li>
    </ol>
  ),
};
