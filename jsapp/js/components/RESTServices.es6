import React from 'react';
import autoBind from 'react-autobind';
import DocumentTitle from 'react-document-title';
import bem from '../bem';
import stores from '../stores';
import RESTServicesList from './RESTServices/RESTServicesList'
import {t} from '../utils';

export const RESTServicesSupportUrl = 'http://help.kobotoolbox.org/managing-your-project-s-data/rest-services';

export default class RESTServices extends React.Component {
  constructor(props){
    super(props);
    autoBind(this);
  }

  openNewRESTServiceModal(assetUid) {
    stores.pageState.showModal({
      assetUid: assetUid,
      type: 'rest-services',
      rsid: null
    });
  }

  renderModalButton(assetUid, additionalClassNames) {
    return (
      <button
        className={`mdl-button mdl-button--raised mdl-button--colored ${additionalClassNames}`}
        onClick={this.openNewRESTServiceModal.bind(assetUid)}
      >
        {t('Register a New Service')}
      </button>
    );
  }

  renderListView(assetUid) {
    // TEMP
    const hasServices = true;

    let classes = 'rest-services';
    if (!hasServices) {classes += ' rest-services--empty';}

    return (
      <bem.FormView m={'form-settings'} className={classes}>
        {hasServices &&
          <RESTServicesList assetUid={assetUid} />
        }
        {hasServices &&
          this.renderModalButton(assetUid)
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

            {this.renderModalButton(assetUid, 'empty-content__button')}
          </bem.EmptyContent>
        }
      </bem.FormView>
    );
  }

  renderServiceView(assetUid, rsid) {
    return (
      <bem.FormView m={'form-settings'} className='rest-services'>
        {assetUid}/{rsid}
      </bem.FormView>
    )
  }

  render() {
    console.log('RESTServices render', this.props);

    const docTitle = this.props.asset.name || t('Untitled');
    const rsid = this.props.rsid;
    const assetUid = this.props.asset.uid;
    return (
      <DocumentTitle title={`${docTitle} | KoboToolbox`}>
        {rsid ? this.renderServiceView(assetUid, rsid) : this.renderListView(assetUid)}
      </DocumentTitle>
    );
  }
};
