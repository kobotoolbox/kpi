import React from 'react';
import type {ComponentStory, ComponentMeta} from '@storybook/react';
import KoboSelect from 'js/components/common/koboSelect';

export default {
  title: 'commonDeprecated/KoboSelect',
  component: KoboSelect,
  argTypes: {
    selectedOption: {
      options: [undefined, 'one', 'two', 'last'],
    },
  },
  args: {
    demoOptionsWithIcons: false,
  },
} as ComponentMeta<typeof KoboSelect>;

const Template: ComponentStory<typeof KoboSelect> = (args: any) => {
  const options = [
    {
      value: 'one',
      label: 'One',
      icon: args.demoOptionsWithIcons ? 'alert' : undefined,
    },
    {
      value: 'two',
      label: 'Two',
      icon: args.demoOptionsWithIcons ? 'qt-audio' : undefined,
    },
    {
      value: 'last',
      label: 'The last one here with a very long label',
      icon: args.demoOptionsWithIcons ? 'globe-alt' : undefined,
    },
  ];
  return <KoboSelect {...args} options={options} />;
};

export const Primary = Template.bind({});
Primary.args = {
  type: 'blue',
  size: 'm',
  isClearable: true,
  isSearchable: true,
  isDisabled: false,
  isPending: false,
};
