import { Box, Checkbox, Group, Radio, Stack } from '@mantine/core'
import React from 'react'
import ButtonNew from '#/components/common/ButtonNew'
import { DATA_TABLE_SETTINGS } from '#/components/submissions/tableConstants'
import tableStore from '#/components/submissions/tableStore'
import type { AssetResponse, AssetTableSettings } from '#/dataInterface'

interface TableSettingsProps {
  asset: AssetResponse
  /** Closes this modal. Called once its own save (or reset) has been applied. */
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
  const [showGroupName, setShowGroupName] = React.useState(() => Boolean(tableStore.getShowGroupName()))
  const [showHXLTags, setShowHXLTags] = React.useState(() => Boolean(tableStore.getShowHXLTags()))
  const [translationIndex, setTranslationIndex] = React.useState(() => tableStore.getTranslationIndex())

  const displayedLabelOptions = React.useMemo<TableSettingsOption[]>(() => {
    const options: TableSettingsOption[] = [
      {
        value: '-1',
        label: t('Question & choice names'),
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

  const save = (newTableSettings: AssetTableSettings) => {
    tableStore.saveTableSettings(newTableSettings)
    props.onRequestClose()
  }

  const onSave = () => {
    save({
      [DATA_TABLE_SETTINGS.SHOW_GROUP]: showGroupName,
      [DATA_TABLE_SETTINGS.TRANSLATION]: translationIndex,
      [DATA_TABLE_SETTINGS.SHOW_HXL]: showHXLTags,
    })
  }

  const onReset = () => {
    save({
      [DATA_TABLE_SETTINGS.SHOW_GROUP]: null,
      [DATA_TABLE_SETTINGS.TRANSLATION]: null,
      [DATA_TABLE_SETTINGS.SHOW_HXL]: null,
    })
  }

  return (
    <Stack gap='md'>
      <Box fz='sm'>{t('These settings only apply to you, in this browser.')}</Box>

      <Radio.Group
        label={t('Column headers')}
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
        label={t('Show parent group in column headers')}
      />

      <Checkbox
        checked={showHXLTags}
        onChange={(event) => setShowHXLTags(event.currentTarget.checked)}
        label={t('Show HXL tags')}
      />

      <Group justify='space-between' mt='sm'>
        <ButtonNew color='red' variant='outline' onClick={onReset}>
          {t('Reset')}
        </ButtonNew>

        <ButtonNew onClick={onSave}>{t('Save')}</ButtonNew>
      </Group>
    </Stack>
  )
}
