import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { getApiV2AssetsRetrieveResponseMock } from '#/api/react-query/manage-projects-and-library-content'
import { createFormMediaItem, formMediaHandlers } from '#/endpoints/formMedia.mocks'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import FormMedia from './index'

const mockAsset = getApiV2AssetsRetrieveResponseMock({
  uid: 'form-media-story-uid',
  deployment__active: false,
})

const meta: Meta<typeof FormMedia> = {
  title: 'Features/FormMedia',
  component: FormMedia,
  decorators: [queryClientDecorator],
  args: {
    asset: mockAsset,
  },
  parameters: {
    msw: {
      // Seed with one existing file so the first test step can verify loading.
      handlers: formMediaHandlers(mockAsset.uid, [
        createFormMediaItem(1, {
          uid: 'form-media-1',
          url: `/api/v2/assets/${mockAsset.uid}/files/form-media-1/`,
          asset: `/api/v2/assets/${mockAsset.uid}/`,
          metadata: {
            hash: 'hash-1',
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
        // Count media rows via their delete buttons to avoid matching unrelated
        // links (for example helper links rendered elsewhere in the component).
        // One seeded item + one newly added item = 2 delete buttons.
        const deleteButtons = canvas.getAllByRole('button', { name: 'Delete file' })
        await expect(deleteButtons.length).toBe(2)
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

export const MultiFileUploadKeepsSpinner: Story = {
  parameters: {
    msw: {
      // Delay the second file on purpose to reproduce the original bug shape:
      // first file appears quickly, second one keeps uploading for longer.
      handlers: formMediaHandlers(mockAsset.uid, [], {
        uploadDelayByFilenameMs: {
          'fast.csv': 100,
          'slow.csv': 1200,
        },
      }),
    },
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)

    await step('Uploads two files with different completion times', async () => {
      // react-dropzone renders a native file input under the hood, so we can
      // use it directly in tests with `userEvent.upload`.
      const fileInput = canvasElement.querySelector('input[type="file"]') as HTMLInputElement | null
      await expect(fileInput).not.toBeNull()

      const fastFile = new File(['fast file'], 'fast.csv', { type: 'text/csv' })
      const slowFile = new File(['slow file'], 'slow.csv', { type: 'text/csv' })
      await userEvent.upload(fileInput as HTMLInputElement, [fastFile, slowFile])

      await waitFor(async () => {
        await expect(canvas.getByText('Uploading file…')).toBeInTheDocument()
      })
    })

    await step('Keeps spinner visible after first file appears', async () => {
      await waitFor(async () => {
        await expect(canvas.getByRole('link', { name: 'fast.csv' })).toBeInTheDocument()
      })

      await expect(canvas.getByText('Uploading file…')).toBeInTheDocument()
    })

    await step('Hides spinner only after all uploads finish', async () => {
      await waitFor(
        async () => {
          await expect(canvas.getByRole('link', { name: 'slow.csv' })).toBeInTheDocument()
        },
        // Deliberately longer than default because this story simulates a
        // slower second upload.
        { timeout: 4000 },
      )

      await waitFor(
        async () => {
          await expect(canvas.queryByText('Uploading file…')).not.toBeInTheDocument()
        },
        { timeout: 4000 },
      )
    })
  },
}
