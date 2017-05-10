import React from 'react';
import Modal from 'react-modal';
import bem from '../../bem';
import ui from '../../ui';
import {dataInterface} from '../../dataInterface';
import Slider from 'react-slick';

var CollectionsModal = React.createClass({
	displayName: 'CollectionsModal',
	getInitialState() {
		this.toggleInfo = this.toggleInfo.bind(this);
		return {
			infoOpen: true,
			assetID: this.props.assetID,
			assetIndex: this.props.assetIndex,
			selectedAsset: {
				question: {
					label: ''
				},
				submission: {
					date_created: ''
				}
			},
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
		}
	},
	closeModal: function() {
		this.setState({ showModal: false });
	},
	getAssetData() {
		console.log(url);
		console.log(localStorage);
	},
	toggleInfo(){
		this.setState(prevState => ({
			infoOpen: !prevState.infoOpen
		}));
	},
	loadGalleryData: function(uid, filter) {
		dataInterface.filterGalleryImages(uid, filter).done((response)=>{
			this.setState({
				assets: response
			});
		});
	},
	componentDidMount: function(){
		this.loadGalleryData(this.props.uid, 'question');
	},
	modalData() {
		console.log(this.state);
		this.goToSlide(this.state.assetIndex);
	},
	goToSlide(index) {
		this.refs.slider.slickGoTo(index);
	},
	updateSelectedAsset(index) {
		let current = this.state.assets.results[index];
		this.setState({
			selectedAsset: current,
			assetIndex: index
		});
		this.goToSlide(index);
	},
	render () {
		const settings = {
			dots: false,
			fade: true,
			lazyLoad: true,
			infinite: false,
			speed: 500,
			slidesToShow: 1,
			slidesToScroll: 1,
			nextArrow: <RightNavButton/>,
			prevArrow: <LeftNavButton/>
		}
		return (
			<Modal
			  isOpen={this.props.show}
				onAfterOpen={this.modalData}
			  contentLabel="Modal" >
	      <bem.AssetGallery__modal>
	        <ui.Modal.Body>
						<bem.AssetGallery__modalCarousel className={"col8 "+ (this.state.infoOpen ? '' : 'full-screen')}>
							<bem.AssetGallery__modalCarouselTopbar className={this.state.infoOpen ? 'show' : 'show--hover'}>
								<i className="close-modal material-icons" onClick={this.props.onHide}>keyboard_backspace</i>
								<i className="toggle-info material-icons" onClick={this.toggleInfo}>info_outline</i>
							</bem.AssetGallery__modalCarouselTopbar>
							<Slider ref="slider" {...settings}>
								{this.state.assets.results.map(function(asset, i) {
				          return (
										<div key={i}>
											<img alt="900x500" src={asset.large_download_url}/>
										</div>
				          );
				        }.bind(this))}
							</Slider>
						</bem.AssetGallery__modalCarousel>
						<bem.AssetGallery__modalSidebar className={"col4 " + (this.state.infoOpen ? 'open' : 'closed')}>
							<i className="toggle-info material-icons" onClick={this.toggleInfo}>close</i>
							<div>
								<div className="info__outer">
									<div className="light-grey-bg">
										<h3>Information</h3>
									</div>
									<div className="info__inner padding--20">
										<h6>{this.state.selectedAsset.question.label}</h6>
										<p>{this.state.selectedAsset.submission.date_created}</p>
									</div>
								</div>
								<bem.AssetGallery__modalSidebarGrid className="padding--20">
								{this.state.assets.results.map(function(asset, i) {
									var divStyle = {
										backgroundImage: 'url('+ asset.download_url + ')',
										backgroundRepeat: 'no-repeat',
										backgroundPosition: 'center center',
										backgroundSize: 'cover'
									}
									return (
										<bem.AssetGallery__modalSidebarGridItem key={i} className="col6" onClick={() => this.updateSelectedAsset(i)}>
											<div className={"one-one " + (asset.id !== this.state.assetID ? 'show' : 'hidden')} style={divStyle}>
											</div>
										</bem.AssetGallery__modalSidebarGridItem>
									);
								}.bind(this))}
								</bem.AssetGallery__modalSidebarGrid>
							</div>
						</bem.AssetGallery__modalSidebar>
	        </ui.Modal.Body>
	      </bem.AssetGallery__modal>
			</Modal>
		);
	}
});

let RightNavButton = React.createClass({
  render() {
    return (
      <button {...this.props}>
        <i className="material-icons">chevron_right</i>
      </button>
    )
  }
});
let LeftNavButton = React.createClass({
  render() {
    return (
      <button {...this.props}>
        <i className="material-icons">chevron_left</i>
      </button>
    )
  }
});


module.exports = CollectionsModal;
