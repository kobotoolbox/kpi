/**
 * For displaying your secret API token
 */

import React from 'react';
import autoBind from 'react-autobind';
import bem from 'js/bem';
import {actions} from 'js/actions';
import TextBox from 'js/components/common/textBox';
import Button from 'js/components/common/button';

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

        <TextBox
          customModifiers='on-white'
          type={this.state.isTokenVisible && !this.state.isLoadingToken ? 'text' : 'password'}
          value={this.state.token}
          onFocus={this.onInputFocus}
          readOnly
        />

        <Button
          disabled={this.state.isLoadingToken}
          m='icon'
          type='bare'
          color='storm'
          size='m'
          startIcon={this.state.isTokenVisible ? 'hide' : 'view'}
          onClick={this.toggleApiTokenVisibility}
        />
      </bem.FormModal__item>
    );
  }
}

export default ApiTokenDisplay;
