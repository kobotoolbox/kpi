import React from 'react';
import Modal from 'react-modal';
import bem from '../../bem';
import ui from '../../ui';
import Select from 'react-select';
import Slider from 'react-slick';
import CollectionModal from './collectionModal';
import CollectionFilter from './collectionFilter';
import {dataInterface} from '../../dataInterface';

var CollectionsGallery = React.createClass({
	displayName: 'CollectionsGallery',
	propTypes: {
		label: React.PropTypes.string,
	},
	getInitialState: function() {
		this.toggleInfo = this.toggleInfo.bind(this);
		return {
			showModal: false,
			activeIndex: 0,
			activeID: null,
			activeTitle: null,
			activeDate: null,
			infoOpen: true,
			filter: {
				source: 'question',
				label: '',
				searchable: false,
				clearable: false
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
		};
	},
	loadGalleryData: function(uid, filter) {
		dataInterface.filterGalleryImages(uid, filter).done((response)=>{
			this.setState({
        assets: response
      });
    });
	},

	// MODAL

  openModal: function(asset, index) {
		this.updateActiveAsset(index);
    this.setState({
			showModal: true,
			activeID: asset.id,
			activeIndex: index
		});
  },
  closeModal: function() {
    this.setState({ showModal: false });
  },
	toggleInfo(){
		this.setState(prevState => ({
			infoOpen: !prevState.infoOpen
		}));
	},
	componentDidMount: function(){
		this.loadGalleryData(this.props.uid, 'question');
	},

	// SLIDER

	updateActiveAsset(index) {
		let current = this.state.assets.results[index];
		this.setState({
			activeIndex: index,
			activeTitle: current.question.label,
			activeDate: current.submission.date_created
		});
		if (this.refs.slider){
			this.goToSlide(index);
		}
	},
	handleCarouselChange: function(currentSlide, nextSlide){
		let current = this.state.assets.results[nextSlide];
		this.setState({
			activeIndex: nextSlide,
			activeTitle: current.question.label,
			activeDate: current.submission.date_created
		});
	},
	goToSlide(index) {
		this.refs.slider.slickGoTo(index);
	},

	// FILTER

	switchFilter (value) {
		var newFilter = value;
		console.log('Filter changed to ' + newFilter);
		dataInterface.filterGalleryImages(this.props.uid, newFilter).done((response)=>{
			this.setState({
				filter: {
					source: newFilter
				}
			});
			console.log(response);
		});
	},

	// RENDER

	render () {
		const settings = {
			dots: false,
			fade: true,
			lazyLoad: true,
			infinite: false,
			speed: 500,
			slidesToShow: 1,
			slidesToScroll: 1,
			initialSlide: this.state.activeIndex,
			nextArrow: <RightNavButton/>,
			prevArrow: <LeftNavButton/>
		}
		let filters = [
			{value: 'question', label: 'Group by Question'},
			{value: 'submission', label: 'Group by Record'}
		]
		return (
      <bem.AssetGallery>
				<link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons"/>
        <bem.AssetGallery__heading>
          <div className="col6">
            <bem.AssetGallery__count>
              <strong>{this.state.assets.count} Images</strong>
            </bem.AssetGallery__count>
          </div>
          <div className="col6">
						<bem.AssetGallery__headingSearchFilter className="section">
							<div className="text-display"><span>{this.state.filter.source}</span></div>
							<Select ref="filterSelect" className="icon-button-select" options={filters} simpleValue name="selected-filter" disabled={this.state.disabled} value={this.state.filter.source} onChange={this.switchFilter} searchable={false} />
						</bem.AssetGallery__headingSearchFilter>
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
	            <bem.AssetGallery__gridItem key={i} data-name={asset.question.label} className="col4 one-one" style={divStyle} onClick={() => this.openModal(asset, i)} >
	              <bem.AssetGallery__gridItemOverlay>
	                <div className="text">
	                  <h5>{asset.question.label}</h5>
	                </div>
	              </bem.AssetGallery__gridItemOverlay>
	            </bem.AssetGallery__gridItem>
	          );
	        }.bind(this))}
	        </bem.AssetGallery__grid>
					<Modal
					  isOpen={this.state.showModal}
					  contentLabel="Modal" >
			      <bem.AssetGallery__modal>
			        <ui.Modal.Body>
								<bem.AssetGallery__modalCarousel className={"col8 "+ (this.state.infoOpen ? '' : 'full-screen')}>
									<bem.AssetGallery__modalCarouselTopbar className={this.state.infoOpen ? 'show' : 'show--hover'}>
										<i className="close-modal material-icons" onClick={this.closeModal}>keyboard_backspace</i>
										<i className="toggle-info material-icons" onClick={this.toggleInfo}>info_outline</i>
									</bem.AssetGallery__modalCarouselTopbar>
									<Slider ref="slider" {...settings} beforeChange={this.handleCarouselChange}>
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
												<h4>Information</h4>
											</div>
											<div className="info__inner margin--15">
												<h3>{this.state.activeTitle}</h3>
												<p>{this.state.activeDate}</p>
											</div>
										</div>
										<bem.AssetGallery__modalSidebarGrid className="padding--10">
										{this.state.assets.results.map(function(asset, i) {
											var divStyle = {
												backgroundImage: 'url('+ asset.download_url + ')',
												backgroundRepeat: 'no-repeat',
												backgroundPosition: 'center center',
												backgroundSize: 'cover'
											}
											return (
												<bem.AssetGallery__modalSidebarGridItem key={i} className="col6" onClick={() => this.updateActiveAsset(i)}>
													<div className="one-one" style={divStyle}>
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
      </bem.AssetGallery>
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


module.exports = CollectionsGallery;
