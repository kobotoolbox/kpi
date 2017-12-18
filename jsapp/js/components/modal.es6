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
} from '../utils';

import {ProjectSettings} from '../components/formEditors';
import SharingForm from '../components/sharingForm';
import Submission from '../components/submission';

class Modal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      enketopreviewlink: false,
      error: false,
      modalClass: false
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
        var filename = this.props.params.file.name || '';
        this.setState({
          title: t('Uploading XLS file'),
          message: t('Uploading: ') + filename
        });
        break;

      case 'new-form':
        this.setState({
          title: t('Create New Project from Scratch')
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
          title: t('Record #') + this.props.params.sid,
          modalClass: 'modal-large modal-submission',
          sid: this.props.params.sid
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
      hashHistory.push(`/forms/${asset.uid}/edit`);
      stores.pageState.hideModal();
    });
  }
  enketoSnapshotCreation (data) {
    if (data.success) {
      // var uid = this.props.params.assetid;
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
    this.setState({
      title: t('Record #') + nextProps.params.sid,
      sid: nextProps.params.sid
    });
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
                submitButtonValue={t('Create project')}
                context='newForm'
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
              <Submission sid={this.state.sid} asset={this.props.params.asset} ids={this.props.params.ids} />
            }

	        </ui.Modal.Body>
	      </ui.Modal>
  		)
  }

};

reactMixin(Modal.prototype, Reflux.ListenerMixin);

export default Modal;
