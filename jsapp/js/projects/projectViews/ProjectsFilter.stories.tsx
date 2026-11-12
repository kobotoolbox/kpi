import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import ProjectsFilter from './ProjectsFilter'

const meta: Meta<typeof ProjectsFilter> = {
  title: 'Features/ProjectsFilter',
  component: ProjectsFilter,
  args: {
    filters: [],
    onFiltersChange: fn(),
  },
  // TODO: improve our button - `light` variant text fails AA contrast
  parameters: { a11y: { disable: true } },
}

type Story = StoryObj<typeof ProjectsFilter>

export const Empty: Story = {}

export const WithFilters: Story = {
  args: {
    filters: [
      { fieldName: 'name', condition: 'contains', value: 'health' },
      { fieldName: 'description', condition: 'isEmpty' },
    ],
  },
}

/** Form itself is covered by `ProjectsFilterForm` stories. */
export const ResetClosesModal: Story = {
  args: WithFilters.args,
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /filter/i }))

    // The modal renders in a portal
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(await body.findByRole('button', { name: 'Reset' }))

    await expect(args.onFiltersChange).toHaveBeenCalledWith([])
    await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument())
  },
}

export const CloseDropsUnappliedEdits: Story = {
  args: WithFilters.args,
  play: async ({ args, canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: /filter/i })
    const body = within(canvasElement.ownerDocument.body)

    await userEvent.click(trigger)
    await userEvent.click((await body.findAllByRole('button', { name: 'Delete' }))[0])
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument())

    await userEvent.click(trigger)
    await waitFor(() => expect(body.getAllByRole('button', { name: 'Delete' })).toHaveLength(2))
    await expect(args.onFiltersChange).not.toHaveBeenCalled()
  },
}

export default meta
