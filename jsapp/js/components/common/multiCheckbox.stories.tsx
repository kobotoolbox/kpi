import React from 'react';
import type {ComponentStory, ComponentMeta} from '@storybook/react';
import MultiCheckbox from './multiCheckbox';

const RANDOM_LABELS = [
  'I suspect my neighbour is a reptilian',
  'I do not suspect my neighbour is not a legendary living fossil',
  "I don't accept any terms.",
  'I have read the terms',
  'I confirm I am not lying about the above',
  'Please take all my sensitive data',
  'I am a human being',
  'I am not a human',
  'This is fun',
  'I hereby authorize this design system to everything',
  "No, I don't want your newsletter",
  'Is this it?',
  'Foo bar fum baz',
];

const getRandomItem = () => ({
  label: RANDOM_LABELS[Math.floor(Math.random() * RANDOM_LABELS.length)],
  checked: false,
});

export default {
  title: 'common/MultiCheckbox',
  component: MultiCheckbox,
  argTypes: {},
  args: {
    allChecked: false,
    numberOfItems: 3,
  }
} as ComponentMeta<typeof MultiCheckbox>;

const Template: ComponentStory<typeof MultiCheckbox> = (args: any) => {
  const items = Array.from({length: args.numberOfItems}, () => getRandomItem());
  if (args.allChecked) {
    items.map((item => item.checked = true))
  }
  return <MultiCheckbox {...args} items={items} />;
};
export const Primary = Template.bind({});
Primary.args = {
  type: 'bare',
};
