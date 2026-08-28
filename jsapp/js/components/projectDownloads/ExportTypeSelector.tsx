import React from 'react'
import bem from '#/bem'
import Select from '#/components/common/Select'
import { EXPORT_TYPES, type ExportTypeDefinition } from '#/components/projectDownloads/exportsConstants'

interface ExportTypeSelectorProps {
  selectedExportType: ExportTypeDefinition
  onSelectedExportTypeChange: (newValue: ExportTypeDefinition) => void
  disabled?: boolean
  /** Hides legacy options */
  noLegacy?: boolean
}

/**
 * This selector displays and updates the currently selected export type.
 */
export default function ExportTypeSelector(props: ExportTypeSelectorProps) {
  // make xls topmost (as most popular)
  const exportTypesOptions: ExportTypeDefinition[] = [
    EXPORT_TYPES.xls,
    EXPORT_TYPES.csv,
    EXPORT_TYPES.geojson,
    EXPORT_TYPES.kml,
    EXPORT_TYPES.spss_labels,
  ]

  // legacy options are optional
  if (!props.noLegacy) {
    exportTypesOptions.push(EXPORT_TYPES.csv_legacy)
    exportTypesOptions.push(EXPORT_TYPES.xls_legacy)
    exportTypesOptions.push(EXPORT_TYPES.zip_legacy)
  }

  return (
    <label>
      <bem.ProjectDownloads__title>{t('Select export type')}</bem.ProjectDownloads__title>

      <Select
        value={props.selectedExportType.value}
        data={exportTypesOptions.map(({ value, label }) => ({ value, label }))}
        onChange={(newValue) => {
          // It's not really possible to have `null` here, as `Select` is not clearable.
          if (newValue !== null) {
            props.onSelectedExportTypeChange(EXPORT_TYPES[newValue])
          }
        }}
        clearable={false}
        disabled={props.disabled}
      />
    </label>
  )
}
