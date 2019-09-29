/**
 * For displaying your secret API token
 */

import React from 'react';
import autoBind from 'react-autobind';
import actions from 'js/actions';
import {t} from 'js/utils';
import TextBox from 'js/components/textBox';

class ApiTokenDisplay extends React.Component {
  constructor(props) {
    super(props);
    this.HIDDEN_VAL = '*'.repeat(8);
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

  showApiToken() {
    this.setState({isLoadingToken: true});
    actions.auth.getApiToken();
  }

  render() {
    return (
      <div>
        <TextBox
          label={t('API token')}
          value={this.state.token}
          readOnly
        />

        <button
          onClick={this.showApiToken}
          disabled={this.state.token !== this.HIDDEN_VAL}
          className='mdl-button mdl-button--icon'
        >
          <i className='k-icon k-icon-view'/>
        </button>
      </div>
    );
  }
}

export default ApiTokenDisplay;
