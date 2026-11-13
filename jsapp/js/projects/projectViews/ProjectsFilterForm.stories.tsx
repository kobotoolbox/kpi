import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import ProjectsFilterForm from './ProjectsFilterForm'

const meta: Meta<typeof ProjectsFilterForm> = {
  title: 'Features/ProjectsFilterForm',
  component: ProjectsFilterForm,
  args: {
    filters: [],
    onApply: fn(),
    onReset: fn(),
  },
  // Roughly the width it gets inside the modal
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 900 }}>
        <Story />
      </div>
    ),
  ],
  // TODO: improve our button - `light` variant text fails AA contrast
  parameters: { a11y: { config: { rules: [{ id: 'color-contrast', enabled: false }] } } },
}

type Story = StoryObj<typeof ProjectsFilterForm>

export const Empty: Story = {}

export const WithFilters: Story = {
  args: {
    filters: [
      { fieldName: 'name', condition: 'contains', value: 'health' },
      { fieldName: 'description', condition: 'isEmpty' },
      { fieldName: 'ownerUsername', condition: 'is', value: 'kobo' },
    ],
  },
}

export const ApplyNewFilter: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    // Dropdowns render in a portal
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(canvas.getByPlaceholderText('Select field'))
    await userEvent.click(await body.findByRole('option', { name: 'Project name' }))
    await userEvent.click(canvas.getByPlaceholderText('Select condition'))
    await userEvent.click(await body.findByRole('option', { name: 'Contains' }))
    await userEvent.type(canvas.getByPlaceholderText('Enter value'), 'health')
    await userEvent.click(canvas.getByRole('button', { name: 'Apply' }))

    await expect(args.onApply).toHaveBeenCalledWith([{ fieldName: 'name', condition: 'contains', value: 'health' }])
  },
}

export const DeleteAll: Story = {
  args: WithFilters.args,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    // Rows are keyed by index, so re-query after each removal
    while (canvas.queryAllByRole('button', { name: 'Delete' }).length > 0) {
      await userEvent.click(canvas.getAllByRole('button', { name: 'Delete' })[0])
    }
    await waitFor(() => expect(canvas.getByText('There are no filters, you can add one below')).toBeInTheDocument())

    await userEvent.click(canvas.getByRole('button', { name: 'Apply' }))
    await expect(args.onApply).toHaveBeenCalledWith([])
  },
}

export default meta
