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

export const RESTServicesSupportUrl = 'http://help.kobotoolbox.org/managing-your-project-s-data/rest-services';

export default class RESTServices extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      currentAsset: this.props.asset,
      hasServices: true
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
      assetUid: this.state.currentAsset.uid,
      type: 'rest-services',
      rsid: null
    });
  }

  renderButton(additionalClassNames) {
    return (
      <button
        className={`mdl-button mdl-button--raised mdl-button--colored ${additionalClassNames}`}
        onClick={this.openRESTServiceModal}
      >
        {t('Register a New Service')}
      </button>
    );
  }

  render() {
    var docTitle = this.props.asset.name || t('Untitled');

    let classes = 'rest-services';
    if (!this.state.hasServices) {
      classes += ' rest-services--empty';
    }

    return (
      <DocumentTitle title={`${docTitle} | KoboToolbox`}>
        <bem.FormView
          m={'form-settings'}
          className={classes}
        >
          {this.state.hasServices &&
            <RESTServicesList assetUid={this.state.currentAsset.uid} />
          }
          {this.state.hasServices &&
            this.renderButton()
          }

          {!this.state.hasServices &&
            <bem.EmptyContent>
              <bem.EmptyContent__icon className='k-icon-data-sync' />

              <bem.EmptyContent__title>
                {t("This project doesn't have any REST services yet!")}
              </bem.EmptyContent__title>

              <bem.EmptyContent__message>
                {t('You can use REST services to automatically post submissions to a third-party application.')}
                &nbsp;
                <a href={RESTServicesSupportUrl} target='_blank'>{t('Learn more')}</a>
              </bem.EmptyContent__message>

              {this.renderButton('empty-content__button')}
            </bem.EmptyContent>
          }
        </bem.FormView>
      </DocumentTitle>
    );
  }
};
reactMixin(RESTServices.prototype, Reflux.ListenerMixin);
