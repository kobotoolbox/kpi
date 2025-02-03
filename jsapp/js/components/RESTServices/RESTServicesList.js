import React from 'react';
import autoBind from 'react-autobind';
import reactMixin from 'react-mixin';
import Reflux from 'reflux';
import alertify from 'alertifyjs';
import {actions} from '../../actions';
import bem from 'js/bem';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import {MODAL_TYPES} from '../../constants';
import envStore from 'js/envStore';
import {
  notify,
  escapeHtml,
} from 'js/utils';
import pageState from 'js/pageState.store';
import Button from 'js/components/common/button';

const REST_SERVICES_SUPPORT_URL = 'rest_services.html';

export default class RESTServicesList extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      isLoadingHooks: true,
      assetUid: props.assetUid,
      hooks: []
    };
    autoBind(this);
  }

  componentDidMount() {
    this.listenTo(
      actions.hooks.getAll.completed,
      this.onHooksUpdate
    );

    actions.hooks.getAll(
      this.state.assetUid,
      {
        onComplete: (data) => {
          this.setState({
            isLoadingHooks: false,
            hooks: data.results
          });
        },
        onFail: (data) => {
          this.setState({
            isLoadingHooks: false
          });
          notify.error(t('Could not load REST Services'));
        }
      }
    );
  }

  onHooksUpdate(data) {
    this.setState({
      isLoadingHooks: false,
      hooks: data.results
    })
  }

  editHook(hookUid) {
    pageState.showModal({
      assetUid: this.state.assetUid,
      type: MODAL_TYPES.REST_SERVICES,
      hookUid: hookUid
    });
  }

  deleteHookSafe(hookUid, hookName) {
    if (this.state.assetUid) {
      const dialog = alertify.dialog('confirm');
      const title = t('Are you sure you want to delete ##target?')
        .replace('##target', escapeHtml(hookName));
      const message = t('You are about to delete ##target. This action cannot be undone.')
        .replace('##target', `<strong>${escapeHtml(hookName)}</strong>`);
      let dialogOptions = {
        title: title,
        message: message,
        labels: { ok: t('Confirm'), cancel: t('Cancel') },
        onok: () => {
          actions.hooks.delete(this.state.assetUid, hookUid);
        },
        oncancel: () => {
          dialog.destroy();
        }
      };
      dialog.set(dialogOptions).show();
    }
  }

  openNewRESTServiceModal() {
    pageState.showModal({
      assetUid: this.state.assetUid,
      // hookUid: not provided intentionally
      type: MODAL_TYPES.REST_SERVICES
    });
  }

  getSupportUrl() {
    if (envStore.isReady && envStore.data.support_url) {
      return envStore.data.support_url + REST_SERVICES_SUPPORT_URL;
    }
  }

  renderModalButton() {
    return (
      <Button
        type='primary'
        size='l'
        onClick={this.openNewRESTServiceModal}
        label={t('Register a New Service')}
      />
    );
  }

  renderEmptyView() {
    return (
      <bem.FormView m={'form-settings'} className='rest-services rest-services--empty'>
        <bem.EmptyContent>
          <bem.EmptyContent__icon className='k-icon k-icon-data-sync' />

          <bem.EmptyContent__title>
            {t("This project doesn't have any REST Services yet!")}
          </bem.EmptyContent__title>

          <bem.EmptyContent__message>
            {t('You can use REST Services to automatically post submissions to a third-party application.')}
            &nbsp;
            <a href={this.getSupportUrl()} target='_blank'>{t('Learn more')}</a>
          </bem.EmptyContent__message>

          {this.renderModalButton()}
        </bem.EmptyContent>
      </bem.FormView>
    );
  }

  renderListView() {
    return (
      <bem.FormView m={'form-settings'} className='rest-services'>
        <bem.FormView__cell m='rest-services-list'>
          <header className='rest-services-list__header'>
            <h2 className='rest-services-list__header-label'>
              {t('REST Services: ##number##').replace('##number##', this.state.hooks.length)}
            </h2>

            <a
              className='rest-services-list__header-help-link rest-services-list__header-right'
              href={this.getSupportUrl()}
              target='_blank'
            >
              <i className='k-icon k-icon-help' />
              {t('Need help?')}
            </a>
          </header>

          <bem.FormView__cell m={['box']}>
            <bem.ServiceRow m='header'>
              <bem.ServiceRow__column m='name'>{t('Service Name')}</bem.ServiceRow__column>
              <bem.ServiceRow__column m='count'>{t('Success')}</bem.ServiceRow__column>
              <bem.ServiceRow__column m='count'>{t('Pending')}</bem.ServiceRow__column>
              <bem.ServiceRow__column m='count'>{t('Failed')}</bem.ServiceRow__column>
              <bem.ServiceRow__column m='actions' />
            </bem.ServiceRow>

            {this.state.hooks.map((hook) => {
              const logsUrl = `/#/forms/${this.state.assetUid}/settings/rest/${hook.uid}`;
              return (
                <bem.ServiceRow key={hook.uid} m={hook.active ? 'active' : 'inactive'}>
                  <bem.ServiceRow__linkOverlay href={logsUrl}/>

                  <bem.ServiceRow__column m='name'>{hook.name}</bem.ServiceRow__column>

                  <bem.ServiceRow__column m='count'>{hook.success_count}</bem.ServiceRow__column>

                  <bem.ServiceRow__column m='count'>{hook.pending_count}</bem.ServiceRow__column>

                  <bem.ServiceRow__column m='count'>{hook.failed_count}</bem.ServiceRow__column>

                  <bem.ServiceRow__column m='actions'>
                    <Button
                      type='secondary'
                      size='m'
                      onClick={() => this.editHook(hook.uid)}
                      tooltip={t('Edit')}
                      tooltipPosition='right'
                      startIcon='edit'
                    />

                    <Button
                      type='secondary-danger'
                      size='m'
                      onClick={() => this.deleteHookSafe(hook.uid, hook.name)}
                      tooltip={t('Delete')}
                      tooltipPosition='right'
                      startIcon='trash'
                    />
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
    if (this.state.isLoadingHooks) {
      return (<LoadingSpinner/>);
    } else if (this.state.hooks.length === 0) {
      return this.renderEmptyView();
    } else {
      return this.renderListView();
    }
  }
}

reactMixin(RESTServicesList.prototype, Reflux.ListenerMixin);
