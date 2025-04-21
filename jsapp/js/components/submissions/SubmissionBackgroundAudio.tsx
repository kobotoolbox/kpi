import { hasBackgroundAudioEnabled } from '#/assetUtils'
import AttachmentActionsDropdown from '#/attachments/AttachmentActionsDropdown'
import DeletedAttachment from '#/attachments/deletedAttachment.component'
import bem from '#/bem'
import AudioPlayer from '#/components/common/audioPlayer'
import type { AssetResponse, SubmissionAttachment } from '#/dataInterface'
import type { SubmissionResponse } from '#/dataInterface'

interface SubmissionBackgroundAudioProps {
  asset: AssetResponse
  submission: SubmissionResponse
  audio: SubmissionAttachment
  onDeleted: () => void
}

export default function SubmissionBackgroundAudio(props: SubmissionBackgroundAudioProps) {
  const survey = props.asset.content?.survey

  if (!survey) {
    return null
  }

  // For TypeScript
  if (!props.submission) {
    return null
  }

  // TODO: Remove this check after we get single submission modal to always display background audio
  if (!hasBackgroundAudioEnabled(survey)) {
    return null
  }

  const isDeleted = Boolean(props.audio?.is_deleted)

  return (
    <bem.SubmissionDataTable>
      <bem.SubmissionDataTable__row m={['columns', 'column-names']}>
        <bem.SubmissionDataTable__column>{t('Background audio recording')}</bem.SubmissionDataTable__column>
      </bem.SubmissionDataTable__row>

      <bem.SubmissionDataTable__row m={['columns', 'response', 'type-audio']}>
        {props.audio && !isDeleted && (
          <bem.SubmissionDataTable__column m={['data', 'type-audio']}>
            <AudioPlayer mediaURL={props.audio.download_medium_url || props.audio.download_url} />

            <AttachmentActionsDropdown
              asset={props.asset}
              attachmentUid={props.audio.uid}
              submissionData={props.submission}
              onDeleted={() => {
                props.onDeleted()
              }}
            />
          </bem.SubmissionDataTable__column>
        )}

        {props.audio && isDeleted && (
          <bem.SubmissionDataTable__column m='data'>
            <DeletedAttachment />
          </bem.SubmissionDataTable__column>
        )}

        {!props.audio && <bem.SubmissionDataTable__column m='data'>{t('N/A')}</bem.SubmissionDataTable__column>}
      </bem.SubmissionDataTable__row>
    </bem.SubmissionDataTable>
  )
}
