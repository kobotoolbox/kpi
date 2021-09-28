import React from 'react';
import bem from 'js/bem';
import './loadingSpinner.scss';

type LoadingSpinnerProps = {
  message?: string
}

export default class LoadingSpinner extends React.Component<LoadingSpinnerProps, {}> {
  render() {
    const message = this.props.message || t('loading…');

    return (
      <bem.Loading>
        <bem.Loading__inner>
          <i className='k-spin k-icon k-icon-spinner'/>
          {message}
        </bem.Loading__inner>
      </bem.Loading>
    );
  }
}
