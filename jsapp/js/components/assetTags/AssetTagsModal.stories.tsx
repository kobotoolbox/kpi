import { ModalsProvider } from '@mantine/modals'
import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { http, HttpResponse } from 'msw'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { endpoints } from '#/api.endpoints'
import ButtonNew from '#/components/common/ButtonNew'
import type { AssetResponse } from '#/dataInterface'
import assetFactory from '#/endpoints/asset.factory'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import { KOBO_MODAL_SHARED_PROPS } from '#/theme/kobo/Modal'
import { openAssetTagsModal } from './AssetTagsModal'

const mockAsset = assetFactory({
  uid: 'storyAssetTagsUid',
  name: 'Storybook Asset Tags',
  tag_string: 'alpha,beta',
})
const mockAssetUid = mockAsset.uid
let latestPatchedAsset: { uid: string; tag_string: string } | null = null

function createAssetPatchHandler() {
  latestPatchedAsset = null

  return http.patch(endpoints.ASSET_URL, async ({ params, request }) => {
    if (params.uid !== mockAssetUid) {
      return HttpResponse.json({ detail: 'asset not found' }, { status: 404 })
    }

    const payload = (await request.json()) as { tag_string?: string }

    latestPatchedAsset = {
      uid: mockAssetUid,
      tag_string: payload.tag_string || '',
    }

    return HttpResponse.json({
      ...mockAsset,
      tag_string: payload.tag_string || '',
    })
  })
}

function StoryTrigger(args: { asset: AssetResponse }) {
  return <ButtonNew onClick={() => openAssetTagsModal(args.asset)}>{t('Open AssetTagsModal')}</ButtonNew>
}

const meta: Meta<typeof StoryTrigger> = {
  title: 'Features/AssetTagsModal',
  component: StoryTrigger,
  args: {
    asset: mockAsset,
  },
  decorators: [
    (Story, context) =>
      queryClientDecorator(
        () => (
          <ModalsProvider
            modalProps={{
              ...KOBO_MODAL_SHARED_PROPS,
              withinPortal: false,
              lockScroll: false,
            }}
          >
            <div style={{ minHeight: 360, padding: 'var(--mantine-spacing-lg)', overflow: 'visible' }}>
              <Story />
            </div>
          </ModalsProvider>
        ),
        context,
      ),
  ],
  parameters: {
    msw: {
      handlers: [createAssetPatchHandler()],
    },
    a11y: { test: 'todo' },
  },
}

export default meta

type Story = StoryObj<typeof StoryTrigger>

export const Default: Story = {}

export const UpdateTagsFlow: Story = {
  play: async ({ canvasElement, step }) => {
    latestPatchedAsset = null

    const canvas = within(canvasElement)
    const page = within(document.body)

    await step('Open the modal', async () => {
      await userEvent.click(canvas.getByRole('button', { name: 'Open AssetTagsModal' }))

      await waitFor(async () => {
        await expect(page.getByRole('dialog', { name: 'Edit tags' })).toBeInTheDocument()
      })
    })

    await step('Submit new tags', async () => {
      const tagsInput = page.getByRole('textbox')
      await userEvent.click(tagsInput)
      await userEvent.type(tagsInput, 'gamma{enter}')
      await userEvent.click(page.getByRole('button', { name: 'Update' }))

      await waitFor(async () => {
        await expect(page.queryByRole('dialog', { name: 'Edit tags' })).not.toBeInTheDocument()
      })
    })

    await step('Verify payload', async () => {
      await waitFor(async () => {
        await expect(latestPatchedAsset).toEqual({
          uid: mockAssetUid,
          tag_string: 'alpha,beta,gamma',
        })
      })
    })
  },
}
