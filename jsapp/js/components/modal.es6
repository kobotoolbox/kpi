import React from 'react/addons';
import Reflux from 'reflux';
import {Navigation} from 'react-router';
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

var Modal = React.createClass({
  mixins: [
    mixins.shareAsset
  ],
  getInitialState() {
    return {
      type: false
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
		}  	
  },
  render() {
  	return (
	      <ui.Modal open onClose={()=>{stores.pageState.hideModal()}} title={this.state.title}>
	        <ui.Modal.Body>
	        	{this.props.params.type == 'sharing' &&
	          	this.sharingForm()
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
