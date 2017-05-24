import React from 'react';
// import Modal from 'react-modal';
import bem from '../../bem';
import ui from '../../ui';
import Select from 'react-select';
import Slider from 'react-slick';
import CollectionModal from './collectionModal';
// import CollectionFilter from './collectionFilter';
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
            hasMoreRecords: true,
            page: 2,
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
            console.log(response);
            this.setState({
                assets: response
            });
        });
    },
    componentDidMount: function() {
        this.loadGalleryData(this.props.uid, 'question');
    },

    formatDate : function(myDate){
        let timestamp = moment(new Date(myDate)).format('DD-MMM-YYYY h:mm:ssa');
        // console.log(myDate, " => DATE FORMATTING => ", timestamp);
        return timestamp;
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
    loadMoreAttachments(galleryIndex, page, callback) {
        this.state.assets.loaded = false;
        return dataInterface.loadQuestionAttachment(this.props.uid, this.state.filter.source, galleryIndex, page, this.state.defaultPageSize, callback).done((response) => {
            let assets = this.state.assets
            assets.loaded = true;
            assets.results[galleryIndex].attachments.results.push(...response.attachments.results);
            assets.loaded= true;
            if(callback){
                callback(response);
            }
        });
    },
	loadMoreRecords() {
        this.state.assets.loaded = false;
        return dataInterface.loadMoreRecords(this.props.uid, this.state.filter.source, this.state.page, this.state.defaultPageSize).done((response) => {
            let assets = this.state.assets
            assets.loaded = true;
            assets.results.push(...response.results);
            this.setState({assets});
            let newPage = this.state.page + 1;
            this.setState({page: newPage, hasMoreRecords: response.next});
        });
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
    goToSlide(index) {
        this.refs.slider.slickGoTo(index);
    },
    //Modal Custom
    handleCarouselChange: function(currentSlide, nextSlide) {
        let record = this.state.assets.results[this.state.activeParentIndex];
        let attachment = record.attachments.results[nextSlide];
        this.setState({
            activeIndex: nextSlide,
            activeTitle: record.label || attachment.question.label,
            activeDate: this.formatDate(record.date_created || attachment.submission.date_created)
        });
    },
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

    // RENDER
    render() {

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
            // TODO Create A CollectionModal class!!!
            return (
                <bem.AssetGallery>
                    <link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons"/>
                    <GalleryHeading
                        attachments_count={this.state.assets.attachments_count}
                        currentFilter={this.state.filter}
                        filters={filters}
                        switchFilter={this.switchFilter}/>

                        <bem.AssetGallery__grid>
                            {this.state.assets.results.map(function(record, i) {
                                let galleryTitle =  (this.state.filter.source === 'question') ? record.label : 'Record #' + parseInt(i + 1);
                                return (
                                    <GalleryGrid
                                        galleryTitle={galleryTitle}
                                        uid={this.props.uid}
                                        key={i}
                                        galleryIndex={i}
                                        record={record}
                                        loadMoreAttachments={this.loadMoreAttachments}
                                        count={this.state.assets.count}
                                        currentFilter={this.state.filter.source}
                                        assets={this.state.assets}
                                        formatDate={this.formatDate}
                                        openModal={this.openModal}
                                        pageSize={this.state.defaultPageSize}/>
                                    );
                                }.bind(this))}

                            <div>{(this.state.hasMoreRecords && this.state.filter.source=='submission') ? <button onClick={this.loadMoreRecords} className='mdl-button mdl-button--raised mdl-button--colored'>Load more</button> : null}</div>

                        </bem.AssetGallery__grid>
                    {/*  TODO move modal inside gallery and pass local props */}
                    <CollectionModal
                        showModal={this.state.showModal}
                        infoOpen={this.state.infoOpen}
                        results={this.state.assets.results[this.state.activeParentIndex].attachments.results}
                        closeModal={this.closeModal}
                        toggleInfo={this.toggleInfo}
                        handleCarouselChange={this.handleCarouselChange}
                        updateActiveAsset={this.updateActiveAsset}

                        filter={this.state.filter.source}
                        activeIndex={this.state.activeIndex}
                        date={this.state.activeDate}
                        title={this.state.activeTitle}
                        activeParentIndex={this.state.activeParentIndex}
                    />

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
    getInitialState: function() {
        return {
            page: 2,
            hasMoreAttachments: true,
        };
    },
    loadMoreAttachments: function() {
        this.props.assets.loaded = false;
        let that =this;
        let res = this.props.loadMoreAttachments(this.props.galleryIndex, this.state.page, function(response){
            let newPage = this.state.page + 1;
            this.setState({page: newPage, hasMoreAttachments: response.attachments.next});
            this.props.assets.loaded = true;
        }.bind(this));
    },
    render(){
        return (

            <div key={this.props.galleryIndex} >
                <h2>{this.props.galleryTitle}</h2>
                {this.props.record.attachments.results.map(function(item, j) {
                    var timestamp = (this.props.currentFilter === 'question') ? item.submission.date_created : this.props.record.date_created;
                    return (
                        <GalleryGridItem
                            key={j}
                            date={this.props.formatDate(timestamp)}
                            itemTitle={this.props.currentFilter === 'question' ? 'Record #' + parseInt(j + 1) : item.question.label}
                            download_url={item.download_url}
                            galleryIndex={this.props.galleryIndex}
                            itemIndex={j}
                            openModal={this.props.openModal}
                        />
                    );
                }.bind(this))}

                <div>
                    {(this.state.hasMoreAttachments  && this.props.currentFilter === 'question') ? <button onClick={this.loadMoreAttachments} className='mdl-button mdl-button--raised mdl-button--colored'>Load more</button> : null}
                </div>
            </div>
        )
    }
});

let GalleryGridItem = React.createClass({
    render(){
        let itemStyle = {
            backgroundImage: 'url(' + this.props.download_url + ')',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center center',
            backgroundSize: 'cover'
        }
        return (
            <bem.AssetGallery__gridItem className="col4 one-one" style={itemStyle} onClick={() => this.props.openModal(this.props.galleryIndex , this.props.itemIndex)}>
                <bem.AssetGallery__gridItemOverlay>
                    <div className="text">
                        <h5>{this.props.itemTitle}</h5>
                        <p>{this.props.date}</p>
                    </div>
                </bem.AssetGallery__gridItemOverlay>
            </bem.AssetGallery__gridItem>
        );
    }
});



module.exports = CollectionsGallery;
