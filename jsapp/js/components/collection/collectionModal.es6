import React from 'react';
import Modal from 'react-modal';
import bem from '../../bem';
import ui from '../../ui';
import Carousel from './collectionModalCarousel';
import Sidebar from './collectionModalSidebar';

const COLLECTIONS = require('../../data/collections');

var CollectionsModal = React.createClass({
	displayName: 'CollectionsModal',
	getInitialState() {
		this.toggleInfo = this.toggleInfo.bind(this);
		return {
			infoOpen: true
		}
	},
	closeModal: function() {
		this.setState({ showModal: false });
	},
	toggleInfo(){
		this.setState(prevState => ({
			infoOpen: !prevState.infoOpen
		}));
	},
	render () {
		return (
			<Modal
			  isOpen={this.props.show}
			  contentLabel="Modal" >
	      <bem.AssetGallery__modal>
	        <ui.Modal.Body>
						<bem.AssetGallery__modalCarousel className={"col8 "+ (this.state.infoOpen ? '' : 'full-screen')}>
							<bem.AssetGallery__modalCarouselTopbar className={this.state.infoOpen ? 'show' : 'show--hover'}>
								<i className="toggle-info material-icons" onClick={this.toggleInfo}>info_outline</i>
								<i className="close-modal material-icons" onClick={this.props.onHide}>keyboard_backspace</i>
							</bem.AssetGallery__modalCarouselTopbar>
							<Carousel />
						</bem.AssetGallery__modalCarousel>
						<bem.AssetGallery__modalSidebar className={"col4 " + (this.state.infoOpen ? 'open' : 'closed')}>
							<i className="toggle-info material-icons" onClick={this.toggleInfo}>close</i>
							<Sidebar />
						</bem.AssetGallery__modalSidebar>
	        </ui.Modal.Body>
	      </bem.AssetGallery__modal>
			</Modal>
		);
	}
});

module.exports = CollectionsModal;
