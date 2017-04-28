import React from 'react';
import Modal from 'react-modal';
import bem from '../../bem';
import ui from '../../ui';
import Carousel from './CollectionModalCarousel';

const COLLECTIONS = require('../../data/collections');

var CollectionsModal = React.createClass({
	displayName: 'CollectionsModal',
	propTypes: {
		label: React.PropTypes.string,
		searchable: React.PropTypes.bool,
	},
	closeModal: function() {
		this.setState({ showModal: false });
	},
	render () {
		return (
			<Modal
			  isOpen={this.props.show}
			  contentLabel="Modal" >
	      <bem.AssetGallery__modal>
					<button type="button" className="close" onClick={this.props.onHide}>
						<span>&times;</span>
					</button>
	        <ui.Modal.Body>
						<div className="col8">
							<Carousel/>
						</div>
						<div className="col4">
		          <p>{this.props.assetID}</p>
							<p>{this.props.assetTitle}</p>
							<p>{this.props.assetDate}</p>
						</div>
	        </ui.Modal.Body>
	      </bem.AssetGallery__modal>
			</Modal>
		);
	}
});

module.exports = CollectionsModal;
