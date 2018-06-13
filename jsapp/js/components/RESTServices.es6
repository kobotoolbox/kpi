import React from 'react';
import Reflux from 'reflux';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import bem from '../bem';
import actions from '../actions';
import stores from '../stores';
import Select from 'react-select';
import RESTServicesList from './RESTServices/RESTServicesList'
import {t} from '../utils';

import DocumentTitle from 'react-document-title';

export default class RESTServices extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      currentAsset: this.props.asset,
      services: false
    };
    autoBind(this);
  }

  componentDidMount() {
    console.log('RESTServices mounted', this.state);
    this.listenTo(stores.asset, this.onAssetChange);
  }

  onAssetChange(data) {
    if (data.assetUid === this.state.currentAsset.uid) {
      this.setState({
        isAwaitingAssetChange: false,
        isCopyFormVisible: false
      });
    }
  }

  openRESTServiceModal() {
    stores.pageState.showModal({
      type: 'rest-services',
      sid: false
    });
  }

  render () {
    var docTitle = this.props.asset.name || t('Untitled');

    let classes = 'rest-services';
    if (!this.state.service) {
      classes += ' rest-services--empty';
    }

    return (
      <DocumentTitle title={`${docTitle} | KoboToolbox`}>
        <bem.FormView
          m={'form-settings'}
          className={classes}
        >
          {!this.state.services &&
            <RESTServicesList />
          }

          {!this.state.services &&
            <bem.EmptyContent>
              <bem.EmptyContent__icon className='k-icon-settings' />

              <bem.EmptyContent__title>
                {t('This project does not have any REST services yet!')}
              </bem.EmptyContent__title>

              <bem.EmptyContent__message>
                {t('You can use REST services to automatically post submissions to a third-party application.')}
                &nbsp;
                <a href='#TODO'>{t('Learn more')}</a>
              </bem.EmptyContent__message>
            </bem.EmptyContent>
          }

          <button
            className='mdl-button mdl-button--raised mdl-button--colored'
            onClick={this.openRESTServiceModal}
          >
            {t('Register a New Service')}
          </button>
        </bem.FormView>
      </DocumentTitle>
    );
  }
};
reactMixin(RESTServices.prototype, Reflux.ListenerMixin);
