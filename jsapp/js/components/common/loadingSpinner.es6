import React from 'react';
import bem from 'js/bem';
import './loadingSpinner.scss';

/**
 * @prop {string} [message] optional message
 */
export default class LoadingSpinner extends React.Component {
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
