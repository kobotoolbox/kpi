import React from 'react'
import {RouteComponentProps} from 'react-router'
import {actions} from 'js/actions'
import {
  getSurveyFlatPaths,
  getTranslatedRowLabel
} from 'js/assetUtils'
import assetStore from 'js/assetStore'
import bem, {makeBem} from 'js/bem'
import {AnyRowTypeName} from 'js/constants'
import LoadingSpinner from 'js/components/common/loadingSpinner'
import SingleProcessingHeader from 'js/components/processing/singleProcessingHeader'
import SingleProcessingSubmissionDetails from 'js/components/processing/singleProcessingSubmissionDetails'
import SingleProcessingContent from 'js/components/processing/singleProcessingContent'
import './singleProcessing.scss'

bem.SingleProcessing = makeBem(null, 'single-processing', 'section')
bem.SingleProcessing__top = makeBem(bem.SingleProcessing, 'top', 'section')
bem.SingleProcessing__bottom = makeBem(bem.SingleProcessing, 'bottom', 'section')
bem.SingleProcessing__bottomLeft = makeBem(bem.SingleProcessing, 'bottom-left', 'section')
bem.SingleProcessing__bottomRight = makeBem(bem.SingleProcessing, 'bottom-right', 'section')

type SingleProcessingProps = RouteComponentProps<{
  uid: string,
  questionName: string,
  submissionId: string,
}, {}>

type SingleProcessingState = {
  isSubmissionCallDone: boolean
  isIdsCallDone: boolean
  submissionData: SubmissionResponse | null
  /**
   * A list of all submissions ids, we store `null` for submissions that don't
   * have a response for the question.
   */
  submissionsIds: (string | null)[]
  asset: AssetResponse | undefined
  error: string | null
}

/**
 * This route component is being loaded with PermProtectedRoute so we know that
 * the call to backend to get asset was already made :happy_face:
 */
export default class SingleProcessing extends React.Component<
  SingleProcessingProps,
  SingleProcessingState
> {
  constructor(props: SingleProcessingProps) {
    super(props)
    this.state = {
      isSubmissionCallDone: false,
      isIdsCallDone: false,
      submissionData: null,
      submissionsIds: [],
      asset: assetStore.getAsset(this.props.params.uid),
      error: null,
    }
  }

  private unlisteners: Function[] = []

  componentDidMount() {
    this.unlisteners.push(
      actions.submissions.getSubmission.completed.listen(this.onGetSubmissionCompleted.bind(this)),
      actions.submissions.getSubmission.failed.listen(this.onGetSubmissionFailed.bind(this)),
      actions.submissions.getProcessingSubmissions.completed.listen(this.onGetProcessingSubmissionsCompleted.bind(this)),
      actions.submissions.getProcessingSubmissions.failed.listen(this.onGetProcessingSubmissionsFailed.bind(this)),
    )
    actions.submissions.getSubmission(this.props.params.uid, this.props.params.submissionId)
    this.getNewProcessingSubmissions()
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb()})
  }

  componentDidUpdate(prevProps: SingleProcessingProps) {
    if (prevProps.params.submissionId !== this.props.params.submissionId) {
      this.getNewSubmissionData()
    }
  }

  getNewSubmissionData(): void {
    this.setState({
      isSubmissionCallDone: false,
      submissionData: null,
    })
    actions.submissions.getSubmission(this.props.params.uid, this.props.params.submissionId)
  }

  onGetSubmissionCompleted(response: SubmissionResponse): void {
    this.setState({
      isSubmissionCallDone: true,
      submissionData: response,
    })
  }

  onGetSubmissionFailed(response: FailResponse): void {
    this.setState({
      isSubmissionCallDone: true,
      error: response.responseJSON?.detail || t('Failed to get submission.'),
    })
  }

  getNewProcessingSubmissions(): void {
    const questionFlatPath = this.getQuestionPath()

    if (questionFlatPath === undefined) {
      console.error(t('Insufficient data to fetch submissions for processing!'))
      return
    }

    actions.submissions.getProcessingSubmissions(
      this.props.params.uid,
      questionFlatPath
    )
  }

  onGetProcessingSubmissionsCompleted(response: GetProcessingSubmissionsResponse) {
    const submissionsIds: (string|null)[] = []
    response.results.forEach((result) => {
      // As the returned result object could either be `{_id:1}` or
      // `{_id:1, <quesiton>:any}`, checking the length is Good Enough™.
      if (Object.keys(result).length === 2) {
        submissionsIds.push(String(result._id))
      } else {
        submissionsIds.push(null)
      }
    })

    this.setState({
      isIdsCallDone: true,
      submissionsIds: submissionsIds
    })
  }

  onGetProcessingSubmissionsFailed(response: FailResponse): void {
    this.setState({
      isIdsCallDone: true,
      error: response.responseJSON?.detail || t('Failed to get submissions IDs.'),
    })
  }

  getQuestionPath() {
    let questionFlatPath: string | undefined = undefined
    if (this.state.asset?.content?.survey !== undefined) {
      const flatPaths = getSurveyFlatPaths(this.state.asset.content.survey)
      questionFlatPath = flatPaths[this.props.params.questionName]
    }
    return questionFlatPath
  }

  getQuestionType(): AnyRowTypeName | undefined {
    if (this.state.asset?.content?.survey) {
      const foundRow = this.state.asset.content.survey.find((row) => {
        return [
          row.name,
          row.$autoname,
          row.$kuid
        ].includes(this.props.params.questionName)
      })
      if (foundRow) {
        return foundRow.type
      }
    }
    return undefined
  }

  /** Returns row label (for default language) with fallback to question name. */
  getQuestionLabel(): string {
    if (this.state.asset?.content?.survey) {
      const translatedRowLabel = getTranslatedRowLabel(
        this.props.params.questionName,
        this.state.asset.content.survey,
        0
      )
      if (translatedRowLabel !== null) {
        return translatedRowLabel
      }
    }
    return this.props.params.questionName
  }

  render() {
    if (
      !this.state.isSubmissionCallDone ||
      !this.state.isIdsCallDone ||
      !this.state.asset ||
      !this.state.asset.content ||
      !this.state.asset.content.survey
    ) {
      return (
        <bem.SingleProcessing>
          <LoadingSpinner/>
        </bem.SingleProcessing>
      )
    }

    if (this.state.error !== null) {
      return (
        <bem.SingleProcessing>
          <bem.Loading>
            <bem.Loading__inner>
              {this.state.error}
            </bem.Loading__inner>
          </bem.Loading>
        </bem.SingleProcessing>
      )
    }

    return (
      <bem.SingleProcessing>
        <bem.SingleProcessing__top>
          <SingleProcessingHeader
            questionType={this.getQuestionType()}
            questionName={this.props.params.questionName}
            questionLabel={this.getQuestionLabel()}
            submissionId={this.props.params.submissionId}
            submissionsIds={this.state.submissionsIds}
            assetUid={this.props.params.uid}
          />
        </bem.SingleProcessing__top>

        <bem.SingleProcessing__bottom>
          <bem.SingleProcessing__bottomLeft>
            {this.state.submissionData !== null &&
              <SingleProcessingSubmissionDetails
                questionType={this.getQuestionType()}
                questionName={this.props.params.questionName}
                submissionData={this.state.submissionData}
                assetContent={this.state.asset.content}
              />
            }
          </bem.SingleProcessing__bottomLeft>

          <bem.SingleProcessing__bottomRight>
            <SingleProcessingContent
              questionType={this.getQuestionType()}
            />
          </bem.SingleProcessing__bottomRight>
        </bem.SingleProcessing__bottom>
      </bem.SingleProcessing>
    )
  }
}
