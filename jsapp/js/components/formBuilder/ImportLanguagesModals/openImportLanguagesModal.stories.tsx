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
  onAnswered.mockClear()
  await userEvent.click(canvas.getByRole('button', { name: TRIGGER_LABEL }))

  const dialog = await waitFor(() => canvas.getByRole('dialog', { name: dialogName }))
  return { canvas, dialog }
}

/**
 * Asserts what the promise resolved with, which is the only thing the caller acts on. Also waits for the dialog to
 * go, so a story can open it again for the next answer.
 */
const expectAnswer = async (canvas: ReturnType<typeof within>, expected: string) => {
  await waitFor(() => expect(onAnswered).toHaveBeenCalledWith(expected))
  await waitFor(() => expect(canvas.queryByRole('dialog')).not.toBeInTheDocument())
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
    const { canvas, dialog } = await openStoryModal(canvasElement, 'Set the form language first')

    await expect(dialog).toHaveTextContent("Please set the form's default language before adding this library asset.")

    await userEvent.click(within(dialog).getByRole('button', { name: 'Manage languages' }))
    await expectAnswer(canvas, 'manage-languages')
  },
}

export const ConfirmAddSeveralLanguages: Story = {
  args: { resolution: { action: 'confirm-add', languagesToAdd: [LANG_FR, LANG_PL, LANG_RU] } },
  play: async ({ canvasElement }) => {
    const { canvas, dialog } = await openStoryModal(canvasElement, 'Language mismatch')

    await expect(dialog).toHaveTextContent(
      `Library asset does not match your form languages. If you continue, ${LANG_FR}, ${LANG_PL}, and ${LANG_RU} will be added to your form.`,
    )
    await expect(dialog).toHaveTextContent('translations for the existing form languages manually')

    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue' }))
    await expectAnswer(canvas, 'proceed')
  },
}

export const AddOrDiscardExtraLanguages: Story = {
  args: { resolution: { action: 'add-or-discard', languagesToAdd: [LANG_ES, LANG_FR] } },
  play: async ({ canvasElement }) => {
    const { canvas, dialog } = await openStoryModal(canvasElement, 'New languages in library asset')

    await expect(dialog).toHaveTextContent(
      `Library asset includes languages that are not in your form: ${LANG_ES} and ${LANG_FR}.`,
    )

    await userEvent.click(within(dialog).getByRole('button', { name: 'Add languages' }))
    await expectAnswer(canvas, 'proceed')
  },
}

export const AddOrDiscardOneExtraLanguage: Story = {
  args: { resolution: { action: 'add-or-discard', languagesToAdd: [LANG_ES] } },
  play: async ({ canvasElement }) => {
    const { canvas, dialog } = await openStoryModal(canvasElement, 'New languages in library asset')

    // A single name is listed on its own, with none of the joining a list gets
    await expect(dialog).toHaveTextContent(`Library asset includes languages that are not in your form: ${LANG_ES}.`)

    await userEvent.click(within(dialog).getByRole('button', { name: 'Discard languages' }))
    await expectAnswer(canvas, 'discard')

    // This dialog has no cancel button, so dismissing is the only way out of it
    const reopened = await openStoryModal(canvasElement, 'New languages in library asset')
    await userEvent.keyboard('{Escape}')
    await expectAnswer(reopened.canvas, 'cancel')
  },
}

/** Nothing here has a safe default, so every way of walking away has to resolve `cancel` rather than hang. */
export const DismissingAnswersCancel: Story = {
  args: { resolution: { action: 'confirm-add', languagesToAdd: [LANG_ES] } },
  play: async ({ canvasElement }) => {
    const cancelled = await openStoryModal(canvasElement, 'Language mismatch')
    await userEvent.click(within(cancelled.dialog).getByRole('button', { name: 'Cancel' }))
    await expectAnswer(cancelled.canvas, 'cancel')

    const escaped = await openStoryModal(canvasElement, 'Language mismatch')
    await userEvent.keyboard('{Escape}')
    await expectAnswer(escaped.canvas, 'cancel')

    const closed = await openStoryModal(canvasElement, 'Language mismatch')
    await userEvent.click(within(closed.dialog).getByRole('button', { name: 'Close' }))
    await expectAnswer(closed.canvas, 'cancel')
  },
}
