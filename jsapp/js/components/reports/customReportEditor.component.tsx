import { Group, Stack, Text } from '@mantine/core'
import { omit } from 'lodash-es'
import { useEffect, useState } from 'react'
import { actions } from '#/actions'
import { handleApiFail } from '#/api'
import ButtonNew from '#/components/common/ButtonNew'
import TextInput from '#/components/common/TextInput'
import MultiCheckbox, { type MultiCheckboxItem } from '#/components/common/multiCheckbox'
import type { CustomReportSettings, ReportsResponse } from '#/components/reports/reportsConstants'
import type { AssetResponse, FailResponse } from '#/dataInterface'
import { getReportRowTranslatedLabel } from './reports.utils'

interface CustomReportEditorProps {
  reportData: ReportsResponse[]
  customReport: CustomReportSettings
  asset: AssetResponse
}

/**
 * This component is being used to create or modify custom report.
 */
export default function CustomReportEditor(props: CustomReportEditorProps) {
  const [customReport, setCustomReport] = useState<CustomReportSettings>(props.customReport)
  const [isPending, setIsPending] = useState(false)

  useEffect(() => {
    const unlisteners = [
      actions.reports.setCustom.completed.listen(() => setIsPending(false)),
      actions.reports.setCustom.failed.listen((response: FailResponse) => {
        handleApiFail(response)
        setIsPending(false)
      }),
    ]
    return () => unlisteners.forEach((clb) => clb())
  }, [])

  const questionItems: MultiCheckboxItem[] = props.reportData.map((item) => ({
    name: item.name,
    label: getReportRowTranslatedLabel(item, props.asset.content?.survey, 0),
    checked: customReport.questions.includes(item.name),
  }))

  function onQuestionsChange(items: MultiCheckboxItem[]) {
    setCustomReport({ ...customReport, questions: items.filter((item) => item.checked).map((item) => item.name) })
  }

  /** Pass `null` to delete report */
  function updateAssetCustomReports(newReport: CustomReportSettings | null) {
    const { crid } = customReport
    const assetCustomReports =
      newReport === null ? omit(props.asset.report_custom, crid) : { ...props.asset.report_custom, [crid]: newReport }
    actions.reports.setCustom(props.asset.uid, assetCustomReports, crid)
    setIsPending(true)
  }

  return (
    <Stack>
      <TextInput
        // Modal focuses this on open
        data-autofocus
        value={customReport.name}
        placeholder={t('Untitled Report')}
        onChange={(evt) => setCustomReport({ ...customReport, name: evt.currentTarget.value })}
      />

      <Text fw='bold'>{t('Include the following questions:')}</Text>

      <MultiCheckbox type='bare' items={questionItems} onChange={onQuestionsChange} />

      <Group justify='flex-end'>
        {props.asset.report_custom?.[customReport.crid] && (
          <ButtonNew variant='danger' size='lg' onClick={() => updateAssetCustomReports(null)} loading={isPending}>
            {t('Delete')}
          </ButtonNew>
        )}

        <ButtonNew size='lg' onClick={() => updateAssetCustomReports(customReport)} loading={isPending}>
          {t('Save')}
        </ButtonNew>
      </Group>
    </Stack>
  )
}
