import { Pill, type PillProps } from '@mantine/core'
import React from 'react'
import { EXPORT_TYPES, ExportTypeName } from '#/components/projectDownloads/exportsConstants'

const EXPORT_TYPE_VARIANTS: Record<ExportTypeName, NonNullable<PillProps['variant']>> = {
  [ExportTypeName.xls]: 'blue-light',
  [ExportTypeName.xls_legacy]: 'blue-light',
  [ExportTypeName.csv]: 'teal-light',
  [ExportTypeName.csv_legacy]: 'teal-light',
  [ExportTypeName.geojson]: 'teal-light',
  [ExportTypeName.kml]: 'teal-light',
  [ExportTypeName.spss_labels]: 'gray-light',
  [ExportTypeName.zip_legacy]: 'amber-light',
}

interface ExportTypeBadgeProps {
  exportType: ExportTypeName | undefined
}

export default function ExportTypeBadge({ exportType }: ExportTypeBadgeProps) {
  const label = exportType ? (EXPORT_TYPES[exportType]?.label ?? t('Unknown format')) : t('Unknown format')
  const variant = exportType ? EXPORT_TYPE_VARIANTS[exportType] : 'gray-light'

  return (
    <Pill variant={variant} size='sm'>
      {label}
    </Pill>
  )
}
