import {
  Button,
  Card,
  Center,
  LoadingOverlay,
  PasswordInput,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import type {Meta, StoryObj} from '@storybook/react';

/**
 * Mantine [LoadingOverlay](https://mantine.dev/core/loading-overlay/) component stories.
 *
 * Component used to display an overlay  over the sibling content containing the Loader component
 */
const meta: Meta<typeof LoadingOverlay> = {
  title: 'Common/LoadingOverlay',
  component: LoadingOverlay,
  decorators: [
    (Story) => (
      <Center w='400' p='md'>
        <Stack gap='md'>
          <Card w='300' p='md' withBorder>
            <Stack gap='md'>
              <Story />
              <Text>Sibling components...</Text>
              <TextInput label='User' placeholder='Type something...' />
              <PasswordInput label='Password' placeholder='Type something...' />
              <Button>Submit</Button>
            </Stack>
          </Card>
          <Button>Button not sibling</Button>
        </Stack>
      </Center>
    ),
  ],
  argTypes: {
    visible: {
      description: 'Controls overlay visibility',
      control: 'boolean',
    },
  },
};

type Story = StoryObj<typeof LoadingOverlay>;

/**
 * LoadingOverlay component visible
 */
export const Visible: Story = {
  args: {
    visible: true,
  },
};

/**
 * LoadingOverlay component not visible
 */
export const NotVisible: Story = {
  args: {
    visible: false,
  },
};

/**
 * Using 'big' variant
 */
export const Big: Story = {
  args: {
    visible: true,
    loaderProps: {type: 'big'},
  },
};

export default meta;
