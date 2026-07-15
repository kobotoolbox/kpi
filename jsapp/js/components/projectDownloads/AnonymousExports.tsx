import * as Sentry from '@sentry/react'
import React, { useEffect, useRef, useState } from 'react'
import { assetsExportsRetrieve, useAssetsExportsCreate } from '#/api/react-query/survey-data'
import bem from '#/bem'
import Button from '#/components/common/button'
import ExportTypeSelector from '#/components/projectDownloads/ExportTypeSelector'
import ExportFetcher from '#/components/projectDownloads/exportFetcher'
import {
  DEFAULT_EXPORT_SETTINGS,
  ExportStatusName,
  type ExportTypeDefinition,
} from '#/components/projectDownloads/exportsConstants'
import { getContextualDefaultExportFormat } from '#/components/projectDownloads/exportsUtils'
import type { AssetResponse, ExportDataResponse, ExportSettingSettings } from '#/dataInterface'
import { downloadUrl, notify } from '#/utils'

interface AnonymousExportsProps {
  asset: AssetResponse
  selectedExportType: ExportTypeDefinition
  setSelectedExportType: (newType: ExportTypeDefinition) => void
}

/**
 * A component that ROUTES.FORM_DOWNLOADS route is displaying for a not logged in
 * users. It allows to select an export type and download a file.
 * @prop {object} asset
 */
export default function AnonymousExports(props: AnonymousExportsProps) {
  const [isPending, setIsPending] = useState(false)
  const [exportUrl, setExportUrl] = useState<string | null>(null)
  const exportFetcherRef = useRef<ExportFetcher | undefined>(undefined)
  const createExportMutation = useAssetsExportsCreate()

  function stopExportFetcher() {
    if (exportFetcherRef.current) {
      exportFetcherRef.current.stop()
      exportFetcherRef.current = undefined
    }
  }

  function checkExportFetcher(exportUid: string, exportStatus: ExportStatusName) {
    // Poll only while the export is still running. Terminal states should stop polling.
    if (
      exportStatus !== ExportStatusName.error &&
      exportStatus !== ExportStatusName.complete &&
      !exportFetcherRef.current
    ) {
      exportFetcherRef.current = new ExportFetcher(() => fetchExport(exportUid))
    }

    if (exportStatus === ExportStatusName.error || exportStatus === ExportStatusName.complete) {
      stopExportFetcher()
    }
  }

  async function fetchExport(exportUid: string) {
    try {
      const response = await assetsExportsRetrieve(props.asset.uid, exportUid)
      if (response.status !== 200) {
        return
      }

      const exportData = response.data as unknown as ExportDataResponse
      checkExportFetcher(exportData.uid, exportData.status)

      if (exportData.status === ExportStatusName.complete) {
        setIsPending(false)
        setExportUrl(exportData.result)

        if (exportData.result !== null) {
          downloadUrl(exportData.result)
        }
      } else if (exportData.status === ExportStatusName.error) {
        setIsPending(false)
      }
    } catch {
      setIsPending(false)
    }
  }

  useEffect(
    () => () => {
      stopExportFetcher()
    },
    [props.asset.uid],
  )

  useEffect(() => {
    setExportUrl(null)
  }, [props.selectedExportType.value])

  async function onSubmit() {
    if (exportUrl) {
      // we remember the current type download to not make multiple calls
      downloadUrl(exportUrl)
    } else {
      setIsPending(true)

      const defaultExportFormat = getContextualDefaultExportFormat(props.asset)
      const payload: ExportSettingSettings = {
        type: props.selectedExportType.value,
        fields_from_all_versions: DEFAULT_EXPORT_SETTINGS.INCLUDE_ALL_VERSIONS,
        fields: [],
        group_sep: DEFAULT_EXPORT_SETTINGS.GROUP_SEPARATOR,
        hierarchy_in_labels: DEFAULT_EXPORT_SETTINGS.INCLUDE_GROUPS,
        lang: defaultExportFormat.value,
        multiple_select: DEFAULT_EXPORT_SETTINGS.EXPORT_MULTIPLE.value,
      }

      // NOTE: this wouldn't work for legacy formats, but luckily we don't allow
      // choosing legacy types in this component
      try {
        const response = await createExportMutation.mutateAsync({
          uidAsset: props.asset.uid,
          data: payload as never,
        })

        if (response.status === 201) {
          void fetchExport(response.data.uid)
        } else {
          setIsPending(false)
        }
      } catch (error: unknown) {
        let errorMessage = t('Failed to create export')
        if (typeof error === 'object' && error !== null && 'responseJSON' in error) {
          const responseJSON = (error as { responseJSON?: { error?: string } }).responseJSON
          if (responseJSON?.error) {
            errorMessage = responseJSON.error
          }
        }

        notify(errorMessage, 'error')
        Sentry.captureMessage(errorMessage)
        setIsPending(false)
      }
    }
  }

  /**
   * We allow only one pending download at a time, so we disable the type
   * selector and the export button for simplicity.
   */
  return (
    <bem.FormView__cell m={['box', 'padding']}>
      <bem.ProjectDownloads__anonymousRow>
        <bem.ProjectDownloads__exportsSelector>
          <ExportTypeSelector
            selectedExportType={props.selectedExportType}
            onSelectedExportTypeChange={props.setSelectedExportType}
            disabled={isPending}
            noLegacy
          />
        </bem.ProjectDownloads__exportsSelector>

        <Button type='primary' size='l' isSubmit onClick={onSubmit} isPending={isPending} label={t('Export')} />
      </bem.ProjectDownloads__anonymousRow>
    </bem.FormView__cell>
  )
}
