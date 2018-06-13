import React from 'react';
import autoBind from 'react-autobind';
import stores from '../../stores';
import bem from '../../bem';
import {t} from '../../utils';

export default class RESTServicesList extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      assetUid: props.assetUid,
      services: [
        {
          name: 'Service 1',
          rsid: 'service-1',
          count: 20
        },
        {
          name: 'Service 2',
          rsid: 'service-2',
          count: 20
        },
        {
          name: 'Service 3',
          rsid: 'service-3',
          count: 20
        }
      ]
    };
    autoBind(this);
  }

  showServiceLogs(evt) {
    console.log('logs', this.state.assetUid, evt.currentTarget.dataset.rsid);
  }

  editService(evt) {
    stores.pageState.showModal({
      assetUid: this.state.assetUid,
      type: 'rest-services',
      rsid: evt.currentTarget.dataset.rsid
    });
  }

  deleteService(evt) {
    console.log('delete', this.state.assetUid, evt.currentTarget.dataset.rsid);
  }

  render() {
    return (
      <bem.FormView__cell m='REST-services-list'>
        <bem.FormView__group m='headings'>
          <bem.FormView__cell m='label'>
            {this.state.services.length} Services
          </bem.FormView__cell>
        </bem.FormView__group>
        <bem.FormView__cell m={['REST-services-table', 'box']}>
          <bem.FormView__group>
            <bem.FormView__group m={['items', 'headings']}>
              <bem.FormView__label m='name'>{t('Service Name')}</bem.FormView__label>
              <bem.FormView__label m='count'>{t('Count')}</bem.FormView__label>
              <bem.FormView__label m='actions' />
            </bem.FormView__group>

            {this.state.services.map((item, n) => {
              return (
                <bem.FormView__group m='items' key={n} >
                  <bem.FormView__label m='name'>
                    {item.name}
                  </bem.FormView__label>
                  <bem.FormView__label m='count'>
                    {item.count}
                  </bem.FormView__label>
                  <bem.FormView__label m='actions'>
                    <button
                      className='mdl-button'
                      onClick={this.showServiceLogs.bind(this)}
                      data-rsid={item.rsid}
                    >
                      logs
                    </button>

                    <button
                      className='mdl-button'
                      onClick={this.editService.bind(this)}
                      data-rsid={item.rsid}
                    >
                      edit
                    </button>

                    <button
                      className='mdl-button'
                      onClick={this.deleteService.bind(this)}
                      data-rsid={item.rsid}
                    >
                      delete
                    </button>
                  </bem.FormView__label>
                </bem.FormView__group>
              );
            })}
          </bem.FormView__group>
        </bem.FormView__cell>
      </bem.FormView__cell>
    );
  }
}
