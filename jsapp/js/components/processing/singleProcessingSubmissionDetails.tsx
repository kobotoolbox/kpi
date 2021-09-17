import React from 'react'
import bem, {makeBem} from 'js/bem'
import {
  AnyRowTypeName,
  QUESTION_TYPES,
  META_QUESTION_TYPES,
} from 'js/constants'
import SubmissionDataList from 'js/components/submissions/submissionDataList'
import {
  getRowData,
  getMediaAttachment,
} from 'js/components/submissions/submissionUtils'
import AudioPlayer from 'js/components/common/audioPlayer'
import './singleProcessingSubmissionDetails.scss'

bem.SingleProcessingSubmissionDetails = makeBem(null, 'single-processing-submission-details', 'section')
bem.SingleProcessingSubmissionDetails__mediaWrapper = makeBem(bem.SingleProcessingSubmissionDetails, 'media-wrapper', 'section')

type SingleProcessingSubmissionDetailsProps = {
  questionType: AnyRowTypeName | undefined
  questionName: string
  assetContent: AssetContent
  submissionData: SubmissionResponse
}

type SingleProcessingSubmissionDetailsState = {}

export default class SingleProcessingSubmissionDetails extends React.Component<
  SingleProcessingSubmissionDetailsProps,
  SingleProcessingSubmissionDetailsState
> {
  constructor(props: SingleProcessingSubmissionDetailsProps) {
    super(props)
    this.state = {}
  }

  renderMedia() {
    if (
      !this.props.assetContent.survey ||
      (
        this.props.questionType !== QUESTION_TYPES.audio.id &&
        this.props.questionType !== META_QUESTION_TYPES['background-audio']
      )
    ) {
      return null
    }

    const rowData = getRowData(
      this.props.questionName,
      this.props.assetContent.survey,
      this.props.submissionData
    )

    if (rowData === null) {
      return null
    }

    const attachment = getMediaAttachment(this.props.submissionData, rowData)

    if (typeof attachment === 'string') {
      return
    }

    return (
      <bem.SingleProcessingSubmissionDetails__mediaWrapper>
        <AudioPlayer mediaURL={attachment.download_url} />
      </bem.SingleProcessingSubmissionDetails__mediaWrapper>
    )
  }

  render() {
    return (
      <bem.SingleProcessingSubmissionDetails>
        {this.renderMedia()}
        <SubmissionDataList
          assetContent={this.props.assetContent}
          submissionData={this.props.submissionData}
        />
      </bem.SingleProcessingSubmissionDetails>
    )
  }
}
