import {Center, Loader} from '@mantine/core';
import type {Meta, StoryObj} from '@storybook/react';

/**
 * Mantine [Loader](https://mantine.dev/core/loader/) component stories.
 */
const meta: Meta<typeof Loader> = {
  title: 'Common/Loader',
  component: Loader,
  decorators: [
    (Story) => (
      <Center w='400' p='md'>
        <Story />
      </Center>
    ),
  ],
  argTypes: {
    type: {
      description: 'Select loader type',
      options: ['regular', 'big'],
      control: 'radio',
    },
  },
};

type Story = StoryObj<typeof Loader>;

/**
 * Regular variant
 */
export const Regular: Story = {
  args: {
    type: 'regular',
  },
};

/**
 * Big variant
 */
export const Big: Story = {
  args: {
    type: 'big',
  },
};

export default meta;
