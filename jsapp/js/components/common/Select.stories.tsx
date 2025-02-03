import {Stack, type MantineSize} from '@mantine/core';
import {Select} from './Select';
import type {Meta, StoryObj} from '@storybook/react';

const sizes: MantineSize[] = ['xs', 'sm', 'md', 'lg', 'xl'];

const data = [
  {label: 'Apple', value: '1'},
  {label: 'Banana', value: '2'},
  {label: 'Cherry', value: '3'},
  {label: 'Grape', value: '7'},
  {label: 'Lemon', value: '12'},
];

const largeData = [
  {label: 'Apple', value: '1'},
  {label: 'Banana', value: '2'},
  {label: 'Cherry', value: '3'},
  {label: 'Date', value: '4'},
  {label: 'Elderberry', value: '5'},
  {label: 'Fig', value: '6'},
  {label: 'Grape', value: '7'},
  {label: 'Honeydew', value: '8'},
  {label: 'Indian Fig', value: '9'},
  {label: 'Jackfruit', value: '10'},
  {label: 'Kiwi', value: '11'},
  {label: 'Lemon', value: '12'},
  {label: 'Mango', value: '13'},
  {label: 'Nectarine', value: '14'},
  {label: 'Orange', value: '15'},
  {label: 'Papaya', value: '16'},
  {label: 'Quince', value: '17'},
];

/**
 * Mantine [Select](https://mantine.dev/core/select/) component stories.
 * See detailed uses in [Mantine's Select page](https://mantine.dev/core/select/)
 */
const meta: Meta<typeof Select> = {
  title: 'Common/Select',
  component: Select,
  decorators: [
    (Story) => (
      <div style={{maxWidth: 400, padding: 40, margin: 'auto'}}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    controls: {expanded: false},
  },
  argTypes: {
    label: {
      description: 'Select label',
      control: {type: 'text'},
    },
    placeholder: {
      description: 'Placeholder for the input',
      control: {type: 'text'},
    },
    size: {
      description: 'Select size',
      options: sizes,
      control: {type: 'select'},
    },
    clearable: {
      description: 'Add clear button to the right side of the input',
      control: 'boolean',
    },
    searchable: {
      description: 'Filter items by typing',
      control: 'boolean',
    },
    data: {
      description: 'Array of objects with label and value',
      control: {type: 'object'},
    },
  },
  args: {
    label: 'Select',
    placeholder: 'Pick one',
    size: 'md',
    clearable: false,
    searchable: false,
    data,
  },
};

type Story = StoryObj<typeof Select>;

/**
 * Basic usage of Select component
 */
export const Basic: Story = {};

/**
 * Different sizes of the Select component
 */
export const Sizes = () => (
  <Stack gap='md'>
    {sizes.map((size) => (
      <Select
        key={size}
        label={size}
        placeholder='Pick one'
        data={data}
        size={size}
      />
    ))}
  </Stack>
);

/**
 * Clear button is added to the right side of the input when an option is selected
 */
export const Clearable: Story = {
  args: {
    clearable: true,
    value: data[3].value,
  },
};

/**
 * Items are filtered by the input when typing the value. Custom icon can be added to the `leftSection` property
 */
export const Searchable: Story = {
  args: {
    searchable: true,
  },
};

/**
 * Select with large data set and scrollable dropdown
 */
export const Scrollable: Story = {
  args: {
    data: largeData,
  },
};

export default meta;
