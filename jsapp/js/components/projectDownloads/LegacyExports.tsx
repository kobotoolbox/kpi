import React, { useEffect, useState } from 'react'
import bem from '#/bem'
import InlineMessage from '#/components/common/inlineMessage'
import ExportTypeSelector from '#/components/projectDownloads/ExportTypeSelector'
import {
  EXPORT_TYPES,
  type ExportTypeDefinition,
  type ExportTypeName,
} from '#/components/projectDownloads/exportsConstants'
import exportsStore from '#/components/projectDownloads/exportsStore'
import type { AssetResponse } from '#/dataInterface'

interface LegacyExportsProps {
  asset: AssetResponse
}

/**
 * A component for displaying the legacy exports iframe with an export type selector.
 */
export default function LegacyExports(props: LegacyExportsProps) {
  const [selectedExportType, setSelectedExportType] = useState<ExportTypeDefinition>(exportsStore.getExportType())

  useEffect(() => {
    const unlisten = exportsStore.listen(() => {
      setSelectedExportType(exportsStore.getExportType())
    }, null)

    return () => {
      unlisten()
    }
  }, [])

  const exportType = selectedExportType.value as keyof typeof ExportTypeName

  return (
    <bem.FormView__cell m={['box', 'padding']}>
      <bem.ProjectDownloads__selectorRow>
        <ExportTypeSelector />
      </bem.ProjectDownloads__selectorRow>

      {exportType !== EXPORT_TYPES.zip_legacy.value && (
        <InlineMessage
          type='warning'
          icon='alert'
          message={t(
            'This export format will not be supported in the future. Please consider using one of the other export types available.',
          )}
        />
      )}

      <div className='project-downloads__legacy-iframe-wrapper'>
        <iframe src={props.asset.deployment__data_download_links?.[exportType]} />
      </div>
    </bem.FormView__cell>
  )
}
