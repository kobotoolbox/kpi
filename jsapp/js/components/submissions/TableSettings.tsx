import { Checkbox, Group, Radio, Stack } from '@mantine/core'
import { modals } from '@mantine/modals'
import React from 'react'
import { actions } from '#/actions'
import ButtonNew from '#/components/common/ButtonNew'
import { PERMISSIONS_CODENAMES } from '#/components/permissions/permConstants'
import { userCan } from '#/components/permissions/utils'
import { DATA_TABLE_SETTINGS } from '#/components/submissions/tableConstants'
import tableStore from '#/components/submissions/tableStore'
import type { AssetResponse, AssetTableSettings } from '#/dataInterface'
import { notify } from '#/utils'

interface TableSettingsProps {
  asset: AssetResponse
  /** Id of the Mantine modal wrapping this form. */
  modalId: string
  /** Closes this modal. Called once its own save (or reset) has been applied. */
  onRequestClose: () => void
}

interface TableSettingsOption {
  value: string
  label: string
}

/**
 * This is a modal form that handles changing some of the table settings.
 *
 * The modal is a singleton (see `openTableSettingsModal`) and stays open until
 * the save it triggered resolves, so at most one save is ever in flight and we
 * don't need to correlate the global `actions.table.updateSettings` events to a
 * specific request.
 */
export default function TableSettings(props: TableSettingsProps) {
  const getCurrentTableSettings = React.useCallback(() => {
    return {
      showGroupName: Boolean(tableStore.getShowGroupName()),
      showHXLTags: Boolean(tableStore.getShowHXLTags()),
      translationIndex: tableStore.getTranslationIndex() ?? 0,
    }
  }, [])

  const [showGroupName, setShowGroupName] = React.useState(() => getCurrentTableSettings().showGroupName)
  const [showHXLTags, setShowHXLTags] = React.useState(() => getCurrentTableSettings().showHXLTags)
  const [translationIndex, setTranslationIndex] = React.useState<number>(
    () => getCurrentTableSettings().translationIndex,
  )
  const [isSaving, setIsSaving] = React.useState(false)

  React.useEffect(() => {
    // Prevent dismissing the modal while a save is in flight. Otherwise closing
    // it unmounts this form and tears down the listeners below, so a subsequent
    // failure would go unreported (ours is the only `.failed` listener).
    modals.updateModal({
      modalId: props.modalId,
      withCloseButton: !isSaving,
      closeOnEscape: !isSaving,
      closeOnClickOutside: !isSaving,
    })
  }, [isSaving, props.modalId])

  const displayedLabelOptions = React.useMemo<TableSettingsOption[]>(() => {
    const options: TableSettingsOption[] = [
      {
        value: '-1',
        label: t('XML Values'),
      },
    ]

    const translations = props.asset.content?.translations || [null]
    translations.forEach((translation, index) => {
      let label = t('Labels')
      if (translation) {
        label += ` - ${translation}`
      }
      options.push({
        value: String(index),
        label,
      })
    })

    return options
  }, [props.asset.content?.translations])

  React.useEffect(() => {
    // Users with `change_asset` save via the async `actions.table.updateSettings`
    // endpoint, which resolves once the save has persisted.
    const onUpdateSettingsCompleted = () => props.onRequestClose()

    const onUpdateSettingsFailed = () => {
      // The save didn't go through, so keep the modal open for another attempt.
      setIsSaving(false)
      notify(t('There was an error, table settings could not be saved.'))
    }

    const unlistenUpdateCompleted = actions.table.updateSettings.completed.listen(
      onUpdateSettingsCompleted,
    ) as () => void
    const unlistenUpdateFailed = actions.table.updateSettings.failed.listen(onUpdateSettingsFailed) as () => void

    return () => {
      unlistenUpdateCompleted()
      unlistenUpdateFailed()
    }
  }, [props.onRequestClose])

  const save = React.useCallback(
    (newTableSettings: AssetTableSettings) => {
      if (userCan(PERMISSIONS_CODENAMES.change_asset, props.asset)) {
        // Async endpoint save — show progress and let the `completed`/`failed`
        // listeners close the modal or report the error.
        setIsSaving(true)
        tableStore.saveTableSettings(newTableSettings)
      } else {
        // Users without `change_asset` don't hit the endpoint; the overrides are
        // applied synchronously, so there's nothing to wait for — just close.
        tableStore.saveTableSettings(newTableSettings)
        props.onRequestClose()
      }
    },
    [props.asset, props.onRequestClose],
  )

  const onSave = React.useCallback(() => {
    const newTableSettings: AssetTableSettings = {}
    newTableSettings[DATA_TABLE_SETTINGS.SHOW_GROUP] = showGroupName
    newTableSettings[DATA_TABLE_SETTINGS.TRANSLATION] = translationIndex
    newTableSettings[DATA_TABLE_SETTINGS.SHOW_HXL] = showHXLTags
    save(newTableSettings)
  }, [save, showGroupName, showHXLTags, translationIndex])

  const onReset = React.useCallback(() => {
    const newTableSettings: AssetTableSettings = {}
    newTableSettings[DATA_TABLE_SETTINGS.SHOW_GROUP] = null
    newTableSettings[DATA_TABLE_SETTINGS.TRANSLATION] = null
    newTableSettings[DATA_TABLE_SETTINGS.SHOW_HXL] = null
    save(newTableSettings)
  }, [save])

  return (
    <Stack gap='md'>
      <Radio.Group
        label={t('Display labels or XML values?')}
        value={String(translationIndex)}
        onChange={(value) => setTranslationIndex(Number.parseInt(value, 10))}
      >
        <Stack gap='xs' mt='xs'>
          {displayedLabelOptions.map((option) => (
            <Radio key={option.value} value={option.value} label={option.label} />
          ))}
        </Stack>
      </Radio.Group>

      <Checkbox
        checked={showGroupName}
        onChange={(event) => setShowGroupName(event.currentTarget.checked)}
        label={t('Show group names in table headers')}
      />

      <Checkbox
        checked={showHXLTags}
        onChange={(event) => setShowHXLTags(event.currentTarget.checked)}
        label={t('Show HXL tags')}
      />

      <Group justify='space-between' mt='sm'>
        <div>
          {userCan(PERMISSIONS_CODENAMES.change_asset, props.asset) && (
            <ButtonNew color='red' variant='outline' onClick={onReset} disabled={isSaving}>
              {t('Reset')}
            </ButtonNew>
          )}
        </div>

        <ButtonNew onClick={onSave} loading={isSaving}>
          {t('Save')}
        </ButtonNew>
      </Group>
    </Stack>
  )
}
