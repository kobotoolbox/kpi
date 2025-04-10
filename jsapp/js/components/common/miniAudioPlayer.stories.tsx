import type { Meta, StoryObj } from '@storybook/react'
import MiniAudioPlayer from './miniAudioPlayer'

const meta: Meta<typeof MiniAudioPlayer> = {
  title: 'Design system old/MiniAudioPlayer',
  component: MiniAudioPlayer,
  argTypes: {},
}

export default meta

type Story = StoryObj<typeof MiniAudioPlayer>

export const Primary: Story = {
  args: {
    mediaURL:
      'https://ia800304.us.archive.org/20/items/OTRR_Gunsmoke_Singles/Gunsmoke%2052-04-26%20%28001%29%20Billy%20the%20Kid.mp3',
    preload: false,
  },
}
