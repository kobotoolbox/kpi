import React from 'react';
import bem from 'js/bem';
import './loadingSpinner.scss';
import Icon from 'js/components/common/icon';

interface LoadingSpinnerProps {
  message?: string;
  /**
   * Most of the times we want a message, either custom or default one, but
   * sometimes we want just the spinner.
   */
  hideMessage?: boolean;
  classNames?: string[];
  'data-cy'?: string;
}

export default class LoadingSpinner extends React.Component<LoadingSpinnerProps, {}> {
  render() {
    const message = this.props.message || t('loading…');
    const classNames = this.props.classNames || [];

    return (
      <bem.Loading data-cy={this.props['data-cy']} className={classNames.join(' ')}>
        <bem.Loading__inner>
          <Icon name='spinner' size='xl' classNames={['k-spin']}/>
          {!this.props.hideMessage && message}
        </bem.Loading__inner>
      </bem.Loading>
    );
  }
}
