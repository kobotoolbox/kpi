import React from 'react';
import type {ComponentStory, ComponentMeta} from '@storybook/react';
import Icon from './icon';
import {IconNames} from 'jsapp/fonts/k-icons';
import type {IconColor} from './icon';

const iconColors: Array<IconColor | undefined> = [
  undefined,
  'mid-red',
  'storm',
  'teal',
  'amber',
  'blue',
];
export default {
  title: 'common/Icon',
  component: Icon,
  argTypes: {
    color: {
      options: iconColors,
      control: {type: 'select'},
    },
  },
} as ComponentMeta<typeof Icon>;

const Template: ComponentStory<typeof Icon> = (args) => <Icon {...args} />;

export const Primary = Template.bind({});
Primary.args = {color: iconColors[0]};

export const AllIcons = () => (
  <div style={{display: 'flex', flexWrap: 'wrap'}}>
    {(Object.keys(IconNames) as Array<keyof typeof IconNames>).map((icon) => (
      <div style={{flex: '1 1 200px'}}>
        <Icon name={icon} size='l' />
        {icon}
      </div>
    ))}
  </div>
);
