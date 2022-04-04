import React from 'react';
import bem from 'js/bem';
import './loadingSpinner.scss';
import Icon from 'js/components/common/icon'

type LoadingSpinnerProps = {
  message?: string
  /**
   * Most of the times we want a message, either custom or default one, but
   * sometimes we want just the spinner.
   */
  hideMessage?: boolean
}

export default class LoadingSpinner extends React.Component<LoadingSpinnerProps, {}> {
  render() {
    const message = this.props.message || t('loading…');

    return (
      <bem.Loading>
        <bem.Loading__inner>
          <Icon name='spinner' size='xl' classNames={['k-spin']}/>
          {!this.props.hideMessage && message}
        </bem.Loading__inner>
      </bem.Loading>
    );
  }
}
