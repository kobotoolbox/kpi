import React from 'react';
import type {ComponentStory, ComponentMeta} from '@storybook/react';
import LanguageSelector from './languageSelector';

export default {
  title: 'common/LanguageSelector',
  component: LanguageSelector,
  argTypes: {},
} as ComponentMeta<typeof LanguageSelector>;

const Template: ComponentStory<typeof LanguageSelector> = (args) => (
  <LanguageSelector {...args} />
);

export const Primary = Template.bind({});
Primary.args = {
  suggestedLanguages: undefined,
  sourceLanguage: undefined,
  isDisabled: false,
};
