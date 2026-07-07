import { ModalsProvider } from '@mantine/modals'
import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { getApiV2AssetsRetrieveResponseMock } from '#/api/react-query/manage-projects-and-library-content'
import ButtonNew from '#/components/common/ButtonNew'
import type { AssetResponse } from '#/dataInterface'
import { assetPatchMock } from '#/endpoints/asset.mocks'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import { KOBO_MODAL_SHARED_PROPS } from '#/theme/kobo/Modal'
import { openAssetTagsModal } from './openAssetTagsModal'

// Cast Orval-generated Asset to legacy AssetResponse type
// The types are structurally compatible at runtime, differences are:
// - Optional fields (date_created, date_modified) that are always present in responses
// - Legacy type has looser field types for backward compatibility
const mockAsset = getApiV2AssetsRetrieveResponseMock({
  uid: 'storyAssetTagsUid',
  name: 'Storybook Asset Tags',
  tag_string: 'alpha,beta',
}) as unknown as AssetResponse
const mockAssetUid = mockAsset.uid
const onAssetPatched = fn()

function createAssetPatchHandler() {
  onAssetPatched.mockClear()

  return assetPatchMock<{ tag_string?: string }>({
    asset: mockAsset,
    persistMutations: false,
    applyPatch: (asset, payload) => {
      asset.tag_string = payload.tag_string || ''
    },
    onPatch: (asset) => {
      // Using a Storybook spy is more robust than sharing mutable module state:
      // the play function can assert the exact PATCH payload and call order.
      onAssetPatched({
        uid: asset.uid,
        tag_string: asset.tag_string || '',
      })
    },
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

/**
 * Renders the trigger button without opening the modal automatically.
 */
export const Default: Story = {}

/**
 * Covers the full tag editing flow and verifies the PATCH payload sent to the API mock.
 */
export const UpdateTagsFlow: Story = {
  play: async ({ canvasElement, step }) => {
    onAssetPatched.mockClear()

    const canvas = within(canvasElement)

    await step('Open the modal', async () => {
      await userEvent.click(canvas.getByRole('button', { name: 'Open AssetTagsModal' }))

      await waitFor(async () => {
        await expect(canvas.getByRole('dialog', { name: 'Edit tags' })).toBeInTheDocument()
      })

      // Wait for the session store to load and the form to become interactive.
      // The modal shows a loading spinner until sessionStore.isInitialLoadComplete is true.
      await waitFor(async () => {
        await expect(canvas.getByRole('textbox')).toBeInTheDocument()
      })
    })

    await step('Submit new tags', async () => {
      const tagsInput = canvas.getByRole('textbox')
      await userEvent.click(tagsInput)
      await userEvent.type(tagsInput, 'gamma{enter}')
      await userEvent.click(canvas.getByRole('button', { name: 'Update' }))
    })

    await step('Verify payload', async () => {
      await waitFor(async () => {
        await expect(onAssetPatched).toHaveBeenLastCalledWith({
          uid: mockAssetUid,
          tag_string: 'alpha,beta,gamma',
        })
      })
    })
  },
}
