import { ModalsProvider } from '@mantine/modals'
import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import type { AssetContentSurveyItem } from '#/api/models/assetContentSurveyItem'
import { getApiV2AssetsRetrieveResponseMock } from '#/api/react-query/manage-projects-and-library-content/msw'
import ButtonNew from '#/components/common/ButtonNew'
import { QuestionTypeName } from '#/constants'
import type { AssetResponse } from '#/dataInterface'
import { assetPatchMock } from '#/endpoints/asset.mocks'
import { withMinHeightWrapper } from '#/storybookUtils'
import { KOBO_MODAL_SHARED_PROPS } from '#/theme/kobo/Modal'
import { openFormLanguagesModal } from './index'

const mockAssetUid = 'storyFormLanguagesManagerUid'
const onAssetPatched = fn()

function buildInitialAsset(): AssetResponse {
  const survey: AssetContentSurveyItem[] = Array.from({ length: 3 }, (_, idx) => {
    const index = idx + 1
    return {
      $kuid: `kuid_question_${index}`,
      type: QuestionTypeName.text,
      name: `question_${index}`,
      $autoname: `question_${index}`,
      label: [`Question ${index}`],
    }
  })

  // Cast Orval Asset to legacy AssetResponse (see DataTableWrapper.stories.tsx for details)
  return getApiV2AssetsRetrieveResponseMock({
    uid: mockAssetUid,
    name: 'Storybook Form Languages',
    content: {
      schema: '1',
      translated: ['label'],
      translations: [null],
      survey,
      choices: [],
      settings: {},
    },
  }) as unknown as AssetResponse
}

function createAssetPatchHandler(initialAsset: AssetResponse) {
  onAssetPatched.mockClear()

  return assetPatchMock<{ content?: string; name?: string }>({
    asset: initialAsset,
    applyPatch: (asset, payload) => {
      if (payload.name) {
        asset.name = payload.name
      }

      if (payload.content) {
        asset.content = JSON.parse(payload.content)
      }
    },
    // Snapshot every PATCH so assertions can inspect what got saved.
    onPatch: (asset) => {
      onAssetPatched(asset)
    },
  })
}

function StoryTrigger(args: { asset: AssetResponse }) {
  return (
    <ButtonNew
      onClick={() => {
        openFormLanguagesModal(args.asset)
      }}
    >
      Open FormLanguagesManager
    </ButtonNew>
  )
}

const meta: Meta<typeof StoryTrigger> = {
  title: 'Features/FormLanguagesManager',
  component: StoryTrigger,
  args: {
    asset: buildInitialAsset(),
  },
  // Keep both providers in one decorator so modals opened via `modals.open`
  // inherit the same React Query context used by the story.
  decorators: [
    withMinHeightWrapper(720),
    (Story) => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: 0,
            refetchOnWindowFocus: false,
          },
        },
      })

      return (
        <QueryClientProvider client={queryClient}>
          <ModalsProvider
            modalProps={{
              ...KOBO_MODAL_SHARED_PROPS,
              withinPortal: false,
              lockScroll: false,
            }}
          >
            <Story />
          </ModalsProvider>
        </QueryClientProvider>
      )
    },
  ],
  parameters: {
    msw: {
      handlers: [createAssetPatchHandler(buildInitialAsset())],
    },
    a11y: { disable: true },
  },
}

export default meta

type Story = StoryObj<typeof StoryTrigger>

/** Opens the modal from a minimal story shell without extra interactions. */
export const Default: Story = {}

/** Walks the workflow: name the default language, add another, translate, save. */
export const BasicFlow: Story = {
  play: async ({ canvasElement, step }) => {
    onAssetPatched.mockClear()

    const canvas = within(canvasElement)
    // The modal renders outside the story canvas, so everything else goes through body.
    const page = within(document.body)

    await step('Open the manager modal', async () => {
      await userEvent.click(canvas.getByRole('button', { name: 'Open FormLanguagesManager' }))

      await waitFor(async () => {
        await expect(page.getByRole('dialog', { name: 'Manage Languages' })).toBeInTheDocument()
      })
    })

    await step('Set default language', async () => {
      await waitFor(async () => {
        await expect(page.getByRole('textbox', { name: 'Default language name' })).toBeInTheDocument()
      })

      await userEvent.type(page.getByRole('textbox', { name: 'Default language name' }), 'English')
      await userEvent.type(page.getByRole('textbox', { name: 'Default language code' }), 'en')
      await userEvent.click(page.getByRole('button', { name: 'Set' }))

      await waitFor(async () => {
        await expect(page.getByRole('button', { name: 'Add language' })).toBeInTheDocument()
      })
    })

    await step('Add another language', async () => {
      await userEvent.click(page.getByRole('button', { name: 'Add language' }))

      await userEvent.type(page.getByRole('textbox', { name: 'Language name' }), 'French')
      await userEvent.type(page.getByRole('textbox', { name: 'Language code' }), 'fr')
      await userEvent.click(page.getByRole('button', { name: 'Add' }))

      await waitFor(async () => {
        await expect(page.getByText('French (fr)')).toBeInTheDocument()
      })
    })

    await step('Open translations table', async () => {
      // Scope to the French card so we don't hit the default language's button.
      const frenchCard = page.getByText('French (fr)').closest('div[data-with-border="true"]')
      await expect(frenchCard).not.toBeNull()

      await userEvent.click(within(frenchCard as HTMLElement).getByRole('button', { name: 'Update translations' }))

      await waitFor(async () => {
        await expect(page.getByText('Question 1')).toBeInTheDocument()
      })
    })

    await step('Translate a question and save', async () => {
      // `UniversalTable` renders null until its query key has data, so the table remounts
      // right after the rows appear. Typing into a detached textarea is silently dropped,
      // so re-query the row on every attempt.
      await waitFor(
        async () => {
          const row = page.getByText('Question 1').closest('tr')
          const textarea = within(row as HTMLElement).getByRole('textbox')

          await userEvent.clear(textarea)
          await userEvent.type(textarea, 'Nom')
          await expect(textarea).toHaveValue('Nom')
        },
        // Only needs to outlast a couple of remount retries. Stay well under the 30s test
        // timeout, or a real failure here shows up as a timeout instead of an assertion.
        { timeout: 5000 },
      )

      await userEvent.click(page.getByRole('button', { name: /Save Changes/ }))

      // The PATCH goes through the MSW service worker, which can outlast the 1s
      // `waitFor` default on a loaded CI machine.
      await waitFor(
        async () => {
          await expect(onAssetPatched).toHaveBeenCalled()

          const savedAsset = onAssetPatched.mock.calls.at(-1)?.[0] as AssetResponse | undefined
          const survey = savedAsset?.content?.survey || []
          const label = survey.find((item) => item.name === 'question_1')?.label as Array<string | null> | undefined

          await expect(label?.[1]).toBe('Nom')
        },
        { timeout: 10000 },
      )
    })
  },
}
