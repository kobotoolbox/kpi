import React from 'react';
import Modal from 'react-modal';
import bem from '../../bem';
import ui from '../../ui';
import CollectionModal from './collectionModal';
import CollectionFilter from './collectionFilter';
import {dataInterface} from '../../dataInterface';

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
						filename: '',
						question: {
							label: ''
						}
					}
				]
			}
		};
	},
	loadGalleryData: function(uid, filter) {
		dataInterface.filterGalleryImages(uid, filter).done((response)=>{
			this.setState({
        assets: response
      });
	    localStorage.setItem('assets', JSON.stringify(response));
    });
	},
  openModal: function(asset, index) {
    this.setState({ showModal: true, assetID: asset.id, assetIndex: index });
  },
  closeModal: function() {
    this.setState({ showModal: false });
  },
	componentDidMount: function(){
		this.loadGalleryData(this.props.uid, 'question');
	},
	render () {
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
            <CollectionFilter {...this.props}/>
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
            <bem.AssetGallery__gridItem key={i} className="col4 one-one" style={divStyle} onClick={() => this.openModal(asset, i)} >
              <bem.AssetGallery__gridItemOverlay>
                <div className="text">
                  <h5>{asset.question.label}</h5>
                </div>
              </bem.AssetGallery__gridItemOverlay>
            </bem.AssetGallery__gridItem>
          );
        }.bind(this))}
        </bem.AssetGallery__grid>
        <CollectionModal show={this.state.showModal} onHide={this.closeModal} assetID={this.state.assetID} assetIndex={this.state.assetID} {...this.props}/>
      </bem.AssetGallery>
		);
	}
});

module.exports = CollectionsModal;
