import type { Meta, StoryObj } from '@storybook/react'
import LoadingSpinner from './loadingSpinner'
import type { LoadingSpinnerType } from './loadingSpinner'

const spinnerTypes: LoadingSpinnerType[] = ['regular', 'big']

const meta: Meta<typeof LoadingSpinner> = {
  title: 'Design system old/LoadingSpinner',
  component: LoadingSpinner,
  argTypes: {
    type: {
      description: 'Type of LoadingSpinner',
      options: spinnerTypes,
      control: 'radio',
    },
    message: {
      options: [
        undefined,
        false,
        'Please wait things are coming…',
        'Please wait until this process finishes, as there are a lot of things going on in the background. But since you started reading this, most probably the whole thing have already finished…',
      ],
      description:
        'Displayed underneath the animating spinner. If custom message is not provided, default message will be displayed. If `false` is passed, message will not be displayed.',
      control: 'select',
    },
  },
}

export default meta

type Story = StoryObj<typeof LoadingSpinner>

export const Regular: Story = {
  args: {
    type: 'regular',
    message: 'To infinity and beyond…',
  },
}

export const Big: Story = {
  args: {
    type: 'big',
    message: 'Working on it…',
  },
}
