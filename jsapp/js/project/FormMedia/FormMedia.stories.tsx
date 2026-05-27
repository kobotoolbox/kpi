import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import assetFactory from '#/endpoints/asset.factory'
import formMediaFactory from '#/endpoints/formMedia.factory'
import { formMediaHandlers } from '#/endpoints/formMedia.mocks'
import FormMedia from './index'

const mockAsset = assetFactory({
  uid: 'form-media-story-uid',
  deployment__active: false,
})

const meta: Meta<typeof FormMedia> = {
  title: 'Features/FormMedia',
  component: FormMedia,
  args: {
    asset: mockAsset,
  },
  parameters: {
    msw: {
      // Seed with one existing file so the first test step can verify loading.
      handlers: formMediaHandlers(mockAsset.uid, [
        formMediaFactory(1, {
          uid: 'form-media-1',
          url: `/api/v2/assets/${mockAsset.uid}/files/form-media-1/`,
          metadata: {
            hash: 'hash-1',
            size: 1024,
            type: 'image/png',
            filename: 'intro-image.png',
            mimetype: 'image/png',
          },
          content: '/media/mock/intro-image.png',
        }),
      ]),
    },
    a11y: { test: 'todo' },
  },
}

export default meta

type Story = StoryObj<typeof FormMedia>

export const Default: Story = {}

export const BasicFlow: Story = {
  play: async ({ canvasElement, step }) => {
    // We scope all queries to this story canvas to avoid accidental matches
    // from other rendered stories in Docs mode.
    const canvas = within(canvasElement)

    await step('Renders existing files from API', async () => {
      await waitFor(async () => {
        await expect(canvas.getByRole('link', { name: 'intro-image.png' })).toBeInTheDocument()
      })
    })

    await step('Adds form media by URL', async () => {
      const urlInput = canvas.getByPlaceholderText('Paste URL here')
      await userEvent.type(urlInput, 'https://example.org/docs/reference.pdf')
      await userEvent.click(canvas.getByRole('button', { name: 'Add' }))

      await waitFor(async () => {
        // One seeded link + one newly created link.
        const fileLinks = canvas.getAllByRole('link')
        await expect(fileLinks.length).toBe(2)
      })
    })

    await step('Deletes one item and refreshes list', async () => {
      const deleteButtons = canvas.getAllByRole('button', { name: 'Delete file' })
      await userEvent.click(deleteButtons[0])

      await waitFor(async () => {
        // Count media rows via their delete buttons to avoid matching unrelated
        // links (for example helper links rendered elsewhere in the component).
        const remainingDeleteButtons = canvas.getAllByRole('button', { name: 'Delete file' })
        await expect(remainingDeleteButtons.length).toBe(1)
      })
    })
  },
}
