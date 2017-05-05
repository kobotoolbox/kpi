import React from 'react';
import Modal from 'react-modal';
import bem from '../../bem';
import ui from '../../ui';
import CollectionModal from './collectionModal';
import CollectionFilter from './collectionFilter';
import {dataInterface} from '../../dataInterface';

const COLLECTIONS = require('../../data/collections');

var CollectionsModal = React.createClass({
	displayName: 'CollectionsModal',
	propTypes: {
		label: React.PropTypes.string,
		searchable: React.PropTypes.bool,
	},
	getInitialState: function() {
		return {
			showModal: false,
			assets: {
				count: 0,
				results: [
					{
						download_url: '',
						filename: ''
					}
				]
			}
		};
	},
	loadGalleryData: function(uid) {
		dataInterface.getGalleryImages(uid).done((response)=>{
			console.log(response);
			this.setState({
        assets: response
      });
    });
	},
  openModal: function(asset) {
    this.setState({ showModal: true, assetId: asset.id, assetDate: asset.filename, assetName: asset.filename });
  },
  closeModal: function() {
    this.setState({ showModal: false });
  },
  handleModalCloseRequest: function() {
    // opportunity to validate something and keep the modal open even if it
    // requested to be closed
    this.setState({ showModal: false });
  },
  handleInputChange: function() {
    this.setState({ foo: 'bar' });
  },
  handleOnAfterOpenModal: function() {
    // when ready, we can access the available refs.
    this.refs.title.style.color = '#F00';
  },
	componentDidMount: function(){
		this.loadGalleryData(this.props.uid);
	},
	render () {
		console.log(this.state.assets);
		return (
      <bem.AssetGallery>
				<link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons"/>
				<link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css" />
        <bem.AssetGallery__heading>
          <div className="col6">
            <bem.AssetGallery__count>
              <strong>{this.state.assets.count} Images</strong>
            </bem.AssetGallery__count>
          </div>
          <div className="col6">
            <CollectionFilter />
          </div>
        </bem.AssetGallery__heading>
        <bem.AssetGallery__grid>
        {this.state.assets.results.map(function(asset, i) {
          var divStyle = {
            backgroundImage: 'url('+ asset.download_url + ')',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center center',
            backgroundSize: 'cover'
          }
          return (
            <bem.AssetGallery__gridItem key={i} className="col4 one-one" style={divStyle} onClick={() => this.openModal(asset)} >
              <bem.AssetGallery__gridItemOverlay>
                <div className="text">
                  <h5>{asset.filename}</h5>
                </div>
              </bem.AssetGallery__gridItemOverlay>
            </bem.AssetGallery__gridItem>
          );
        }.bind(this))}
        </bem.AssetGallery__grid>
        <CollectionModal show={this.state.showModal} onHide={this.closeModal} assetID={this.state.assetId} assetDate={this.state.assetDate} assetName={this.state.assetName}/>
      </bem.AssetGallery>
		);
	}
});

module.exports = CollectionsModal;
