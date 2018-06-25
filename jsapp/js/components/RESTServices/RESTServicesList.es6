import React from 'react';
import autoBind from 'react-autobind';
import stores from '../../stores';
import actions from '../../actions';
import {dataInterface} from '../../dataInterface';
import bem from '../../bem';
import {t} from '../../utils';

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
    dataInterface.getExternalServices(this.state.assetUid)
      .done((data) => {
        console.log(data);
        this.setState({
          isLoadingServices: false,
          services: data.results
        });
      })
      .fail((data) => {
        this.setState({
          isLoadingServices: false
        });
        alertify.error(t('Could not load REST services list.'));
      });
  }

  editService(evt) {
    stores.pageState.showModal({
      assetUid: this.state.assetUid,
      type: 'rest-services',
      esid: evt.currentTarget.dataset.esid
    });
  }

  deleteService(evt) {
    actions.externalServices.delete(
      this.state.assetUid,
      evt.currentTarget.dataset.esid, {
        onComplete: () => {
          console.log('deleted');
        },
        onFail: () => {
          console.log('del failed');
        }
      }
    );
  }

  openNewRESTServiceModal() {
    stores.pageState.showModal({
      assetUid: this.state.assetUid,
      // esid: not provided intentionally
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

  renderEmptyView() {
    return (
      <bem.FormView m={'form-settings'} className='rest-services rest-services--empty'>
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
      </bem.FormView>
    )
  }

  renderListView() {
    return (
      <bem.FormView m={'form-settings'} className='rest-services'>
        <bem.FormView__cell m='rest-services-list'>
          <header className='rest-services-list__header'>
            <h2 className='rest-services-list__header-label'>
              {t('##number## Services').replace('##number##', this.state.services.length)}
            </h2>

            <a
              className='rest-services-list__header-help-link'
              href={RESTServicesSupportUrl}
              target='_blank'
            >{t('Need help?')}</a>
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
                        &nbsp;({item.failed_count})
                      </span>
                    }
                  </bem.ServiceRow__column>

                  <bem.ServiceRow__column m='actions'>
                    <bem.ServiceRow__actionButton
                      onClick={this.editService}
                      data-esid={item.uid}
                      data-tip={t('Edit')}
                    >
                      <i className='k-icon-edit' />
                    </bem.ServiceRow__actionButton>

                    <bem.ServiceRow__actionButton
                      onClick={this.deleteService}
                      data-esid={item.uid}
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
