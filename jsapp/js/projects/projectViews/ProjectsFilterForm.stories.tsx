import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { seedEnvStore } from '#/envStore.mocks'
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
  // Editor reads env choices on render, so wait for them
  beforeEach: seedEnvStore({}),
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
      { fieldName: 'status', condition: 'is', value: ['deployed', 'draft', 'archived'] },
      // Saved before status became a multiselect
      { fieldName: 'status', condition: 'isNot', value: 'draft' },
      { fieldName: 'sector', condition: 'contains', value: ['Environment', 'Information / Media'] },
      // Saved before country became a multiselect
      { fieldName: 'countries', condition: 'is', value: 'POL' },
    ],
  },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('Poland')).toBeInTheDocument()
  },
}

/** Opens a dropdown by its placeholder and clicks given options. */
const pickOptions = async (canvasElement: HTMLElement, placeholder: string, ...optionNames: string[]) => {
  await userEvent.click(within(canvasElement).getByPlaceholderText(placeholder))
  // Select dropdowns render in a portal
  const body = within(canvasElement.ownerDocument.body)
  for (const name of optionNames) {
    await userEvent.click(await body.findByRole('option', { name }))
  }
}

export const ApplyNewFilter: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await pickOptions(canvasElement, 'Select field', 'Project name')
    await pickOptions(canvasElement, 'Select condition', 'Contains')
    await userEvent.type(canvas.getByPlaceholderText('Enter value'), 'health')
    await userEvent.click(canvas.getByRole('button', { name: 'Apply' }))

    await expect(args.onApply).toHaveBeenCalledWith([{ fieldName: 'name', condition: 'contains', value: 'health' }])
  },
}

export const ApplyManyStatuses: Story = {
  play: async ({ args, canvasElement }) => {
    await pickOptions(canvasElement, 'Select field', 'Status')
    await pickOptions(canvasElement, 'Select condition', 'Is')
    await pickOptions(canvasElement, 'Select values', 'Deployed', 'Draft')
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Apply' }))

    await expect(args.onApply).toHaveBeenCalledWith([
      { fieldName: 'status', condition: 'is', value: ['deployed', 'draft'] },
    ])
  },
}

export const ApplyManyCountries: Story = {
  play: async ({ args, canvasElement }) => {
    await pickOptions(canvasElement, 'Select field', 'Countries')
    await pickOptions(canvasElement, 'Select condition', 'Contains')
    await pickOptions(canvasElement, 'Select values', 'Albania')
    // Long list, so search it
    await userEvent.keyboard('pola')
    await userEvent.click(await within(canvasElement.ownerDocument.body).findByRole('option', { name: 'Poland' }))
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Apply' }))

    await expect(args.onApply).toHaveBeenCalledWith([
      { fieldName: 'countries', condition: 'contains', value: ['ALB', 'POL'] },
    ])
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
