import { Group } from '@mantine/core'
import { IconArrowUpRight } from '@tabler/icons-react'
import ButtonNew from '#/components/common/ButtonNew'
import { getSupplementalPathParts } from '#/components/processing/processingUtils'
import { ProcessingTab, goToProcessing } from '#/components/processing/routes.utils'
import type { AssetResponse, SubmissionResponse } from '#/dataInterface'
import { removeDefaultUuidPrefix } from '#/utils'
import { getSupplementalDetailsContent, hasUnacceptedAutomaticContent } from '../submissionUtils'
import TextModalCell from './TextModalCell'

interface SupplementalDetailsCellProps {
  asset: AssetResponse
  submission: SubmissionResponse
  columnKey: string
  columnName: string
  submissionIndex: number
  submissionTotal: number
}

/**
 * Displays supplemental details (transcript, translation, or qual) with optional
 * Review button for unaccepted automatic content.
 */
export default function SupplementalDetailsCell(props: SupplementalDetailsCellProps) {
  const supplementalValue = getSupplementalDetailsContent(props.submission, props.columnKey) || ''
  const hasUnacceptedContent = hasUnacceptedAutomaticContent(props.submission, props.columnKey)

  // Verification questions don't need modal or review button
  if (props.columnKey.endsWith('verified')) {
    return <Group h='100%'>{supplementalValue}</Group>
  }

  const handleReviewClick = () => {
    const pathParts = getSupplementalPathParts(props.columnKey)
    const submissionEditId = removeDefaultUuidPrefix(props.submission['meta/rootUuid']) || props.submission._uuid

    // Determine the target tab based on content type
    const targetTab = pathParts.type === 'transcript' ? ProcessingTab.Transcript : ProcessingTab.Translations

    // Navigate to the appropriate processing view
    goToProcessing(props.asset.uid, pathParts.sourceRowPath, submissionEditId, targetTab)
  }

  // If this cell has unaccepted automatic content, show Review button
  if (hasUnacceptedContent) {
    return (
      <ButtonNew variant='light' size='sm' onClick={handleReviewClick} rightIcon={IconArrowUpRight}>
        {t('Review')}
      </ButtonNew>
    )
  }

  // Default: just show the text modal
  return (
    <TextModalCell
      text={supplementalValue}
      columnName={props.columnName}
      submissionIndex={props.submissionIndex}
      submissionTotal={props.submissionTotal}
    />
  )
}
