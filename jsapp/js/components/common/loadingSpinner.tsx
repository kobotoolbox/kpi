import React from 'react';
import bem from 'js/bem';
import './loadingSpinner.scss';
import Icon from 'js/components/common/icon'

type LoadingSpinnerProps = {
  message?: string
}

export default class LoadingSpinner extends React.Component<LoadingSpinnerProps, {}> {
  render() {
    const message = this.props.message || t('loading…');

    return (
      <bem.Loading>
        <bem.Loading__inner>
          <Icon name='spinner' size='xl' classNames={['k-spin']}/>
          {message}
        </bem.Loading__inner>
      </bem.Loading>
    );
  }
}
