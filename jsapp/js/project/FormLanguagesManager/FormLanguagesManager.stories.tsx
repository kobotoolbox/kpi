import { ModalsProvider } from '@mantine/modals'
import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import ButtonNew from '#/components/common/ButtonNew'
import type { AssetResponse } from '#/dataInterface'
import { KOBO_MODAL_SHARED_PROPS } from '#/theme/kobo/Modal'
import { openFormLanguagesModal } from './index'

const mockAssetUid = 'storyFormLanguagesManagerUid'
let latestPatchedAsset: AssetResponse | null = null

const storyAreaStyle = {
  minHeight: 720,
  padding: 'var(--mantine-spacing-lg)',
  overflow: 'visible',
}

function buildInitialAsset(): AssetResponse {
  const survey = Array.from({ length: 11 }, (_, idx) => {
    const index = idx + 1
    return {
      type: 'text',
      name: `question_${index}`,
      $autoname: `question_${index}`,
      label: [`Question ${index}`],
    }
  })

  return {
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
  } as unknown as AssetResponse
}

function createAssetPatchHandler(initialAsset: AssetResponse) {
  const currentAsset = JSON.parse(JSON.stringify(initialAsset)) as AssetResponse

  return http.patch('/api/v2/assets/:uid/', async ({ params, request }) => {
    if (params.uid !== mockAssetUid) {
      return HttpResponse.json({ detail: 'asset not found' }, { status: 404 })
    }

    const payload = (await request.json()) as { content?: string; name?: string }

    if (payload.name) {
      currentAsset.name = payload.name
    }

    if (payload.content) {
      currentAsset.content = JSON.parse(payload.content)
    }

    latestPatchedAsset = JSON.parse(JSON.stringify(currentAsset)) as AssetResponse

    return HttpResponse.json(currentAsset)
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
            <div style={storyAreaStyle}>
              <Story />
            </div>
          </ModalsProvider>
        </QueryClientProvider>
      )
    },
  ],
  parameters: {
    msw: {
      handlers: [createAssetPatchHandler(buildInitialAsset())],
    },
    a11y: { test: 'todo' },
  },
}

export default meta

type Story = StoryObj<typeof StoryTrigger>

export const Default: Story = {}

export const BasicFlow: Story = {
  play: async ({ canvasElement, step }) => {
    latestPatchedAsset = null

    const canvas = within(canvasElement)
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

      const defaultNameInput = page.getByRole('textbox', { name: 'Default language name' })
      const defaultCodeInput = page.getByRole('textbox', { name: 'Default language code' })

      await userEvent.type(defaultNameInput, 'English')
      await userEvent.type(defaultCodeInput, 'en')
      await userEvent.click(page.getByRole('button', { name: 'Set' }))

      await waitFor(async () => {
        await expect(page.getByRole('button', { name: 'Add language' })).toBeInTheDocument()
      })
    })

    await step('Add another language', async () => {
      await userEvent.click(page.getByRole('button', { name: 'Add language' }))

      const languageNameInput = page.getByRole('textbox', { name: 'Language name' })
      const languageCodeInput = page.getByRole('textbox', { name: 'Language code' })

      await userEvent.type(languageNameInput, 'French')
      await userEvent.type(languageCodeInput, 'fr')
      await userEvent.click(page.getByRole('button', { name: 'Add' }))

      await waitFor(async () => {
        await expect(page.getByText('French (fr)')).toBeInTheDocument()
      })
    })

    await step('Open translations table', async () => {
      await waitFor(async () => {
        const languageItems = page.getAllByText(/French \(fr\)/)
        await expect(languageItems.length > 0).toBe(true)
      })

      // Scope the action to the French language card and query by accessible name.
      const frenchLanguageElement = page.getByText(/French \(fr\)/).closest('div[data-with-border="true"]')
      await expect(frenchLanguageElement).not.toBeNull()

      const updateTranslationsButton = within(frenchLanguageElement as HTMLElement).getByRole('button', {
        name: 'Update translations',
      })
      await userEvent.click(updateTranslationsButton)

      // Wait for the translation table/editor to render with row content.
      await waitFor(async () => {
        await expect(page.getByText('Question 1')).toBeInTheDocument()
      })
    })

    await step('Go to next translations page', async () => {
      // Wait for first-page row content instead of matching pagination text,
      // because the "Page X of Y" label can be split across nested elements.
      await waitFor(async () => {
        await expect(page.getByText('Question 1')).toBeInTheDocument()
      })

      const translationsTable = page.getByText('Question 1').closest('table')
      await expect(translationsTable).not.toBeNull()

      // Scope pagination lookup to this table's container to avoid interacting
      // with unrelated controls elsewhere in the document.
      const tableRootContainer = (translationsTable as HTMLTableElement).parentElement?.parentElement
      const paginationFooter = tableRootContainer?.querySelector('footer')

      await expect(paginationFooter).not.toBeNull()

      // In this state, first/previous are disabled, so the first enabled
      // button is always "next page".
      const nextPageButton = (paginationFooter as HTMLElement).querySelector('button:not([disabled])')
      await expect(nextPageButton).not.toBeNull()

      await userEvent.click(nextPageButton as HTMLButtonElement)

      await waitFor(async () => {
        await expect(page.getByText('Question 11')).toBeInTheDocument()
      })
    })

    await step('Edit a single translation', async () => {
      // Wait for the translation textarea to be visible
      await waitFor(async () => {
        await expect(page.getByText('Question 11')).toBeInTheDocument()
      })

      // Scope textbox lookup to the "Question 11" row so we do not hit
      // another input when multiple textboxes exist in the modal.
      const question11Row = page.getByText('Question 11').closest('tr')
      await expect(question11Row).not.toBeNull()

      const textarea = within(question11Row as HTMLElement).getByRole('textbox') as HTMLTextAreaElement

      await userEvent.click(textarea)
      // Use the native HTMLTextAreaElement setter so React's synthetic event system
      // picks up the change and updates the controlled component's state.
      const nativeSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
      nativeSetter?.call(textarea, 'Nom')
      textarea.dispatchEvent(new Event('input', { bubbles: true }))

      await userEvent.click(page.getByRole('button', { name: /Save Changes/ }))

      // Verify the modal is still visible after saving
      await waitFor(async () => {
        await expect(page.getByRole('dialog', { name: 'Manage Languages' })).toBeInTheDocument()
      })
    })

    await step('Verify API saved translation for question 11', async () => {
      await waitFor(async () => {
        await expect(latestPatchedAsset).not.toBeNull()
      })

      const survey = latestPatchedAsset?.content?.survey || []
      const question11 = survey.find((item) => item.name === 'question_11')
      const label = question11?.label as Array<string | null> | undefined

      await expect(label && label[1]).toBe('Nom')
    })

    await step('Close modal', async () => {
      const manageDialog = page.getByRole('dialog', { name: 'Manage Languages' })
      const closeButtons = within(manageDialog).getAllByRole('button', { name: 'Close' })
      // Inside the Manage Languages dialog, target the header close control.
      await userEvent.click(closeButtons[closeButtons.length - 1])

      // Closing while the translations table is still the active view may
      // trigger an "unsaved changes" confirmation dialog (even after a
      // successful save, the ref can still be set in some timing scenarios).
      // Handle it inside waitFor so it is retried until the state settles.
      await waitFor(
        async () => {
          const confirmDialog = page.queryByRole('dialog', { name: 'Close Translations Table?' })
          if (confirmDialog) {
            // Scoping to the confirmation dialog avoids hitting the header
            // "Close" button of the outer modal by accident.
            await userEvent.click(within(confirmDialog).getByRole('button', { name: 'Close' }))
          }
          await expect(page.queryByRole('dialog', { name: 'Manage Languages' })).not.toBeInTheDocument()
        },
        { timeout: 10000 },
      )
    })
  },
}
