import React from 'react';
import autoBind from 'react-autobind';
import DocumentTitle from 'react-document-title';
import bem from '../bem';
import stores from '../stores';
import RESTServicesList from './RESTServices/RESTServicesList'
import RESTServiceLogs from './RESTServices/RESTServiceLogs'
import {t} from '../utils';

export const RESTServicesSupportUrl = 'http://help.kobotoolbox.org/managing-your-project-s-data/rest-services';

export default class RESTServices extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      asset: props.asset,
      esid: props.esid
    };
    autoBind(this);
  }

  openNewRESTServiceModal() {
    stores.pageState.showModal({
      assetUid: this.state.asset.uid,
      // esid not provided intentionally
      type: 'rest-services'
    });
  }

  renderModalButton(additionalClassNames) {
    return (
      <button
        className={`mdl-button mdl-button--raised mdl-button--colored ${additionalClassNames}`}
        onClick={this.openNewRESTServiceModal}
      >
        {t('Register a New Service')}
      </button>
    );
  }

  renderListView() {
    // TEMP
    const hasServices = true;

    let classes = 'rest-services';
    if (!hasServices) {classes += ' rest-services--empty';}

    return (
      <bem.FormView m={'form-settings'} className={classes}>
        {hasServices &&
          <RESTServicesList assetUid={this.state.asset.uid} />
        }
        {hasServices &&
          this.renderModalButton()
        }

        {!hasServices &&
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

            {this.renderModalButton('empty-content__button')}
          </bem.EmptyContent>
        }
      </bem.FormView>
    );
  }

  renderServiceLogsView() {
    return (
      <bem.FormView m={'form-settings'} className='rest-services'>
        <RESTServiceLogs assetUid={this.state.asset.uid} esid={this.state.esid} />
      </bem.FormView>
    )
  }

  render() {
    const docTitle = this.props.asset.name || t('Untitled');
    return (
      <DocumentTitle title={`${docTitle} | KoboToolbox`}>
        {this.state.esid ? this.renderServiceLogsView() : this.renderListView()}
      </DocumentTitle>
    );
  }
};
