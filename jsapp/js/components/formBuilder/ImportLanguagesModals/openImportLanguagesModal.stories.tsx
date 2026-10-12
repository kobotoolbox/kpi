import { ModalsProvider } from '@mantine/modals'
import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { KOBO_MODAL_SHARED_PROPS } from '#/theme/kobo/Modal'
import { type AnsweredImportLanguagesResolution, openImportLanguagesModal } from './openImportLanguagesModal'

const LANG_ES = 'Español (es)'
const LANG_FR = 'Français (fr)'
const LANG_PL = 'Polski (pl)'
const LANG_RU = 'Русский (ru)'

/** Logs the answer into the Actions panel when clicking through by hand. */
const onAnswered = fn()

/** Shared so the trigger's label and the query that clicks it can't drift apart. */
const TRIGGER_LABEL = 'Mock import library asset'

function StoryTrigger(args: { resolution: AnsweredImportLanguagesResolution }) {
  async function openModal() {
    onAnswered(await openImportLanguagesModal(args.resolution))
  }

  // Unstyled on purpose: it stands in for drag-and-drop
  return (
    <button type='button' onClick={openModal}>
      {TRIGGER_LABEL}
    </button>
  )
}

/** Opens the dialog, since every one of these stories is about a dialog. */
const openStoryModal = async (canvasElement: HTMLElement, dialogName: string) => {
  const canvas = within(canvasElement)
  await userEvent.click(canvas.getByRole('button', { name: TRIGGER_LABEL }))

  const dialog = await waitFor(() => canvas.getByRole('dialog', { name: dialogName }))
  return { canvas, dialog }
}

const meta: Meta<typeof StoryTrigger> = {
  title: 'Features/ImportLanguagesModals',
  component: StoryTrigger,
  decorators: [
    (Story) => (
      <ModalsProvider modalProps={{ ...KOBO_MODAL_SHARED_PROPS, withinPortal: false, lockScroll: false }}>
        <div style={{ minHeight: 360, padding: 'var(--mantine-spacing-lg)', overflow: 'visible' }}>
          <Story />
        </div>
      </ModalsProvider>
    ),
  ],
  parameters: {
    a11y: {
      config: { rules: [{ id: 'color-contrast', enabled: false }] },
    },
  },
}

export default meta

type Story = StoryObj<typeof StoryTrigger>

export const BlockedUntilFormLanguageIsSet: Story = {
  args: { resolution: { action: 'block' } },
  play: async ({ canvasElement }) => {
    const { dialog } = await openStoryModal(canvasElement, 'Set the form language first')

    await expect(dialog).toHaveTextContent("Please set the form's default language before adding this library asset.")
    await expect(within(dialog).getByRole('button', { name: 'Manage languages' })).toBeInTheDocument()
  },
}

export const ConfirmAddSeveralLanguages: Story = {
  args: { resolution: { action: 'confirm-add', languagesToAdd: [LANG_FR, LANG_PL, LANG_RU] } },
  play: async ({ canvasElement }) => {
    const { dialog } = await openStoryModal(canvasElement, 'Language mismatch')

    await expect(dialog).toHaveTextContent(
      `Library asset does not match your form languages. If you continue, ${LANG_FR}, ${LANG_PL}, and ${LANG_RU} will be added to your form.`,
    )
    await expect(dialog).toHaveTextContent('translations for the existing form languages manually')
  },
}

export const AddOrDiscardExtraLanguages: Story = {
  args: { resolution: { action: 'add-or-discard', languagesToAdd: [LANG_ES, LANG_FR] } },
  play: async ({ canvasElement }) => {
    const { dialog } = await openStoryModal(canvasElement, 'New languages in library asset')

    await expect(dialog).toHaveTextContent(
      `Library asset includes languages that are not in your form: ${LANG_ES} and ${LANG_FR}.`,
    )
    await expect(within(dialog).getByRole('button', { name: 'Add languages' })).toBeInTheDocument()
    await expect(within(dialog).getByRole('button', { name: 'Discard languages' })).toBeInTheDocument()
  },
}

export const AddOrDiscardOneExtraLanguage: Story = {
  args: { resolution: { action: 'add-or-discard', languagesToAdd: [LANG_ES] } },
  play: async ({ canvasElement }) => {
    const { dialog } = await openStoryModal(canvasElement, 'New languages in library asset')

    // A single name is listed on its own, with none of the joining a list gets
    await expect(dialog).toHaveTextContent(`Library asset includes languages that are not in your form: ${LANG_ES}.`)
  },
}
