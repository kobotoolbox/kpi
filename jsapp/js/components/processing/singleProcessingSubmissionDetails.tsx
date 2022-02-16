import React from 'react';
import bem, {makeBem} from 'js/bem';
import type {AnyRowTypeName} from 'js/constants';
import {
  QUESTION_TYPES,
  META_QUESTION_TYPES,
  ADDITIONAL_SUBMISSION_PROPS,
} from 'js/constants';
import singleProcessingStore from 'js/components/processing/singleProcessingStore';
import SubmissionDataList from 'js/components/submissions/submissionDataList';
import {
  getRowData,
  getMediaAttachment,
} from 'js/components/submissions/submissionUtils';
import AudioPlayer from 'js/components/common/audioPlayer';
import './singleProcessingSubmissionDetails.scss';

bem.SingleProcessingVideoPreview = makeBem(
  null,
  'single-processing-video-preview',
  'video'
);
bem.SingleProcessingMediaWrapper = makeBem(
  null,
  'single-processing-media-wrapper',
  'section'
);
bem.SingleProcessingDataListWrapper = makeBem(
  null,
  'single-processing-data-list-wrapper',
  'section'
);

interface SingleProcessingSubmissionDetailsProps {
  questionType: AnyRowTypeName | undefined;
  questionName: string;
  assetContent: AssetContent;
}

export default class SingleProcessingSubmissionDetails extends React.Component<
  SingleProcessingSubmissionDetailsProps
> {
  private unlisteners: Function[] = [];

  componentDidMount() {
    this.unlisteners.push(
      singleProcessingStore.listen(this.onSingleProcessingStoreChange, this)
    );
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb();});
  }

  /**
  * Don't want to store a duplicate of store data here just for the sake of
  * comparison, so we need to make the component re-render itself when the
  * store changes :shrug:.
  */
  onSingleProcessingStoreChange() {
    this.forceUpdate();
  }

  /** We want only the processing related data (the actual form questions) */
  getQuestionsToHide(): string[] {
    return [
      this.props.questionName,
      ...Object.keys(ADDITIONAL_SUBMISSION_PROPS),
      ...Object.keys(META_QUESTION_TYPES),
    ];
  }

  renderMedia() {
    // We need submission data.
    const submissionData = singleProcessingStore.getSubmissionData();
    if (!submissionData) {
      return null;
    }

    // We need asset with content.
    if (!this.props.assetContent.survey) {
      return null;
    }

    // We need row data.
    const rowData = getRowData(
      this.props.questionName,
      this.props.assetContent.survey,
      submissionData
    );
    if (rowData === null) {
      return null;
    }

    // Attachment needs to be object with urls.
    const attachment = getMediaAttachment(submissionData, rowData);
    if (typeof attachment === 'string') {
      return;
    }

    switch (this.props.questionType) {
      case QUESTION_TYPES.audio.id:
      case META_QUESTION_TYPES['background-audio']:
        return (
          <bem.SingleProcessingMediaWrapper m='audio' key='audio'>
            <AudioPlayer mediaURL={attachment.download_url} />
          </bem.SingleProcessingMediaWrapper>
        );
      case QUESTION_TYPES.video.id:
        return (
          <bem.SingleProcessingMediaWrapper m='video' key='video'>
            <bem.SingleProcessingVideoPreview
              src={attachment.download_url}
              controls
            />
          </bem.SingleProcessingMediaWrapper>
        );
      default:
        return null;
    }
  }

  renderDataList() {
    const submissionData = singleProcessingStore.getSubmissionData();

    // If submission data is not ready yet, just don't render the list.
    if (!submissionData) {
      return null;
    }

    // If there is a source, we don't want to display these submission details,
    // as we want the most space possible for the source text.
    if (singleProcessingStore.getSourceData() !== undefined) {
      return null;
    }

    return (
      <bem.SingleProcessingDataListWrapper key='data-list'>
        <SubmissionDataList
          assetContent={this.props.assetContent}
          submissionData={submissionData}
          hideQuestions={this.getQuestionsToHide()}
          hideGroups
        />
      </bem.SingleProcessingDataListWrapper>
    );
  }

  render() {
    return (
      [
        this.renderMedia(),
        this.renderDataList(),
      ]
    );
  }
}
