import bem from "#/bem"
import AttachmentActionsDropdown from '#/attachments/AttachmentActionsDropdown'
import DeletedAttachment from '#/attachments/deletedAttachment.component'
import AudioPlayer from '#/components/common/audioPlayer'

import type { AssetResponse } from "#/dataInterface"
import type {SubmissionResponse, SurveyRow} from "#/dataInterface"
import {hasBackgroundAudioEnabled} from "#/assetUtils"
import {getBackgroundAudioAttachment} from "./submissionUtils"

interface SubmissionBackgroundAudioProps {
  asset: AssetResponse
  submission: SubmissionResponse
  survey: SurveyRow[]
  onDeleted: (bgAudio: string) => void
}

export default function SubmissionBackgroundAudio(props: SubmissionBackgroundAudioProps) {
	  // For TypeScript
    if (!props.submission) {
      return null
    }

    if (!hasBackgroundAudioEnabled(props.survey)) {
      return null
    }

    // Get background audio
    const bgAudio = getBackgroundAudioAttachment(props.asset, props.submission)

    const isDeleted = Boolean(bgAudio?.is_deleted)

    return (
      <bem.SubmissionDataTable>
        <bem.SubmissionDataTable__row m={['columns', 'column-names']}>
          <bem.SubmissionDataTable__column>{t('Background audio recording')}</bem.SubmissionDataTable__column>
        </bem.SubmissionDataTable__row>

        <bem.SubmissionDataTable__row m={['columns', 'response', 'type-audio']}>
          {bgAudio && !isDeleted && (
            <bem.SubmissionDataTable__column m={['data', 'type-audio']}>
              <AudioPlayer mediaURL={bgAudio.download_medium_url || bgAudio.download_url} />

              <AttachmentActionsDropdown
                asset={props.asset}
                attachmentUid={bgAudio.uid}
                submissionData={props.submission}
                onDeleted={() => {
                  props.onDeleted(bgAudio.uid)
                }}
              />
            </bem.SubmissionDataTable__column>
          )}

          {bgAudio && isDeleted && (
            <bem.SubmissionDataTable__column m='data'>
              <DeletedAttachment />
            </bem.SubmissionDataTable__column>
          )}

          {!bgAudio && <bem.SubmissionDataTable__column m='data'>{t('N/A')}</bem.SubmissionDataTable__column>}
        </bem.SubmissionDataTable__row>
      </bem.SubmissionDataTable>
  )
}
