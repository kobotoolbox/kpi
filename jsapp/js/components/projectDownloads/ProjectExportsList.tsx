import { Box, Flex, Text } from '@mantine/core'
import { IconDownload, IconTrash } from '@tabler/icons-react'
import React, { useEffect, useRef, useState } from 'react'
import { assetsExportsRetrieve, useAssetsExportsDestroy, useAssetsExportsList } from '#/api/react-query/survey-data'
import { getLanguageIndex } from '#/assetUtils'
import ActionIcon from '#/components/common/ActionIcon'
import SimpleTable from '#/components/common/SimpleTable'
import LoadingSpinner from '#/components/common/loadingSpinner'
import { PERMISSIONS_CODENAMES } from '#/components/permissions/permConstants'
import { userCan } from '#/components/permissions/utils'
import BooleanCell from '#/components/projectDownloads/BooleanCell'
import ExportTypeBadge from '#/components/projectDownloads/ExportTypeBadge'
import ExportFetcher from '#/components/projectDownloads/exportFetcher'
import {
  EXPORTS_TABLE_COLUMN_WEIGHTS,
  EXPORTS_TABLE_MIN_WIDTH,
  EXPORT_FORMATS,
  ExportStatusName,
  type ExportTypeDefinition,
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
      const exportType = exportData.data.type

      return [
        <ExportTypeBadge exportType={exportType} />,
        exportData.data.name || '–',
        formatTime(exportData.date_created),
        renderLanguage(exportData.data.lang),
        <Box key='include-groups' ta='center'>
          <BooleanCell value={exportData.data.hierarchy_in_labels} />
        </Box>,
        <Box key='multiple-versions' ta='center'>
          <BooleanCell value={exportData.data.fields_from_all_versions} />
        </Box>,
        <Flex gap='xs' justify='flex-end' align='center' direction='row' wrap='nowrap' key='buttons'>
          {exportData.status === ExportStatusName.complete && (
            <ActionIcon
              variant='light'
              size='md'
              icon={IconDownload}
              tooltip={t('Download')}
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
            <ActionIcon
              variant='danger-secondary'
              size='md'
              icon={IconTrash}
              tooltip={t('Delete')}
              loading={deletingExports.has(exportData.uid)}
              onClick={() => deleteExport(exportData.uid)}
            />
          )}
        </Flex>,
      ]
    })
  }

  if (!isComponentReady) {
    return <LoadingSpinner />
  }

  if (rows.length === 0 || props.selectedExportType.isLegacy) {
    return null
  }

  return (
    <React.Fragment>
      <Text fz={18} fw={500} mt={30} mb={15}>
        {t('Exports')}
      </Text>

      <SimpleTable
        head={[
          t('Type'),
          t('Export name'),
          t('Date created'),
          t('Language'),
          <Box key='include-groups' ta='center'>
            {t('Groups')}
          </Box>,
          <Box key='multiple-versions' ta='center'>
            {t('Multiple Versions')}
          </Box>,
          '',
        ]}
        body={getRows()}
        minWidth={EXPORTS_TABLE_MIN_WIDTH}
        columnWeights={EXPORTS_TABLE_COLUMN_WEIGHTS}
      />
    </React.Fragment>
  )
}
