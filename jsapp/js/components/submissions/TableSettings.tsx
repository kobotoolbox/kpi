import { Checkbox, Group, Radio, Stack } from '@mantine/core'
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
  /** Called once this modal's own save (or reset) has been applied. */
  onRequestClose: () => void
}

interface TableSettingsOption {
  value: string
  label: string
}

/**
 * This is a modal form that handles changing some of the table settings.
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

  // Set when *this* modal instance triggers a save/reset, so we only close in
  // response to our own save resolving — never an unrelated table settings
  // change coming from elsewhere. Because it lives on the instance, a save from
  // a previously-dismissed modal can't close a freshly-opened one.
  const didInitiateSaveRef = React.useRef(false)

  // Keep a stable reference to the latest close handler so the listener effect
  // below doesn't need to re-subscribe when props change.
  const onRequestCloseRef = React.useRef(props.onRequestClose)
  onRequestCloseRef.current = props.onRequestClose

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
    // endpoint; this resolves once our save persisted.
    const onUpdateSettingsCompleted = () => {
      if (didInitiateSaveRef.current) {
        didInitiateSaveRef.current = false
        onRequestCloseRef.current()
      }
    }

    // Users without `change_asset` don't hit the endpoint — `saveTableSettings`
    // applies local overrides synchronously and triggers the store instead. We
    // still sync the form to the latest values, and close if it was our save.
    const onTableStoreChange = () => {
      const settings = getCurrentTableSettings()
      setShowGroupName(settings.showGroupName)
      setShowHXLTags(settings.showHXLTags)
      setTranslationIndex(settings.translationIndex)

      if (didInitiateSaveRef.current) {
        didInitiateSaveRef.current = false
        onRequestCloseRef.current()
      }
    }

    const onUpdateSettingsFailed = () => {
      // The save didn't go through, so keep the modal open for another attempt.
      didInitiateSaveRef.current = false
      notify(t('There was an error, table settings could not be saved.'))
    }

    const unlistenUpdateCompleted = actions.table.updateSettings.completed.listen(
      onUpdateSettingsCompleted,
    ) as () => void
    const unlistenUpdateFailed = actions.table.updateSettings.failed.listen(onUpdateSettingsFailed) as () => void
    const unlistenTableStore = tableStore.listen(onTableStoreChange, null) as () => void

    return () => {
      unlistenUpdateCompleted()
      unlistenUpdateFailed()
      unlistenTableStore()
    }
  }, [getCurrentTableSettings])

  const onSave = React.useCallback(() => {
    didInitiateSaveRef.current = true
    const newTableSettings: AssetTableSettings = {}
    newTableSettings[DATA_TABLE_SETTINGS.SHOW_GROUP] = showGroupName
    newTableSettings[DATA_TABLE_SETTINGS.TRANSLATION] = translationIndex
    newTableSettings[DATA_TABLE_SETTINGS.SHOW_HXL] = showHXLTags
    tableStore.saveTableSettings(newTableSettings)
  }, [showGroupName, showHXLTags, translationIndex])

  const onReset = React.useCallback(() => {
    didInitiateSaveRef.current = true
    const newTableSettings: AssetTableSettings = {}
    newTableSettings[DATA_TABLE_SETTINGS.SHOW_GROUP] = null
    newTableSettings[DATA_TABLE_SETTINGS.TRANSLATION] = null
    newTableSettings[DATA_TABLE_SETTINGS.SHOW_HXL] = null
    tableStore.saveTableSettings(newTableSettings)
  }, [])

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
            <ButtonNew color='red' variant='outline' onClick={onReset}>
              {t('Reset')}
            </ButtonNew>
          )}
        </div>

        <ButtonNew onClick={onSave}>{t('Save')}</ButtonNew>
      </Group>
    </Stack>
  )
}
