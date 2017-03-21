import React from 'react/addons';
import Reflux from 'reflux';
import {Navigation} from 'react-router';
import {dataInterface} from '../dataInterface';
import actions from '../actions';
import bem from '../bem';
import ui from '../ui';
import stores from '../stores';
import mixins from '../mixins';
import mdl from '../libs/rest_framework/material';

import {
  t,
  assign,
} from '../utils';

import {ProjectSettings} from '../components/formEditors';

var Modal = React.createClass({
  mixins: [
    mixins.shareAsset,
    Navigation,
    Reflux.ListenerMixin
  ],
  getInitialState() {
    return {
      type: false,
      enketopreviewlink: false,
      error: false,
      modalClass: false
    };
  },
  componentDidMount () {
  	var type = this.props.params.type;
    switch(type) {
      case 'sharing':
    		var uid = this.props.params.assetid || this.props.uid || this.props.params.uid;
		    actions.resources.loadAsset({id: uid});
        this.setState({
          title: t('Sharing Permissions')
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
		}  	
  },
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
      var isNewForm = false;
      if (isNewForm) {
        this.transitionTo('form-landing', {assetid: asset.uid})
      } else {
        this.transitionTo('form-edit', {assetid: asset.uid})
      }
      stores.pageState.hideModal();
    });
  },
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
  },

  render() {
  	return (
	      <ui.Modal open onClose={()=>{stores.pageState.hideModal()}} title={this.state.title} className={this.state.modalClass}>
	        <ui.Modal.Body>
	        	{ this.props.params.type == 'sharing' &&
	          	this.sharingForm()
	        	}
            { this.props.params.type == 'new-form' &&
              <ProjectSettings
                onSubmit={this.createNewForm}
                submitButtonValue={t('Create project')}
                context='newForm'
              />
            }
            { this.props.params.type == 'enketo-preview' && this.state.enketopreviewlink ?
                <div className='enketo-holder'>
                  <iframe src={this.state.enketopreviewlink} />
                </div>
                :
                <bem.Loading>
                  <bem.Loading__inner>
                    <i />
                    {t('loading...')}
                  </bem.Loading__inner>
                </bem.Loading>
            }
            { this.state.error && 
              <div>
                {this.state.message}
              </div>
            }

	        </ui.Modal.Body>
	      </ui.Modal>
  		)
  },
  componentDidUpdate() {
    mdl.upgradeDom();
  }

})

export default Modal;
