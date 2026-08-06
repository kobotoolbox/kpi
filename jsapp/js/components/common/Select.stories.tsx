import { type MantineSize, Stack } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import Select from './Select'

const sizes: MantineSize[] = ['xs', 'sm', 'md', 'lg', 'xl']

const data = [
  { label: 'Apple', value: '1' },
  { label: 'Banana', value: '2' },
  { label: 'Cherry', value: '3' },
  { label: 'Grape', value: '7' },
  { label: 'Lemon', value: '12' },
]

const largeData = [
  { label: 'Apple', value: '1' },
  { label: 'Banana', value: '2' },
  { label: 'Cherry', value: '3' },
  { label: 'Date', value: '4' },
  { label: 'Elderberry', value: '5' },
  { label: 'Fig', value: '6' },
  { label: 'Grape', value: '7' },
  { label: 'Honeydew', value: '8' },
  { label: 'Indian Fig', value: '9' },
  { label: 'Jackfruit', value: '10' },
  { label: 'Kiwi', value: '11' },
  { label: 'Lemon', value: '12' },
  { label: 'Mango', value: '13' },
  { label: 'Nectarine', value: '14' },
  { label: 'Orange', value: '15' },
  { label: 'Papaya', value: '16' },
  { label: 'Quince', value: '17' },
]

/**
 * Mantine [Select](https://mantine.dev/core/select/) component stories.
 * See detailed uses in [Mantine's Select page](https://mantine.dev/core/select/)
 */
const meta: Meta<typeof Select> = {
  title: 'Design system/Select',
  component: Select,
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 400, padding: 40, margin: 'auto' }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    controls: { expanded: false },
  },
  argTypes: {
    label: {
      description: 'Select label',
      control: { type: 'text' },
    },
    placeholder: {
      description: 'Placeholder for the input',
      control: { type: 'text' },
    },
    size: {
      description: 'Select size',
      options: sizes,
      control: { type: 'select' },
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
      control: { type: 'object' },
    },
  },
  args: {
    label: 'Select',
    placeholder: 'Pick one',
    size: 'md',
    clearable: false,
    searchable: true,
    data,
  },
}

type Story = StoryObj<typeof Select>

/**
 * Basic usage of Select component
 */
export const Basic: Story = {}

/**
 * Different sizes of the Select component
 */
export const Sizes = () => (
  <Stack gap='md'>
    {sizes.map((size) => (
      <Select key={size} label={size} placeholder='Pick one' data={data} size={size} />
    ))}
  </Stack>
)

/**
 * Clear button is added to the right side of the input when an option is selected
 */
export const Clearable: Story = {
  args: {
    clearable: true,
    value: data[3].value,
  },
  parameters: { a11y: { disable: true } },
}

/**
 * Items are filtered by the input when typing the value. Custom icon can be added to the `leftSection` property
 */
export const Searchable: Story = {
  args: {
    searchable: true,
  },
}

/**
 * Select with large data set and scrollable dropdown
 */
export const Scrollable: Story = {
  args: {
    data: largeData,
  },
}

/** Label of the currently highlighted option. */
const getHighlighted = (canvasElement: HTMLElement) =>
  canvasElement.ownerDocument.querySelector('[data-combobox-selected]')?.textContent

/**
 * `PageUp`, `PageDown`, `Home` and `End` move through the options, same as a
 * native `<select>`. Mantine doesn't handle these keys, we add them ourselves.
 */
export const KeyboardNavigation: Story = {
  args: {
    data: largeData,
    searchable: true,
    // Storybook auto-spies on* props (see argTypesRegex in .storybook/preview.tsx)
    // and errors if a play function triggers one of those implicit spies. Our
    // wrapper forwards both of these, so pass real spies instead.
    onKeyDown: fn(),
    onChange: fn(),
  },
  parameters: { a11y: { disable: true } },
  play: async ({ canvasElement, step }) => {
    const input = within(canvasElement).getByRole('textbox')

    await step('End jumps to the last option', async () => {
      await userEvent.click(input)
      await userEvent.keyboard('{End}')
      await waitFor(() => expect(getHighlighted(canvasElement)).toBe('Quince'))
    })

    await step('Home jumps back to the first option', async () => {
      await userEvent.keyboard('{Home}')
      await waitFor(() => expect(getHighlighted(canvasElement)).toBe('Apple'))
    })

    await step('PageDown moves down by a visible page, without wrapping past the end', async () => {
      await userEvent.keyboard('{PageDown}')
      const afterFirstPage = getHighlighted(canvasElement)
      // Page size comes from the dropdown's height, so we check that it moved
      // down the list rather than expecting one particular option.
      expect(afterFirstPage).not.toBe('Apple')
      expect(largeData.findIndex((item) => item.label === afterFirstPage)).toBeGreaterThan(0)

      // Keep paging: it should stop at the last option, not wrap to the top.
      for (let i = 0; i < largeData.length; i++) {
        await userEvent.keyboard('{PageDown}')
      }
      await waitFor(() => expect(getHighlighted(canvasElement)).toBe('Quince'))
    })

    await step('PageUp clamps at the first option', async () => {
      for (let i = 0; i < largeData.length; i++) {
        await userEvent.keyboard('{PageUp}')
      }
      await waitFor(() => expect(getHighlighted(canvasElement)).toBe('Apple'))
    })

    await step('Enter submits the highlighted option', async () => {
      await userEvent.keyboard('{End}')
      await waitFor(() => expect(getHighlighted(canvasElement)).toBe('Quince'))
      await userEvent.keyboard('{Enter}')
      await waitFor(() => expect(input).toHaveValue('Quince'))
    })
  },
}

export default meta
