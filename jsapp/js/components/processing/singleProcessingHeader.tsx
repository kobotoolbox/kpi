import React from 'react';
import bem from 'js/bem';
import {QuestionTypeName} from 'js/constants';
import TextBox from 'js/components/common/textBox';

bem.SingleProcessingHeader = bem.create('single-processing-header', 'header');

/**
 * this.props.params properties
 */
type SingleProcessingHeaderProps = {
  questionType: QuestionTypeName | undefined
  questionName: string
  submissionId: string
  submissionsIds: string[]
}

/**
 * This route component is being loaded with PermProtectedRoute so we know that
 * the call to backend to get asset was already made :happy_face:
 */
export default class SingleProcessingHeader extends React.Component<SingleProcessingHeaderProps, {}> {
  constructor(props: SingleProcessingHeaderProps) {
    super(props);
  }

  onDone(evt: React.MouseEvent<HTMLButtonElement>) {
    console.log(evt)
  }

  onSubmissionIndexInputChange(newValue: string) {
    console.log(newValue);
  }

  render() {
    return (
      <bem.SingleProcessingHeader>
        <div>icon in a colorful square: {this.props.questionType}</div>

        <div>
          {this.props.submissionsIds.indexOf(this.props.submissionId) + 1} of {this.props.submissionsIds.length}
          {t('Q: ##question_name##').replace('##question_name', this.props.questionName)}
        </div>

        <div>
          <bem.KoboLightButton>
            {t('< prev')}
          </bem.KoboLightButton>

          <TextBox
            type={'number'}
            value={this.props.submissionsIds.indexOf(this.props.submissionId) + 1}
            onChange={this.onSubmissionIndexInputChange.bind(this)}
          />

          <bem.KoboLightButton>
            {t('next >')}
          </bem.KoboLightButton>
        </div>

        <div>
          <bem.KoboLightButton m='blue' onClick={this.onDone.bind(this)}>
            {t('Done')}
          </bem.KoboLightButton>
        </div>
      </bem.SingleProcessingHeader>
    )
  }
}
