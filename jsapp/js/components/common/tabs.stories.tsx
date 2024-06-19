import React from 'react';
import type {Story, Meta} from '@storybook/react';
import type {TabsProps} from './tabs';
import Tabs from './tabs';

export default {
  title: 'Common/Tabs',
  component: Tabs,
  description: 'This is a component that provides a top tab navigation menu.',
  argTypes: {
    tabs: {
      description:
        'Array of tab objects which contain strings defining the label and route',
    },
    selectedTab: {
      description: 'Defines the active tab for navigation and styling purposes',
      control: 'text',
    },
    onChange: {
      description: 'Tab change callback ',
    },
  },
} as Meta;

const tabsData = [
  {label: 'Tab 1', route: '/tab1'},
  {label: 'Tab 2', route: '/tab2'},
  {label: 'Tab 3', route: '/tab3'},
];

const Template: Story<TabsProps> = (args) => <Tabs {...args} />;

export const Default = Template.bind({});
Default.args = {
  tabs: tabsData,
  selectedTab: '/tab1',
};

export const SelectedTab2 = Template.bind({});
SelectedTab2.args = {
  ...Default.args,
  selectedTab: '/tab2',
};
