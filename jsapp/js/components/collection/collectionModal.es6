import React from 'react';
import Modal from 'react-modal';
import bem from '../../bem';
import ui from '../../ui';
import Carousel from './collectionModalCarousel';
import Sidebar from './collectionModalSidebar';

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
					<i className="close-modal" onClick={this.props.onHide}>&times;</i>
	        <ui.Modal.Body>
						<bem.AssetGallery__modalCarousel className="col8">
							<Carousel />
						</bem.AssetGallery__modalCarousel>
						<bem.AssetGallery__modalSidebar className="col4">
							<Sidebar />
						</bem.AssetGallery__modalSidebar>
	        </ui.Modal.Body>
	      </bem.AssetGallery__modal>
			</Modal>
		);
	}
});

module.exports = CollectionsModal;
