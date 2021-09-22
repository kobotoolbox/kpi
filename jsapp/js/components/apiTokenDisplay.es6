/**
 * For displaying your secret API token
 */

import React from 'react';
import autoBind from 'react-autobind';
import bem from 'js/bem';
import {actions} from 'js/actions';

class ApiTokenDisplay extends React.Component {
  constructor(props) {
    super(props);
    this.HIDDEN_VAL = '*'.repeat(40);
    this.state = {
      token: this.HIDDEN_VAL,
      isLoadingToken: false
    };
    this.unlisteners = [];
    autoBind(this);
  }

  componentDidMount() {
    this.unlisteners.push(
      actions.auth.getApiToken.completed.listen(this.onGetApiTokenCompleted.bind(this)),
      actions.auth.getApiToken.failed.listen(this.onGetApiTokenFailed.bind(this))
    );
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb();});
  }

  onGetApiTokenCompleted(token) {
    this.setState({
      token: token,
      isLoadingToken: false
    });
  }

  onGetApiTokenFailed() {
    this.setState({isLoadingToken: false});
  }

  toggleApiTokenVisibility() {
    this.setState({isTokenVisible: !this.state.isTokenVisible});
    actions.auth.getApiToken();
  }

  onInputFocus(evt) {
    evt.currentTarget.select();
  }

  render() {
    return (
      <bem.FormModal__item m='api-token'>
        <label>{t('API token')}</label>

        <input
          type={this.state.isTokenVisible && !this.state.isLoadingToken ? 'text' : 'password'}
          value={this.state.token}
          onFocus={this.onInputFocus}
          readOnly
        />

        <bem.Button
          onClick={this.toggleApiTokenVisibility}
          disabled={this.state.isLoadingToken}
          m='icon'
        >
          <i className={this.state.isTokenVisible ? 'k-icon k-icon-hide'
                                                  : 'k-icon k-icon-view'}
          />
        </bem.Button>
      </bem.FormModal__item>
    );
  }
}

export default ApiTokenDisplay;
