import React from 'react';
import autoBind from 'react-autobind';
import reactMixin from 'react-mixin';
import Reflux from 'reflux';
import alertify from 'alertifyjs';
import stores from '../../stores';
import actions from '../../actions';
import {dataInterface} from '../../dataInterface';
import bem from '../../bem';
import {t} from '../../utils';
import {MODAL_TYPES} from '../../constants';

const RESTServicesSupportUrl = 'http://help.kobotoolbox.org/managing-your-project-s-data/rest-services';

export default class RESTServicesList extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      isLoadingServices: true,
      assetUid: props.assetUid,
      services: []
    };
    autoBind(this);
  }

  componentDidMount() {
    this.listenTo(
      actions.externalServices.getAll.completed,
      this.onExternalServicesUpdate
    );

    actions.externalServices.getAll(
      this.state.assetUid,
      {
        onComplete: (data) => {
          this.setState({
            isLoadingServices: false,
            services: data.results
          });
        },
        onFail: (data) => {
          this.setState({
            isLoadingServices: false
          });
          alertify.error(t('Could not load REST Services'));
        }
      }
    );
  }

  onExternalServicesUpdate(data) {
    this.setState({
      isLoadingServices: false,
      services: data.results
    })
  }

  editService(evt) {
    stores.pageState.showModal({
      assetUid: this.state.assetUid,
      type: MODAL_TYPES.REST_SERVICES,
      hookUid: evt.currentTarget.dataset.hookUid
    });
  }

  deleteServiceSafe(evt) {
    const serviceName = evt.currentTarget.dataset.serviceName;
    const servicehookUid = evt.currentTarget.dataset.hookUid;
    if (this.state.assetUid) {
      const dialog = alertify.dialog('confirm');
      const message = t('You are about to delete ##target. This action cannot be undone.')
        .replace('##target', `<strong>${serviceName}</strong>`);
      let dialogOptions = {
        title: t(`Are you sure you want to delete ${serviceName}?`),
        message: message,
        labels: { ok: t('Confirm'), cancel: t('Cancel') },
        onok: () => {
          actions.externalServices.delete(
            this.state.assetUid,
            servicehookUid, {
              onFail: () => {
                alertify.error(t('Could not delete REST Service'));
              }
            }
          );
        },
        oncancel: () => {
          dialog.destroy();
        }
      };
      dialog.set(dialogOptions).show();
    }
  }

  openNewRESTServiceModal() {
    stores.pageState.showModal({
      assetUid: this.state.assetUid,
      // hookUid: not provided intentionally
      type: MODAL_TYPES.REST_SERVICES
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

  renderEmptyView() {
    return (
      <bem.FormView m={'form-settings'} className='rest-services rest-services--empty'>
        <bem.EmptyContent>
          <bem.EmptyContent__icon className='k-icon-data-sync' />

          <bem.EmptyContent__title>
            {t("This project doesn't have any REST Services yet!")}
          </bem.EmptyContent__title>

          <bem.EmptyContent__message>
            {t('You can use REST Services to automatically post submissions to a third-party application.')}
            &nbsp;
            <a href={RESTServicesSupportUrl} target='_blank'>{t('Learn more')}</a>
          </bem.EmptyContent__message>

          {this.renderModalButton('empty-content__button')}
        </bem.EmptyContent>
      </bem.FormView>
    )
  }

  renderListView() {
    return (
      <bem.FormView m={'form-settings'} className='rest-services'>
        <bem.FormView__cell m='rest-services-list'>
          <header className='rest-services-list__header'>
            <h2 className='rest-services-list__header-label'>
              {t('REST Services: ##number##').replace('##number##', this.state.services.length)}
            </h2>

            <a
              className='rest-services-list__header-help-link rest-services-list__header-right'
              href={RESTServicesSupportUrl}
              target='_blank'
            >
              <i className='k-icon k-icon-help' />
              {t('Need help?')}
            </a>
          </header>

          <bem.FormView__cell m={['box']}>
            <bem.ServiceRow m='header'>
              <bem.ServiceRow__column m='name'>{t('Service Name')}</bem.ServiceRow__column>
              <bem.ServiceRow__column m='count'>{t('Count')}</bem.ServiceRow__column>
              <bem.ServiceRow__column m='actions' />
            </bem.ServiceRow>

            {this.state.services.map((item, n) => {
              return (
                <bem.ServiceRow key={item.uid} m={item.active ? 'active' : 'inactive'}>
                  <bem.ServiceRow__column m='name'>
                    <a href={`/#/forms/${this.state.assetUid}/settings/rest/${item.uid}`}>{item.name}</a>
                  </bem.ServiceRow__column>

                  <bem.ServiceRow__column m='count'>
                    {item.success_count + item.failed_count}
                    {item.failed_count > 1 &&
                      <span className='service-row__error'>
                        {t(' (##number## failed)').replace('##number##', item.failed_count)}
                      </span>
                    }
                  </bem.ServiceRow__column>

                  <bem.ServiceRow__column m='actions'>
                    <bem.ServiceRow__actionButton
                      onClick={this.editService}
                      data-hook-uid={item.uid}
                      data-tip={t('Edit')}
                    >
                      <i className='k-icon-edit' />
                    </bem.ServiceRow__actionButton>

                    <bem.ServiceRow__actionButton
                      onClick={this.deleteServiceSafe.bind(this)}
                      data-service-name={item.name}
                      data-hook-uid={item.uid}
                      data-tip={t('Delete')}
                    >
                      <i className='k-icon-trash' />
                    </bem.ServiceRow__actionButton>
                  </bem.ServiceRow__column>
                </bem.ServiceRow>
              );
            })}
          </bem.FormView__cell>
        </bem.FormView__cell>

        {this.renderModalButton()}
      </bem.FormView>
    );
  }

  render() {
    if (this.state.isLoadingServices) {
      return (
        <bem.Loading>
          <bem.Loading__inner>
            <i />
            {t('loading...')}
          </bem.Loading__inner>
        </bem.Loading>
      )
    } else if (this.state.services.length === 0) {
      return this.renderEmptyView();
    } else {
      return this.renderListView();
    }
  }
}

reactMixin(RESTServicesList.prototype, Reflux.ListenerMixin);
