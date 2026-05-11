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

const storyAreaStyle = {
  minHeight: 720,
  padding: 'var(--mantine-spacing-lg)',
  overflow: 'visible',
}

function buildInitialAsset(): AssetResponse {
  return {
    uid: mockAssetUid,
    name: 'Storybook Form Languages',
    content: {
      schema: '1',
      translated: ['label'],
      translations: [null],
      survey: [
        {
          type: 'text',
          name: 'question_1',
          $autoname: 'question_1',
          label: ['Your name'],
        },
      ],
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

      // Find the French language item container and click its "Update translations" button
      const frenchLanguageElement = page.getByText(/French \(fr\)/).closest('div[data-with-border="true"]')
      const updateTranslationsButton = frenchLanguageElement?.querySelector('button[tooltip="Update translations"]')
      await userEvent.click(updateTranslationsButton as HTMLButtonElement)

      // Wait for the translation table to render
      await waitFor(async () => {
        const table = document.querySelector('.UniversalTableCore-module__table--gccaF')
        const rows = table?.querySelectorAll('tbody tr')
        await expect(rows && rows.length > 0).toBe(true)
      })
    })

    await step('Edit a single translation', async () => {
      // Wait for the translation textarea to be visible
      await waitFor(async () => {
        const textarea = document.querySelector('.mantine-Textarea-input') as HTMLTextAreaElement | null
        await expect(textarea).not.toBeNull()
      })

      const textarea = document.querySelector('.mantine-Textarea-input') as HTMLTextAreaElement | null

      if (textarea) {
        await userEvent.click(textarea)
        // Use the native HTMLTextAreaElement setter so React's synthetic event system
        // picks up the change and updates the controlled component's state.
        const nativeSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
        nativeSetter?.call(textarea, 'Nom')
        textarea.dispatchEvent(new Event('input', { bubbles: true }))
      }

      // Find and click the Save Changes button
      const saveButton = Array.from(document.querySelectorAll('button')).find((btn) =>
        btn.textContent?.includes('Save Changes'),
      )

      if (saveButton) {
        await userEvent.click(saveButton)

        // Verify the modal is still visible after saving
        await waitFor(async () => {
          const modalContent = document.querySelector('[data-modal-content="true"]')
          await expect(modalContent).toBeInTheDocument()
        })
      } else {
        throw new Error('Save Changes button not found')
      }
    })

    await step('Close modal', async () => {
      await userEvent.click(page.getByRole('button', { name: 'Close' }))

      await waitFor(async () => {
        await expect(page.queryByRole('dialog', { name: 'Manage Languages' })).not.toBeInTheDocument()
      })
    })
  },
}
