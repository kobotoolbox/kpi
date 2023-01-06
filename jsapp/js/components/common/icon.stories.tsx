import React from 'react';
import {ComponentStory, ComponentMeta} from '@storybook/react';
import Icon from 'js/components/common/icon';
import {IconNames} from 'jsapp/fonts/k-icons';

export default {
  title: 'common/Icon',
  component: Icon,
  argTypes: {},
} as ComponentMeta<typeof Icon>;

const Template: ComponentStory<typeof Icon> = (args) => <Icon {...args} />;

export const Primary = Template.bind({});
Primary.args = {};

export const AllIcons = () => (
  <div style={{display: 'flex', flexWrap: 'wrap'}}>
    {(Object.keys(IconNames) as Array<keyof typeof IconNames>).map((icon) => (
      <div style={{flex: '1 1 200px'}}>
        <Icon name={icon} size='l'></Icon>
        {icon}
      </div>
    ))}
  </div>
);
