import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import ProjectsFilter from './projectsFilter'

const meta: Meta<typeof ProjectsFilter> = {
  title: 'Features/ProjectsFilter',
  component: ProjectsFilter,
  args: {
    filters: [],
    onFiltersChange: fn(),
  },
}

type Story = StoryObj<typeof ProjectsFilter>

export const Empty: Story = {}

export const EachValueInput: Story = {
  args: {
    filters: [
      { fieldName: 'name', condition: 'contains', value: 'health' },
      { fieldName: 'description', condition: 'isEmpty' },
      { fieldName: 'status', condition: 'is', value: ['deployed', 'draft', 'archived'] },
      // Saved before status became a multiselect
      { fieldName: 'status', condition: 'isNot', value: 'draft' },
    ],
  },
}

export const PickManyStatuses: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /filter/i }))

    // The modal and dropdowns render in portals
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(await body.findByPlaceholderText('Select field'))
    await userEvent.click(await body.findByRole('option', { name: 'Status' }))
    await userEvent.click(body.getByPlaceholderText('Select condition'))
    await userEvent.click(await body.findByRole('option', { name: 'Is' }))
    await userEvent.click(body.getByPlaceholderText('Select values'))
    await userEvent.click(await body.findByRole('option', { name: 'Deployed' }))
    await userEvent.click(await body.findByRole('option', { name: 'Draft' }))
    await userEvent.click(body.getByRole('button', { name: 'Apply' }))

    await waitFor(() =>
      expect(args.onFiltersChange).toHaveBeenCalledWith([
        { fieldName: 'status', condition: 'is', value: ['deployed', 'draft'] },
      ]),
    )
  },
}

export default meta
