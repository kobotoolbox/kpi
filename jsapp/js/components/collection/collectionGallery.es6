import React from 'react';
import Modal from 'react-modal';
import bem from '../../bem';
import ui from '../../ui';
import Select from 'react-select';
import Slider from 'react-slick';
import CollectionModal from './collectionModal';
import CollectionFilter from './collectionFilter';
import {dataInterface} from '../../dataInterface';
import moment from 'moment';

var CollectionsGallery = React.createClass({
    displayName: 'CollectionsGallery',
    propTypes: {
        label: React.PropTypes.string
    },
    //Init
    getInitialState: function() {
        this.toggleInfo = this.toggleInfo.bind(this);
        return {
            defaultPageSize: 2,
            hasMoreAttachments: true,
            showModal: false,
            activeIndex: 0,
            activeID: null,
            activeTitle: null,
            activeDate: null,
            activeParentIndex: 0,
            infoOpen: true,
            filter: {
                source: 'question',
                label: 'Group by Question',
                searchable: false,
                clearable: false
            },
            assets: {
                count: 0,
                loaded: false,
                results: [
                    {
                        attachments: []
                    }
                ]
            }
        };
    },
    loadGalleryData: function(uid, filter) {
        dataInterface.filterGalleryImages(uid, filter, this.state.defaultPageSize).done((response) => {
            response.loaded = true;
            this.setState({
                assets: response
            });
        });
    },
    componentDidMount: function() {
        this.loadGalleryData(this.props.uid, 'question');
    },
    // FILTER
    switchFilter(value) {
        let filters = [
            {
                value: 'question',
                label: 'Group by Question'
            }, {
                value: 'submission',
                label: 'Group by Record'
            }
        ]
        var label;
        var newFilter = value;
        for (var i = 0; i < filters.length; i++) {
            if (filters[i].value == newFilter) {
                label = filters[i].label;
            }
        }
        dataInterface.filterGalleryImages(this.props.uid, newFilter, this.state.defaultPageSize).done((response) => {
            response.loaded = true;
            this.setState(this.getInitialState());
            this.forceUpdate();
            this.setState({
                filter: {
                    source: newFilter,
                    label: label
                },
                assets: response
            });
        });
    },

    // Pagination
    loadMoreAttachments(filter, index, page) {
        return dataInterface.loadQuestionAttachment(this.props.uid, filter, index, page, this.state.defaultPageSize).done((response) => {
            let assets = this.state.assets;
            assets.results[index].attachments.results.push(...response.attachments.results);
            this.setState({assets});
        });
    },
	loadMoreRecords(filter, page) {
        return dataInterface.loadMoreRecords(this.props.uid, filter, page, this.state.defaultPageSize).done((response) => {
            console.log(response);
            let assets = this.state.assets
            assets.results.push(...response.results);
            this.setState({assets});
        });
    },
    formatDate : function(myDate){
        let timestamp = moment(new Date(myDate)).format('DD-MMM-YYYY h:mm:ssa');
        // console.log(myDate, " => DATE FORMATTING => ", timestamp);
        return timestamp;
    },
    // MODAL
    openModal: function(record_index, attachment_index) {
        let record = this.state.assets.results[record_index];
        let attachment = record.attachments.results[attachment_index];
        this.setState({
            showModal: true,
            activeID: attachment.id,
            activeIndex: attachment_index,
            activeParentIndex: record_index,
            activeTitle: record.label || attachment.question.label,
            activeDate: this.formatDate(record.date_created || attachment.submission.date_created)
        });
    },
    closeModal: function() {
        this.setState({showModal: false});
    },
    toggleInfo() {
        this.setState(prevState => ({
            infoOpen: !prevState.infoOpen
        }));
    },

    // SLIDER
    updateActiveAsset(record_index, attachment_index) {
        let record = this.state.assets.results[record_index];
        let attachment = record.attachments[attachment_index];
        this.setState({
            activeIndex: attachment_index,
            activeParentIndex: record_index,
            activeTitle: record.label || attachment.question.label,
            activeDate: this.formatDate(record.date_created || attachment.submission.date_created)
        });
        if (this.refs.slider) {
            this.goToSlide(attachment_index);
        }
    },
    handleCarouselChange: function(currentSlide, nextSlide) {
        let record = this.state.assets.results[this.state.activeParentIndex];
        let attachment = record.attachments.results[nextSlide];
        this.setState({
            activeIndex: nextSlide,
            activeTitle: record.label || attachment.question.label,
            activeDate: this.formatDate(record.date_created || attachment.submission.date_created)
        });
    },
    goToSlide(index) {
        this.refs.slider.slickGoTo(index);
    },

    // RENDER
    render() {
        const settings = {
            dots: false,
            fade: true,
            lazyLoad: true,
            infinite: false,
            speed: 500,
            slidesToShow: 1,
            slide: 'slide',
            slidesToScroll: 1,
            initialSlide: this.state.activeIndex,
            nextArrow: <RightNavButton/>,
            prevArrow: <LeftNavButton/>
        }
        let filters = [
            {
                value: 'question',
                label: 'Group by Question'
            }, {
                value: 'submission',
                label: 'Group by Record'
            }
        ]
        if (this.state.assets.loaded) {
            // TODO Create A GalleryModal class!!!
            return (
                <bem.AssetGallery>
                    <link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons"/>

                    <GalleryHeading attachments_count={this.state.assets.attachments_count}
                        currentFilter={this.state.filter} filters={filters} switchFilter={this.switchFilter}/>
                    <GalleryGrid  results={this.state.assets.results} count={this.state.assets}
                        currentFilter={this.state.filter} loadMoreAttachments={this.loadMoreAttachments}
                         loadMoreRecords={this.loadMoreRecords} formatDate={this.formatDate}
                         openModal={this.openModal}/>

                    <Modal isOpen={this.state.showModal} contentLabel="Modal" >
						<bem.AssetGallery__modal>
							<ui.Modal.Body>
								<bem.AssetGallery__modalCarousel className={"col8 "+ (this.state.infoOpen ? '' : 'full-screen')}>
									<bem.AssetGallery__modalCarouselTopbar className={this.state.infoOpen ? 'show' : 'show--hover'}>
										<i className="close-modal material-icons" onClick={this.closeModal}>keyboard_backspace</i>
										<i className="toggle-info material-icons" onClick={this.toggleInfo}>info_outline</i>
									</bem.AssetGallery__modalCarouselTopbar>
									<Slider ref="slider" {...settings} beforeChange={this.handleCarouselChange}>
										{this.state.assets.results[this.state.activeParentIndex].attachments.results.map(function (item) {
											return (
												<div key={item.id}>
													<img alt="900x500" src={item.large_download_url}/>
												</div>
											)
										})}
									</Slider>
								</bem.AssetGallery__modalCarousel>
								<bem.AssetGallery__modalSidebar className={"col4 " + (this.state.infoOpen ? 'open' : 'closed')}>
									<i className="toggle-info material-icons" onClick={this.toggleInfo}>close</i>
									<div>
										<div className="info__outer">
											<div className="light-grey-bg">
												<h4>Information</h4>
											</div>
											<div className="info__inner">
												<p>{this.state.filter.source === 'question' ? 'Record #' : 'Question #'}{this.state.activeParentIndex + 1}</p>
												<h3>{this.state.activeTitle}</h3>
												<p>{this.state.activeDate}</p>
											</div>
										</div>
										<bem.AssetGallery__modalSidebarGrid className="padding--15">
											{this.state.assets.results.map(function(record, i) {
												return (
													<div key={i}>
														<h5>{this.state.filter.source === 'question' ? 'Question #' : 'Record #'}{i}</h5>
														{record.attachments.results.map(function(item, j) {
															if (this.state.activeIndex !== j){ // if the item is not the active attachment
																var divStyle = {
																	backgroundImage: 'url('+ item.download_url + ')',
																	backgroundRepeat: 'no-repeat',
																	backgroundPosition: 'center center',
																	backgroundSize: 'cover'
																}
																return (
																	<bem.AssetGallery__modalSidebarGridItem key={j} className="col6" onClick={() => this.updateActiveAsset(j)}>
																		<div className="one-one" style={divStyle}></div>
																	</bem.AssetGallery__modalSidebarGridItem>
																)
															}
														}.bind(this))}
													</div>
												)
											}.bind(this))}
										</bem.AssetGallery__modalSidebarGrid>
									</div>
								</bem.AssetGallery__modalSidebar>
							</ui.Modal.Body>
						</bem.AssetGallery__modal>
					</Modal>
                </bem.AssetGallery>
            );

        } else {
            return null;
        }
    }
});

let GalleryHeading = React.createClass({
    render(){
        return (
            <bem.AssetGallery__heading>
                <div className="col6">
                    <bem.AssetGallery__count>
                        <strong>{this.props.attachments_count} Images</strong>
                    </bem.AssetGallery__count>
                </div>
                <div className="col6">
                    <bem.AssetGallery__headingSearchFilter className="section">
                        <div className="text-display">
                            <span>{this.props.currentFilter.label}</span>
                        </div>
                        <Select ref="filterSelect" className="icon-button-select" options={this.props.filters} simpleValue name="selected-filter" value={this.props.currentFilter.source} onChange={this.props.switchFilter} searchable={false}/>
                    </bem.AssetGallery__headingSearchFilter>
                </div>
            </bem.AssetGallery__heading>
        )
    }
});

let GalleryGrid = React.createClass({
    render(){
        return (
            <bem.AssetGallery__grid>
                {this.props.results.map(function(record, i) {
                    if (typeof record.attachments.results == "undefined" || record.attachments.results.length === 0) {
                        return null;
                    } else {
                        return (
                            <div key={i}>
                                <GalleryGridItem currentFilter={this.props.currentFilter} currentIndex={i} record={record}
                                    formatDate={this.props.formatDate} openModal={this.props.openModal} loadMoreAttachments={this.props.loadMoreAttachments}/>
                            </div>
                        );
                    }
                }.bind(this))}
                <LoadMoreRecordsBtn filter={this.props.currentFilter.source} loadMore={this.props.loadMoreRecords} count={this.props.count}/>
            </bem.AssetGallery__grid>
        )
    }
});

let GalleryGridItem = React.createClass({
    render(){
        return (
            <div>
                <h5>{this.props.currentFilter.source === 'question'
                        ? this.props.record.label
                        : 'Record #' + parseInt(this.props.currentIndex + 1)}</h5>
                {this.props.record.attachments.results.map(function(item, j) {
                    var divStyle = {
                        backgroundImage: 'url(' + item.download_url + ')',
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'center center',
                        backgroundSize: 'cover'
                    }

                    var timestamp = (this.props.currentFilter.source === 'question') ? item.submission.date_created : this.props.record.date_created;
                    var formattedDate = this.props.formatDate(timestamp)
                    return (
                        <bem.AssetGallery__gridItem key={j} className="col4 one-one" style={divStyle} onClick={() => this.props.openModal(this.props.currentIndex , j)}>
                            <bem.AssetGallery__gridItemOverlay>
                                <div className="text">
                                    <h5>{this.props.currentFilter.source === 'question'
                                            ? 'Record #' + parseInt(j + 1)
                                            : item.question.label}</h5>
                                    <p>{formattedDate}</p>
                                </div>
                            </bem.AssetGallery__gridItemOverlay>
                        </bem.AssetGallery__gridItem>
                    );
                }.bind(this))}
                <LoadMoreAttachmentsBtn index={this.props.currentIndex} filter={this.props.currentFilter.source} loadMore={this.props.loadMoreAttachments} count={this.props.record.attachments.count}/>
            </div>
        );
    }
});

//Slider Navigation
let RightNavButton = React.createClass({
    render() {
        const {className, onClick} = this.props;
        return (
            <button onClick={onClick} className={className}>
                <i className="material-icons">chevron_right</i>
            </button>
        )
    }
});
let LeftNavButton = React.createClass({
    render() {
        const {className, onClick} = this.props;
        return (
            <button onClick={onClick} className={className}>
                <i className="material-icons">chevron_left</i>
            </button>
        )
    }
});

//Load More Buttons
let LoadMoreAttachmentsBtn = React.createClass({
    getInitialState: function() {
        return {page: 2, enabled: true};
    },
    handleClick: function() {
        let newPage = this.state.page + 1;
        this.props.loadMore(this.props.filter, this.props.index, this.state.page);
        let enabled = (this.props.count / (newPage + 1) > 1)
            ? true
            : false;
        console.log(enabled);
        this.setState({page: newPage, enabled: enabled});
    },
    render: function() {
        let btn = null;
        if (this.state.enabled && this.props.filter == 'question') {
            btn = (
                <div>
                    <button onClick={this.handleClick}>Load more</button>
                </div>
            );
        }
        return btn;
    }
});

let LoadMoreRecordsBtn = React.createClass({
    getInitialState: function() {
        return {page: 2, enabled: true};
    },
    handleClick: function() {
        let newPage = this.state.page + 1;
        this.props.loadMore(this.props.filter, this.state.page);
        console.log("COUNT:", this.props.count);
        console.log(this.props.count / (newPage + 1));
        let enabled = (this.props.count / (newPage + 1) > 1)
            ? true
            : false;
        // console.log("Enabled: ", enabled);
        this.setState({page: newPage, enabled: enabled});
    },
    render: function() {
        let btn = null;
        if (this.state.enabled && this.props.filter == 'submission') {
            btn = (
                <div>
                    <button onClick={this.handleClick}>Load more</button>
                </div>
            );
        }
        return btn;
    }
})

module.exports = CollectionsGallery;
