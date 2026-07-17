import React, { useEffect, useState } from 'react'

import Select from 'react-select'
import bem from '#/bem'
import { EXPORT_TYPES, type ExportTypeDefinition } from '#/components/projectDownloads/exportsConstants'
import exportsStore from '#/components/projectDownloads/exportsStore'

interface ExportTypeSelectorProps {
  disabled?: boolean
  /** Hides legacy options */
  noLegacy?: boolean
}

/**
 * This is a selector that is handling the currently selected export type and
 * is storing it in exportsStore.
 */
export default function ExportTypeSelector(props: ExportTypeSelectorProps) {
  const [selectedExportType, setSelectedExportType] = useState<ExportTypeDefinition>(exportsStore.getExportType())

  useEffect(() => {
    const unlisten = exportsStore.listen(() => {
      setSelectedExportType(exportsStore.getExportType())
    }, null)

    return () => {
      unlisten()
    }
  }, [])

  function onSelectedExportTypeChange(newValue: ExportTypeDefinition | null) {
    // It's not really possible to have `null` here, as Select requires a value
    // to always be set.
    if (newValue !== null) {
      exportsStore.setExportType(newValue)
    }
  }

  // make xls topmost (as most popular)
  const exportTypesOptions: ExportTypeDefinition[] = [
    EXPORT_TYPES.xls,
    EXPORT_TYPES.csv,
    EXPORT_TYPES.geojson,
    EXPORT_TYPES.spss_labels,
  ]

  // legacy options are optional
  if (!props.noLegacy) {
    exportTypesOptions.push(EXPORT_TYPES.csv_legacy)
    exportTypesOptions.push(EXPORT_TYPES.kml_legacy)
    exportTypesOptions.push(EXPORT_TYPES.xls_legacy)
    exportTypesOptions.push(EXPORT_TYPES.zip_legacy)
  }

  return (
    <label>
      <bem.ProjectDownloads__title>{t('Select export type')}</bem.ProjectDownloads__title>

      <Select<ExportTypeDefinition>
        value={selectedExportType}
        options={exportTypesOptions}
        onChange={onSelectedExportTypeChange}
        className='kobo-select'
        classNamePrefix='kobo-select'
        menuPlacement='auto'
        isSearchable={false}
        isDisabled={props.disabled}
      />
    </label>
  )
}
