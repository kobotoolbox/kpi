import React from 'react';
import type {ComponentStory, ComponentMeta} from '@storybook/react';
import MiniAudioPlayer from './miniAudioPlayer';

export default {
  title: 'common/MiniAudioPlayer',
  component: MiniAudioPlayer,
  argTypes: {},
} as ComponentMeta<typeof MiniAudioPlayer>;

const Template: ComponentStory<typeof MiniAudioPlayer> = (args) => (
  <MiniAudioPlayer {...args} />
);

export const Primary = Template.bind({});
Primary.args = {
  mediaURL: 'https://ia800304.us.archive.org/20/items/OTRR_Gunsmoke_Singles/Gunsmoke%2052-04-26%20%28001%29%20Billy%20the%20Kid.mp3',
  preload: false
};
