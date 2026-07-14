import React, { useEffect, useRef, useState } from 'react'
import { actions } from '#/actions'
import bem from '#/bem'
import Button from '#/components/common/button'
import ExportTypeSelector from '#/components/projectDownloads/ExportTypeSelector'
import ExportFetcher from '#/components/projectDownloads/exportFetcher'
import {
  DEFAULT_EXPORT_SETTINGS,
  ExportStatusName,
  type ExportTypeDefinition,
} from '#/components/projectDownloads/exportsConstants'
import exportsStore from '#/components/projectDownloads/exportsStore'
import { getContextualDefaultExportFormat } from '#/components/projectDownloads/exportsUtils'
import { type AssetResponse, type ExportDataResponse, type ExportSettingSettings, dataInterface } from '#/dataInterface'
import { downloadUrl } from '#/utils'

interface AnonymousExportsProps {
  asset: AssetResponse
}

/**
 * A compontent that ROUTES.FORM_DOWNLOADS route is displaying for a not logged in
 * users. It allows to select an export type and download a file.
 * @prop {object} asset
 */
export default function AnonymousExports(props: AnonymousExportsProps) {
  const [selectedExportType, setSelectedExportType] = useState<ExportTypeDefinition>(exportsStore.getExportType())
  const [isPending, setIsPending] = useState(false)
  const [exportUrl, setExportUrl] = useState<string | null>(null)
  const exportFetcherRef = useRef<ExportFetcher | undefined>(undefined)

  function stopExportFetcher() {
    if (exportFetcherRef.current) {
      exportFetcherRef.current.stop()
      exportFetcherRef.current = undefined
    }
  }

  function checkExportFetcher(exportUid: string, exportStatus: ExportStatusName) {
    if (
      exportStatus !== ExportStatusName.error &&
      exportStatus !== ExportStatusName.complete &&
      !exportFetcherRef.current
    ) {
      exportFetcherRef.current = new ExportFetcher(props.asset.uid, exportUid)
    }

    if (exportStatus === ExportStatusName.error || exportStatus === ExportStatusName.complete) {
      stopExportFetcher()
    }
  }

  function fetchExport(exportUid: string) {
    actions.exports.getExport(props.asset.uid, exportUid)
  }

  useEffect(() => {
    const unlisteners = [
      exportsStore.listen(() => {
        setSelectedExportType(exportsStore.getExportType())
        setExportUrl(null)
      }, null),
      actions.exports.getExport.completed.listen((exportData: ExportDataResponse) => {
        checkExportFetcher(exportData.uid, exportData.status)

        if (exportData.status === ExportStatusName.complete) {
          setIsPending(false)
          setExportUrl(exportData.result)

          if (exportData.result !== null) {
            downloadUrl(exportData.result)
          }
        }
      }),
    ]

    return () => {
      unlisteners.forEach((unlisten) => {
        unlisten()
      })
      stopExportFetcher()
    }
  }, [props.asset.uid])

  function onSubmit() {
    if (exportUrl) {
      // we remember the current type download to not make multiple calls
      downloadUrl(exportUrl)
    } else {
      setIsPending(true)

      const defaultExportFormat = getContextualDefaultExportFormat(props.asset)
      const payload: ExportSettingSettings = {
        type: selectedExportType.value,
        fields_from_all_versions: DEFAULT_EXPORT_SETTINGS.INCLUDE_ALL_VERSIONS,
        fields: [],
        group_sep: DEFAULT_EXPORT_SETTINGS.GROUP_SEPARATOR,
        hierarchy_in_labels: DEFAULT_EXPORT_SETTINGS.INCLUDE_GROUPS,
        lang: defaultExportFormat.value,
        multiple_select: DEFAULT_EXPORT_SETTINGS.EXPORT_MULTIPLE.value,
      }

      // NOTE: this wouldn't work for legacy formats, but luckily we don't allow
      // choosing legacy types in this component
      dataInterface
        .createAssetExport(props.asset.uid, payload)
        .done((exportData: ExportDataResponse) => {
          fetchExport(exportData.uid)
        })
        .fail(() => {
          setIsPending(false)
        })
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
          <ExportTypeSelector disabled={isPending} noLegacy />
        </bem.ProjectDownloads__exportsSelector>

        <Button type='primary' size='l' isSubmit onClick={onSubmit} isPending={isPending} label={t('Export')} />
      </bem.ProjectDownloads__anonymousRow>
    </bem.FormView__cell>
  )
}
