import { Text } from '@mantine/core'
import { modals } from '@mantine/modals'
import { openKoboConfirmModal } from '#/components/common/openKoboConfirmModal'
import type { ImportLanguagesResolution } from '../importLanguages'
import AddOrDiscardLanguages from './AddOrDiscardLanguages'
import ConfirmAddLanguages from './ConfirmAddLanguages'

/** What the user decided about a library import whose languages don't line up with the form's. */
export type ImportLanguagesChoice =
  /** Insert the asset, adding whatever languages it brings to the form. */
  | 'proceed'
  /** Insert the asset with the languages the form doesn't have stripped out of it. */
  | 'discard'
  /** Don't insert anything, and take the user somewhere they can name the form's default language. */
  | 'manage-languages'
  /** Don't insert anything. Also what dismissing any of these dialogs means. */
  | 'cancel'

/** The resolutions that need the user to answer something. A `merge` needs no dialog. */
export type AnsweredImportLanguagesResolution = Extract<
  ImportLanguagesResolution,
  { action: 'block' | 'confirm-add' | 'add-or-discard' }
>

/**
 * Asks how a library asset's languages should join the form's and resolves with the answer. Dismissing resolves
 * `cancel`, since none of these questions has a safe default. Navigation is left to the caller.
 */
export function openImportLanguagesModal(
  resolution: AnsweredImportLanguagesResolution,
): Promise<ImportLanguagesChoice> {
  return new Promise((resolve) => {
    // Mantine fires `onClose` after a button press too, so the first answer wins
    let hasAnswered = false
    const answer = (choice: ImportLanguagesChoice) => {
      if (!hasAnswered) {
        hasAnswered = true
        resolve(choice)
      }
    }

    if (resolution.action === 'block') {
      openKoboConfirmModal({
        title: t('Set the form language first'),
        children: <Text>{t("Please set the form's default language before adding this library asset.")}</Text>,
        // Not destructive action
        confirmProps: { variant: 'filled' },
        labels: { confirm: t('Manage languages'), cancel: t('Cancel') },
        onConfirm: () => answer('manage-languages'),
        onClose: () => answer('cancel'),
      })
      return
    }

    if (resolution.action === 'confirm-add') {
      openKoboConfirmModal({
        title: t('Language mismatch'),
        children: <ConfirmAddLanguages languagesToAdd={resolution.languagesToAdd} />,
        confirmProps: { variant: 'filled' },
        labels: { confirm: t('Continue'), cancel: t('Cancel') },
        onConfirm: () => answer('proceed'),
        onClose: () => answer('cancel'),
      })
      return
    }

    // Not `openKoboConfirmModal`: neither answer here is what dismissing should fall back to. The buttons are built
    // before `open()` returns the id, so they read it from this binding when clicked.
    let modalId = ''
    modalId = modals.open({
      title: t('New languages in library asset'),
      children: (
        <AddOrDiscardLanguages
          languagesToAdd={resolution.languagesToAdd}
          onAdd={() => {
            answer('proceed')
            modals.close(modalId)
          }}
          onDiscard={() => {
            answer('discard')
            modals.close(modalId)
          }}
        />
      ),
      onClose: () => answer('cancel'),
    })
  })
}
