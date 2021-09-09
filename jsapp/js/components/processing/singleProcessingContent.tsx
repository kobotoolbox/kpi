import React from 'react';
import bem, {makeBem} from 'js/bem';
import './singleProcessingContent.scss';

bem.SingleProcessingContent = makeBem(null, 'single-processing-content', 'section')
bem.SingleProcessingContent__tabs = makeBem(bem.SingleProcessingContent, 'tabs', 'ul')
bem.SingleProcessingContent__tab = makeBem(bem.SingleProcessingContent, 'tab', 'li')
bem.SingleProcessingContent__body = makeBem(bem.SingleProcessingContent, 'body', 'section')

/**
 * this.props.params properties
 */
type SingleProcessingContentProps = {}

type SingleProcessingContentState = {}

/**
 * This route component is being loaded with PermProtectedRoute so we know that
 * the call to backend to get asset was already made :happy_face:
 */
export default class SingleProcessingContent extends React.Component<
  SingleProcessingContentProps,
  SingleProcessingContentState
> {
  constructor(props: SingleProcessingContentProps) {
    super(props);
    this.state = {}
  }

  render() {
    return (
      <bem.SingleProcessingContent>
        <bem.SingleProcessingContent__tabs>
          <bem.SingleProcessingContent__tab>
            {t('Transcript')}
          </bem.SingleProcessingContent__tab>

          <bem.SingleProcessingContent__tab>
            {t('Translations')}
          </bem.SingleProcessingContent__tab>

          <bem.SingleProcessingContent__tab>
            {t('Coding')}
          </bem.SingleProcessingContent__tab>
        </bem.SingleProcessingContent__tabs>

        <bem.SingleProcessingContent__body>
          content
        </bem.SingleProcessingContent__body>
      </bem.SingleProcessingContent>
    )
  }
}
