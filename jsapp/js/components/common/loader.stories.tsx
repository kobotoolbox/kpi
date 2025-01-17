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
    size: {
      description: 'Select size',
      options: ['sm', 'md', 'lg'],
      control: 'radio',
    },
  },
  args: {
    size: 'md',
  },
};

type Story = StoryObj<typeof Loader>;

/**
 * Basic usage of Loader component
 */
export const Basic: Story = {};


export default meta;
