import { Box, Group } from '@mantine/core'
import React from 'react'
import type { AssetsDataListParams } from '#/api/models/assetsDataListParams'
import {
  type assetsDataListResponse,
  getAssetsDataListQueryKey,
  useAssetsDataList,
} from '#/api/react-query/survey-data'
import { getCountryDisplayString, getSectorDisplayString } from '#/assetUtils'
import AssetStatusBadge from '#/components/common/assetStatusBadge'
import Avatar from '#/components/common/avatar'
import { EXTRA_PROJECT_METADATA_FIELD_TYPES } from '#/constants'
import type { AssetResponse } from '#/dataInterface'
import envStore from '#/envStore'
import { currentLang, formatTime } from '#/utils'
import styles from './FormSummary.module.scss'
import SummarySection from './SummarySection'

interface FormSummaryProjectInfoProps {
  asset: AssetResponse
}

/** The newest submission, with only the fields we show. */
const LATEST_SUBMISSION_PARAMS: AssetsDataListParams = {
  limit: 1,
  start: 0,
  sort: JSON.stringify({ _id: -1 }),
  fields: JSON.stringify(['_id', 'end']),
}

/** `end` of the newest submission. Only forms with the `end` meta question have it. */
function selectLatestSubmissionEnd(response: assetsDataListResponse) {
  // TODO: stop casting after backend openAPI task DEV-1727 is done, `DataResponse` has no question fields
  const latest =
    response.status === 200 ? (response.data.results[0] as unknown as Record<string, unknown> | undefined) : undefined
  return typeof latest?.end === 'string' ? latest.end : undefined
}

// Both InfoGroup and InfoItem are too small to justify a file of its own, sorry

/** A row of items, divided from the one above. */
function InfoGroup(props: { children: React.ReactNode }) {
  return (
    <Group gap={0} className={styles.infoGroup}>
      {props.children}
    </Group>
  )
}

function InfoItem(props: { label: string; children: React.ReactNode }) {
  return (
    <Box className={styles.infoItem}>
      <Box className={styles.infoLabel}>{props.label}</Box>
      {props.children}
    </Box>
  )
}

export default function FormSummaryProjectInfo(props: FormSummaryProjectInfoProps) {
  const latestSubmissionDate = useAssetsDataList(props.asset.uid, LATEST_SUBMISSION_PARAMS, {
    query: {
      queryKey: getAssetsDataListQueryKey(props.asset.uid, LATEST_SUBMISSION_PARAMS),
      // It fails with 400 when there are no submissions
      enabled: props.asset.deployment__submission_count > 0,
      select: selectLatestSubmissionEnd,
    },
  }).data

  const lastDeployedDate = props.asset.deployed_versions?.results?.[0]?.date_modified

  // Support custom labels for project metadata, if defined
  const metadata = envStore.data.getProjectMetadataFieldsAsSimpleDict()

  // Compute display values for all extra metadata fields
  const extraMetadata = props.asset.settings.extra_metadata ?? {}
  const lang = currentLang()
  const extraFields = envStore.data.extra_project_metadata_fields.map((field) => {
    const value = extraMetadata[field.name]
    let displayValue: string

    if (field.type === EXTRA_PROJECT_METADATA_FIELD_TYPES.SINGLE_SELECT) {
      const opt = field.options?.find((o) => o.name === value)
      displayValue = opt ? envStore.data.getExtraFieldLabel(opt, lang) : String(value ?? '') || '-'
    } else if (field.type === EXTRA_PROJECT_METADATA_FIELD_TYPES.MULTI_SELECT) {
      const values = Array.isArray(value) ? value : []
      displayValue =
        values
          .map((v) => {
            const opt = field.options?.find((o) => o.name === v)
            return opt ? envStore.data.getExtraFieldLabel(opt, lang) : v
          })
          .join(', ') || '-'
    } else {
      displayValue = String(value ?? '') || '-'
    }

    return { field, displayValue }
  })

  return (
    <SummarySection title={t('Project information')}>
      {metadata.description && (
        <InfoGroup>
          <InfoItem label={metadata.description.label ?? t('Description')}>
            <div dir='auto'>{props.asset.settings.description || '-'}</div>
          </InfoItem>
        </InfoGroup>
      )}

      <InfoGroup>
        <InfoItem label={t('Status')}>
          <AssetStatusBadge deploymentStatus={props.asset.deployment_status} />
        </InfoItem>

        <InfoItem label={t('Questions')}>{props.asset.summary.row_count || '-'}</InfoItem>

        <InfoItem label={t('Owner')}>
          <Avatar username={props.asset.owner_label} size='s' isUsernameVisible />
        </InfoItem>

        <InfoItem label={t('Last edited')}>
          {props.asset.last_modified_by !== null && (
            <Avatar username={props.asset.last_modified_by} size='s' isUsernameVisible />
          )}
        </InfoItem>
      </InfoGroup>

      <InfoGroup>
        <InfoItem label={t('Last modified')}>
          {props.asset.date_modified ? formatTime(props.asset.date_modified) : '-'}
        </InfoItem>

        <InfoItem label={t('Last deployed')}>{lastDeployedDate ? formatTime(lastDeployedDate) : '-'}</InfoItem>

        {latestSubmissionDate && <InfoItem label={t('Latest submission')}>{formatTime(latestSubmissionDate)}</InfoItem>}
      </InfoGroup>

      {(metadata.sector || metadata.country) && (
        <InfoGroup>
          {metadata.sector && (
            <InfoItem label={metadata.sector.label ?? t('Sector')}>{getSectorDisplayString(props.asset)}</InfoItem>
          )}

          {metadata.country && (
            <InfoItem label={metadata.country.label ?? t('Countries')}>{getCountryDisplayString(props.asset)}</InfoItem>
          )}
        </InfoGroup>
      )}

      {extraFields.length > 0 && (
        <InfoGroup>
          {extraFields.map(({ field, displayValue }) => (
            <InfoItem key={field.name} label={envStore.data.getExtraFieldLabel(field, lang)}>
              {displayValue}
            </InfoItem>
          ))}
        </InfoGroup>
      )}

      {props.asset.summary?.languages && props.asset.summary.languages.length > 1 && (
        <InfoGroup>
          <InfoItem label={t('Languages')}>
            {props.asset.summary.languages.map((language, index) => (
              <div key={`lang-${index}`}>
                {/* Unnamed languages arrive as null, and a blank row hides why the form won't open in Formbuilder */}
                {language || t('Unnamed language')}
              </div>
            ))}
          </InfoItem>
        </InfoGroup>
      )}

      {(metadata.operational_purpose || metadata.collects_pii) && (
        <InfoGroup>
          {metadata.operational_purpose && (
            <InfoItem label={metadata.operational_purpose.label ?? t('Operational purpose of data')}>
              {props.asset.settings.operational_purpose?.label ?? '-'}
            </InfoItem>
          )}
          {metadata.collects_pii && (
            <InfoItem label={metadata.collects_pii.label ?? t('Collects personally identifiable information')}>
              {props.asset.settings.collects_pii?.label ?? '-'}
            </InfoItem>
          )}
        </InfoGroup>
      )}
    </SummarySection>
  )
}
