import {Select} from '@mantine/core';
import type {Meta, StoryObj} from '@storybook/react';

/**
 * Mantine [Select](https://mantine.dev/core/select/) component stories.
 * See detailed uses in [Mantine's Select page](https://mantine.dev/core/select/)
 */
const meta: Meta<typeof Select> = {
  title: 'Mantine/Select',
  component: Select,
};

const data = [
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

type Story = StoryObj<typeof Select>;

/**
 * Basic usage of Select component
 */
export const Basic: Story = {
  args: {
    label: 'Select',
    placeholder: 'Pick one',
    data,
    clearable: false,
    searchable: false,
  },
};

/**
 * Clear button is added to the right side of the input when an option is selected
 */
export const Clearable: Story = {
  args: {
    label: 'Select',
    placeholder: 'Pick one',
    clearable: true,
    data,
  },
};

/**
 * Items are filtered by the input when typing the value. Custom icon can be added to the `leftSection` property
 */
export const Searchable: Story = {
  args: {
    label: 'Select',
    placeholder: 'Pick one',
    searchable: true,
    data,
    leftSection: <i className='k-icon k-icon-search' />,
  },
};

export default meta;
