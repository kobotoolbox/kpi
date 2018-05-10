import React from 'react';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import {dataInterface} from '../dataInterface';
import actions from '../actions';
import bem from '../bem';
import ui from '../ui';
import stores from '../stores';
import mixins from '../mixins';
import {hashHistory} from 'react-router';

import {
  t,
  assign,
  notify
} from '../utils';

import {ProjectSettings} from '../components/formEditors';
import SharingForm from '../components/sharingForm';
import Submission from '../components/submission';
import TableColumnFilter from '../components/tableColumnFilter';

class Modal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      enketopreviewlink: false,
      error: false,
      modalClass: false,
      newFormAsset: false
    };
    autoBind(this);
  }
  componentDidMount () {
    var type = this.props.params.type;
    switch(type) {
      case 'sharing':
        this.setState({
          title: t('Sharing Permissions')
        });
        break;
      case 'uploading-xls':
        var filename = this.props.params.filename || '';
        this.setState({
          title: t('Uploading XLS file'),
          message: t('Uploading: ') + filename
        });
        break;

      case 'new-form':
        this.setState({
          title: `${t('Create New Project')} (${t('step 1 of 2')})`
        });
        break;
      case 'enketo-preview':
        var uid = this.props.params.assetid;
        stores.allAssets.whenLoaded(uid, function(asset){
          actions.resources.createSnapshot({
            asset: asset.url,
          });
        });
        this.listenTo(stores.snapshots, this.enketoSnapshotCreation);

        this.setState({
          title: t('Form Preview'),
          modalClass: 'modal-large'
        });
        break;
      case 'submission':
        this.setState({
          title: this.submissionTitle(this.props),
          modalClass: 'modal-large modal-submission',
          sid: this.props.params.sid
        });
      break;
      case 'replace-xls':
        this.setState({
          title: t('Replace with XLS')
        });
        break;
      case 'table-columns':
        this.setState({
          title: t('Configure table columns')
        });
      break;
		}
  }
  createNewForm (settingsComponent) {
    dataInterface.createResource({
      name: settingsComponent.state.name,
      settings: JSON.stringify({
        description: settingsComponent.state.description,
        sector: settingsComponent.state.sector,
        country: settingsComponent.state.country,
        'share-metadata': settingsComponent.state['share-metadata']
      }),
      asset_type: 'survey',
    }).done((asset) => {
      this.setState({
        newFormAsset: asset,
        title: `${t('Create New Project')} (${t('step 2 of 2')})`
      });
    }).fail(function(r){
      notify(t('Error: new project could not be created.') + ` (code: ${r.statusText})`);
    });
  }
  enketoSnapshotCreation (data) {
    if (data.success) {
      this.setState({
        enketopreviewlink: data.enketopreviewlink
      });
    } else {
      this.setState({
        message: data.error,
        error: true
      });
    }
  }
  componentWillReceiveProps(nextProps) {
    if (nextProps.params && nextProps.params.sid) {
      this.setState({
        title: this.submissionTitle(nextProps),
        sid: nextProps.params.sid
      });
    }

    if (this.props.params.type != nextProps.params.type && nextProps.params.type === 'uploading-xls') {
      var filename = nextProps.params.filename || '';
      this.setState({
        title: t('Uploading XLS file'),
        message: t('Uploading: ') + filename
      });
    }
    if (nextProps.params && !nextProps.params.sid) {
      this.setState({ sid: false });
    }
  }
  submissionTitle(props) {
    let title = t('Submission Record'),
        p = props.params,
        sid = parseInt(p.sid);

    if (p.tableInfo) {
      let index = p.ids.indexOf(sid) + (p.tableInfo.pageSize * p.tableInfo.currentPage) + 1;
      title =  `${t('Submission Record')} (${index} ${t('of')} ${p.tableInfo.resultsTotal})`;
    } else {
      let index = p.ids.indexOf(sid);
      title =  `${t('Submission Record')} (${index} ${t('of')} ${p.ids.length})`;
    }

    return title;
  }
  render() {
  	return (
      <ui.Modal open onClose={()=>{stores.pageState.hideModal()}} title={this.state.title} className={this.state.modalClass}>
        <ui.Modal.Body>
	        	{ this.props.params.type == 'sharing' &&
	          	<SharingForm uid={this.props.params.assetid} />
	        	}
            { this.props.params.type == 'new-form' &&
              <ProjectSettings
                onSubmit={this.createNewForm}
                submitButtonValue={t('Create Project')}
                context='newForm'
                newFormAsset={this.state.newFormAsset}
              />
            }
            { this.props.params.type == 'replace-xls' &&
              <ProjectSettings
                context='replaceXLS'
                newFormAsset={this.props.params.asset}
              />
            }

            { this.props.params.type == 'enketo-preview' && this.state.enketopreviewlink &&
              <div className='enketo-holder'>
                <iframe src={this.state.enketopreviewlink} />
              </div>
            }
            { this.props.params.type == 'enketo-preview' && !this.state.enketopreviewlink &&
              <bem.Loading>
                <bem.Loading__inner>
                  <i />
                  {t('loading...')}
                </bem.Loading__inner>
              </bem.Loading>
            }
            { this.props.params.type == 'enketo-preview' && this.state.error &&
              <div>
                {this.state.message}
              </div>
            }
            { this.props.params.type == 'uploading-xls' &&
              <div>
                <bem.Loading>
                  <bem.Loading__inner>
                    <i />
                    <bem.Loading__msg>{this.state.message}</bem.Loading__msg>
                  </bem.Loading__inner>
                </bem.Loading>
              </div>
            }

            { this.props.params.type == 'submission' && this.state.sid &&
              <Submission sid={this.state.sid}
                          asset={this.props.params.asset}
                          ids={this.props.params.ids}
                          tableInfo={this.props.params.tableInfo || false} />
            }
            { this.props.params.type == 'submission' && !this.state.sid &&
              <div>
                <bem.Loading>
                  <bem.Loading__inner>
                    <i />
                  </bem.Loading__inner>
                </bem.Loading>
              </div>
            }
            { this.props.params.type == 'table-columns' &&
              <TableColumnFilter settings={this.props.params.settings}
                                 columns={this.props.params.columns}
                                 uid={this.props.params.uid}
                                 getColumnLabel={this.props.params.getColumnLabel} />
            }
        </ui.Modal.Body>
      </ui.Modal>
    )
  }

};

reactMixin(Modal.prototype, Reflux.ListenerMixin);

export default Modal;
