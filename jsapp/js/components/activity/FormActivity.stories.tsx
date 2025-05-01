import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, waitFor, within } from '@storybook/test'
import { reactRouterParameters, withRouter } from 'storybook-addon-remix-react-router'
import assetHistoryMock, { mockAssetUid } from '#/endpoints/assetHistory.mock'
import assetHistoryActionsMock from '#/endpoints/assetHistoryActions.mock'
import { queryClientDecorator } from '#/query/queryClient.mock'
import { ROUTES } from '#/router/routerConstants'
import FormActivity from './FormActivity'

const meta: Meta<typeof FormActivity> = {
  title: 'Features/FormActivity',
  component: FormActivity,
  argTypes: {},
  parameters: {
    msw: {
      handlers: [assetHistoryMock, assetHistoryActionsMock],
    },
    reactRouter: reactRouterParameters({
      location: {
        pathParams: { uid: mockAssetUid },
      },
      routing: { path: ROUTES.FORM_ACTIVITY },
    }),
  },
  decorators: [withRouter, queryClientDecorator],
}

export default meta
type Story = StoryObj<typeof FormActivity>

export const Default: Story = {}

export const TestFilteringByActivityType: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)

    let selectItem: HTMLElement
    let selectTriggerItem: HTMLElement
    await step('Verify that the filter select is present', async () => {
      await waitFor(async () => {
        selectItem = await canvas.findByRole('combobox')
        await expect(selectItem).toBeInTheDocument()
        selectTriggerItem = await within(selectItem).findByText('Filter by')
        await expect(selectTriggerItem).toBeInTheDocument()
      })
    })

    await step('Select the "add media attachment" filter', async () => {
      await userEvent.click(selectTriggerItem)
      await waitFor(async () => {
        const optionItem = await within(selectItem).findByText('add media attachment')
        await expect(optionItem).toBeInTheDocument()
        await userEvent.click(optionItem)
      })
    })

    await step('Verify that after applying filter the "add media attachment" action is loaded', async () => {
      await waitFor(async () => {
        const resultItem = await canvas.findByTitle('karina added a media attachment')
        await expect(resultItem).toBeInTheDocument()
      })
    })
  },
}
