import { Flex, Text } from '@mantine/core'
import React, { useEffect, useRef, useState } from 'react'
import { assetsExportsRetrieve, useAssetsExportsDestroy, useAssetsExportsList } from '#/api/react-query/survey-data'
import { getLanguageIndex } from '#/assetUtils'
import bem from '#/bem'
import SimpleTable from '#/components/common/SimpleTable'
import Button from '#/components/common/button'
import LoadingSpinner from '#/components/common/loadingSpinner'
import { PERMISSIONS_CODENAMES } from '#/components/permissions/permConstants'
import { userCan } from '#/components/permissions/utils'
import ExportFetcher from '#/components/projectDownloads/exportFetcher'
import {
  EXPORT_FORMATS,
  EXPORT_TYPES,
  ExportStatusName,
  type ExportTypeDefinition,
  ExportTypeName,
} from '#/components/projectDownloads/exportsConstants'
import { openDeleteExportModal } from '#/components/projectDownloads/openDeleteExportModal'
import type { AssetResponse, ExportDataLang, ExportDataResponse } from '#/dataInterface'
import { formatTime, notify } from '#/utils'

interface ProjectExportsListProps {
  asset: AssetResponse
  selectedExportType: ExportTypeDefinition
}

/**
 * Component that displays all available downloads (for logged in user only).
 */
export default function ProjectExportsList(props: ProjectExportsListProps) {
  const [isComponentReady, setIsComponentReady] = useState(false)
  const [rows, setRows] = useState<ExportDataResponse[]>([])
  const [deletingExports, setDeletingExports] = useState<Set<string>>(new Set())
  const exportFetchersRef = useRef<Map<string, ExportFetcher>>(new Map())
  const exportsListQuery = useAssetsExportsList(props.asset.uid)
  const deleteExportMutation = useAssetsExportsDestroy()

  function stopExportFetcher(exportUid: string) {
    const exportFetcher = exportFetchersRef.current.get(exportUid)
    if (exportFetcher) {
      exportFetcher.stop()
    }
    exportFetchersRef.current.delete(exportUid)
  }

  function stopAllExportFetchers() {
    for (const exportUid of exportFetchersRef.current.keys()) {
      stopExportFetcher(exportUid)
    }
  }

  function addExportFetcher(exportUid: string) {
    exportFetchersRef.current.set(exportUid, new ExportFetcher(() => fetchExport(exportUid)))
  }

  function checkExportFetcher(exportUid: string, exportStatus: ExportStatusName) {
    if (
      exportStatus !== ExportStatusName.error &&
      exportStatus !== ExportStatusName.complete &&
      !exportFetchersRef.current.has(exportUid)
    ) {
      addExportFetcher(exportUid)
    }

    if (exportStatus === ExportStatusName.error || exportStatus === ExportStatusName.complete) {
      stopExportFetcher(exportUid)
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

      setRows((currentRows) => {
        const newRows = [...currentRows]
        const existingIndex = newRows.findIndex((rowData) => rowData.uid === exportData.uid)

        if (existingIndex >= 0) {
          newRows[existingIndex] = exportData
        } else {
          newRows.unshift(exportData)
        }

        return newRows
      })
    } catch {
      // A temporary network error should not kill polling.
    }
  }

  function deleteExport(exportUid: string) {
    openDeleteExportModal(async () => {
      setDeletingExports((prev) => new Set(prev).add(exportUid))
      try {
        await deleteExportMutation.mutateAsync({ uidAsset: props.asset.uid, uidExport: exportUid })
      } catch {
        notify(t('Failed to delete export'), 'error')
      } finally {
        setDeletingExports((prev) => {
          const next = new Set(prev)
          next.delete(exportUid)
          return next
        })
      }
    })
  }

  useEffect(
    () => () => {
      stopAllExportFetchers()
    },
    [props.asset.uid],
  )

  useEffect(() => {
    if (exportsListQuery.isSuccess && exportsListQuery.data.status === 200) {
      const exportRows = exportsListQuery.data.data.results as unknown as ExportDataResponse[]

      // Stop fetchers for exports that are no longer in the list
      const currentExportUids = new Set(exportRows.map((row) => row.uid))
      for (const fetcherUid of exportFetchersRef.current.keys()) {
        if (!currentExportUids.has(fetcherUid)) {
          stopExportFetcher(fetcherUid)
        }
      }

      // Start/check fetchers for exports in the list
      exportRows.forEach((exportData) => {
        checkExportFetcher(exportData.uid, exportData.status)
      })

      setRows(exportRows)
      setIsComponentReady(true)
    }
  }, [exportsListQuery.data, exportsListQuery.isSuccess])

  useEffect(() => {
    if (exportsListQuery.isError) {
      setRows([])
      setIsComponentReady(true)
    }
  }, [exportsListQuery.isError])

  /**
   * For `true` it is "Yes", any other (e.g. `false` or missing) is "No"
   */
  function renderBooleanAnswer(isTrue: boolean) {
    if (isTrue) {
      return t('Yes')
    } else {
      return t('No')
    }
  }

  /**
   * Unchecked wisdom copied from old version of this component:
   * > Some old SPSS exports may have a meaningless `lang` attribute -- disregard it
   */
  function renderLanguage(exportLang: ExportDataLang) {
    const exportLangCast = exportLang as keyof typeof EXPORT_FORMATS
    // Unknown happens when export was done for a translated language that
    // doesn't exist in current form version
    let languageDisplay: React.ReactNode = <em>{t('Unknown')}</em>
    const langIndex = getLanguageIndex(props.asset, exportLangCast)
    if (EXPORT_FORMATS[exportLangCast]) {
      // Regardless if there is a translation or not, the export has a label that we can display to the user
      languageDisplay = EXPORT_FORMATS[exportLangCast].label
    } else {
      languageDisplay = exportLangCast
    }
    return languageDisplay
  }

  function getRows() {
    return rows.map((exportData) => {
      let exportType = exportData.data.type

      return [
        EXPORT_TYPES[exportType]?.label || t('Unknown format'),
        formatTime(exportData.date_created),
        renderLanguage(exportData.data.lang),
        <Text key='include-groups' ta='center'>
          {renderBooleanAnswer(exportData.data.hierarchy_in_labels)}
        </Text>,
        <Text key='multiple-versions' ta='center'>
          {renderBooleanAnswer(exportData.data.fields_from_all_versions)}
        </Text>,
        <Flex gap='xs' justify='flex-end' align='center' direction='row' wrap='nowrap' key='buttons'>
          {exportData.status === ExportStatusName.complete && (
            <Button
              type='secondary'
              size='m'
              startIcon='download'
              label={t('Download')}
              onClick={() => {
                if (exportData.result !== null) {
                  window.open(exportData.result, '_blank')
                }
              }}
            />
          )}

          {exportData.status === ExportStatusName.error && (
            <span className='right-tooltip' data-tip={exportData.messages?.error}>
              {t('Export Failed')}
            </span>
          )}

          {exportData.status !== ExportStatusName.complete && exportData.status !== ExportStatusName.error && (
            <span className='animate-processing'>{t('Processing…')}</span>
          )}

          {userCan(PERMISSIONS_CODENAMES.view_submissions, props.asset) && (
            <Button
              type='secondary-danger'
              size='m'
              startIcon='trash'
              isPending={deletingExports.has(exportData.uid)}
              onClick={() => deleteExport(exportData.uid)}
            />
          )}
        </Flex>,
      ]
    })
  }

  if (!isComponentReady) {
    return (
      <bem.FormView__row>
        <bem.FormView__cell>
          <LoadingSpinner />
        </bem.FormView__cell>
      </bem.FormView__row>
    )
  }

  if (rows.length === 0 || props.selectedExportType.isLegacy) {
    return null
  }

  return (
    <React.Fragment>
      <bem.FormView__cell m={['page-subtitle']}>{t('Exports')}</bem.FormView__cell>

      <SimpleTable
        head={[
          t('Type'),
          t('Created'),
          t('Language'),
          <Text key='include-groups' ta='center'>
            {t('Include Groups')}
          </Text>,
          <Text key='multiple-versions' ta='center'>
            {t('Multiple Versions')}
          </Text>,
          '',
        ]}
        body={getRows()}
        minWidth={600}
      />
    </React.Fragment>
  )
}
