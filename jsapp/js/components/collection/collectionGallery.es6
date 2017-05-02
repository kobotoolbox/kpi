import React from 'react';
import Modal from 'react-modal';
import bem from '../../bem';
import ui from '../../ui';
import CollectionModal from './collectionModal';
import CollectionFilter from './collectionFilter';

const COLLECTIONS = require('../../data/collections');

var CollectionsModal = React.createClass({
	displayName: 'CollectionsModal',
	propTypes: {
		label: React.PropTypes.string,
		searchable: React.PropTypes.bool,
	},
  getInitialState: function() {
    return {
      showModal: false
    };
  },
  openModal: function(asset) {
		console.log(asset);
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
	getSelectedItem: function () {

	},
	render () {
    var data = {
      assets: [
        {
          "download_url": "http://172.17.0.1:8001/media/wolejkoa/attachments/2d2ebe6357924842ad2f21ac3da38338/682e5deb-c4c2-4f13-842f-19589f5df6bc/test-9_3_0-large.jpeg",
          "small_download_url": "http://example.com/api/v1/media/1-small.jpg",
          "medium_download_url": "http://example.com/api/v1/media/1-medium.jpg",
          "filename": "test-9_3_0-large.jpeg",
          "id": 1,
          "instance": 1,
          "mimetype": "image/jpeg",
          "url": "http://example.com/api/v1/media/1",
          "xform": 1
        },
        {
          "download_url": "http://172.17.0.1:8001/media/wolejkoa/attachments/2d2ebe6357924842ad2f21ac3da38338/682e5deb-c4c2-4f13-842f-19589f5df6bc/test-9_3_0-large.jpeg",
          "small_download_url": "http://example.com/api/v1/media/1-small.jpg",
          "medium_download_url": "http://example.com/api/v1/media/1-medium.jpg",
          "filename": "test-9_3_0-large.jpeg",
          "id": 1,
          "instance": 1,
          "mimetype": "image/jpeg",
          "url": "http://example.com/api/v1/media/1",
          "xform": 1
        },
        {
          "download_url": "http://172.17.0.1:8001/media/wolejkoa/attachments/2d2ebe6357924842ad2f21ac3da38338/682e5deb-c4c2-4f13-842f-19589f5df6bc/test-9_3_0-large.jpeg",
          "small_download_url": "http://example.com/api/v1/media/1-small.jpg",
          "medium_download_url": "http://example.com/api/v1/media/1-medium.jpg",
          "filename": "test-9_3_0-large.jpeg",
          "id": 1,
          "instance": 1,
          "mimetype": "image/jpeg",
          "url": "http://example.com/api/v1/media/1",
          "xform": 1
        },
        {
          "download_url": "http://172.17.0.1:8001/media/wolejkoa/attachments/2d2ebe6357924842ad2f21ac3da38338/682e5deb-c4c2-4f13-842f-19589f5df6bc/test-9_3_0-large.jpeg",
          "small_download_url": "http://example.com/api/v1/media/1-small.jpg",
          "medium_download_url": "http://example.com/api/v1/media/1-medium.jpg",
          "filename": "test-9_3_0-large.jpeg",
          "id": 1,
          "instance": 1,
          "mimetype": "image/jpeg",
          "url": "http://example.com/api/v1/media/1",
          "xform": 1
        },
        {
          "download_url": "http://172.17.0.1:8001/media/wolejkoa/attachments/2d2ebe6357924842ad2f21ac3da38338/682e5deb-c4c2-4f13-842f-19589f5df6bc/test-9_3_0-large.jpeg",
          "small_download_url": "http://example.com/api/v1/media/1-small.jpg",
          "medium_download_url": "http://example.com/api/v1/media/1-medium.jpg",
          "filename": "test-9_3_0-large.jpeg",
          "id": 1,
          "instance": 1,
          "mimetype": "image/jpeg",
          "url": "http://example.com/api/v1/media/1",
          "xform": 1
        }
      ]
    }
		return (
      <bem.AssetGallery>
				<link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons"/>
        <bem.AssetGallery__heading>
          <div className="col6">
            <bem.AssetGallery__count>
              <strong>{data.assets.length} Images</strong>
            </bem.AssetGallery__count>
          </div>
          <div className="col6">
            <CollectionFilter />
          </div>
        </bem.AssetGallery__heading>
        <bem.AssetGallery__grid>
        {data.assets.map(function(asset, i) {
          var divStyle = {
            backgroundImage: 'url(' + asset.download_url + ')',
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
