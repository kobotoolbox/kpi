import React from 'react';
// import Modal from 'react-modal';
import bem from '../../bem';
import ui from '../../ui';
import ReactDOM from 'react-dom';
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
            hasMoreRecords: false,
            page: 1,
            showModal: false,
            collectionItemIndex: 0,
            activeID: null,
            activeTitle: null,
            activeDate: null,
            collectionIndex: 0,
            infoOpen: true,
            searchedTerm: '',
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
                assets: response,
            });
        });
    },
    componentDidMount: function() {
        this.loadGalleryData(this.props.uid, 'question');
        this.setState({page: this.state.page + 1});
    },

    formatDate : function(myDate){
        let timestamp = moment(new Date(myDate)).format('DD-MMM-YYYY h:mm:ssa');
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
                assets: response,
                hasMoreRecords: (newFilter == 'submission') ? response.next : this.state.hasMoreRecords //Check if more records exist!
            });
        });
    },
    setSearchTerm(event){
        this.setState({'searchedTerm': event.target.value});
    },

    // Pagination
    loadMoreAttachments(collectionIndex, page, callback) {
        this.state.assets.loaded = false;
        dataInterface.loadQuestionAttachment(this.props.uid, this.state.filter.source, collectionIndex, page, this.state.defaultPageSize).done((response) => {
            let assets = this.state.assets;
            assets.results[collectionIndex].attachments.results.push(...response.attachments.results);
            assets.loaded= true;
            this.setState({assets});
        });
    },
	loadMoreRecords() {
        this.state.assets.loaded = false;
        return dataInterface.loadMoreRecords(this.props.uid, this.state.filter.source, this.state.page, this.state.defaultPageSize).done((response) => {
            let assets = this.state.assets;
            assets.loaded = true;
            assets.results.push(...response.results);
            this.setState({assets});
            this.setState({page: this.state.page + 1, hasMoreRecords: response.next});
        });
    },
    // MODAL
    openModal: function(record_index, attachment_index) {
        let record = this.state.assets.results[record_index];
        let attachment = record.attachments.results[attachment_index];
        this.setState({
            showModal: true,
            activeID: attachment.id,
            collectionItemIndex: attachment_index,
            collectionIndex: record_index,
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
        let record = this.state.assets.results[this.state.collectionIndex];
        let attachment = record.attachments.results[nextSlide];
        this.setState({
            collectionItemIndex: nextSlide,
            activeTitle: record.label || attachment.question.label,
            activeDate: this.formatDate(record.date_created || attachment.submission.date_created)
        });
    },
    updateActiveAsset(record_index, attachment_index) {
        let record = this.state.assets.results[record_index];
        let attachment = record.attachments[attachment_index];
        this.setState({
            collectionItemIndex: attachment_index,
            collectionIndex: record_index,
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
            return (
                <bem.AssetGallery>
                    <link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons"/>

                    <CollectionHeading
                        attachments_count={this.state.assets.attachments_count}
                        currentFilter={this.state.filter}
                        filters={filters}
                        switchFilter={this.switchFilter}
                        setSearchTerm={this.setSearchTerm}/>

                    <bem.AssetGallery__grid>
                        {this.state.assets.results.map(function(record, i) {
                            let collectionTitle =  (this.state.filter.source === 'question') ? record.label : 'Record #' + parseInt(i + 1);
                            if(this.state.searchedTerm=='' || collectionTitle.match(new RegExp(this.state.searchedTerm, "i"))){
                                return (
                                    <Collection
                                        key={i}
                                        uid={this.props.uid}
                                        collectionTitle={collectionTitle}
                                        collectionIndex={i}
                                        collectionItems={record.attachments.results}
                                        collectionDate={record.date_created}
                                        collectionAttachmentsCount={record.attachments.count}
                                        loadMoreAttachments={this.loadMoreAttachments}
                                        currentFilter={this.state.filter.source}
                                        formatDate={this.formatDate}
                                        openModal={this.openModal}
                                        defaultPageSize={this.state.defaultPageSize}
                                    />
                                );
                            }else{
                                return null;
                            }
                            }.bind(this))}

                        <div className="form-view__cell form-view__cell--centered">
                            {(this.state.hasMoreRecords && this.state.filter.source=='submission') ? <button onClick={this.loadMoreRecords} className='mdl-button mdl-button--colored'>Load more</button> : null}
                        </div>

                    </bem.AssetGallery__grid>

                    {/*  TODO move modal inside gallery and pass local props */}
                    <CollectionModal
                        showModal={this.state.showModal}
                        infoOpen={this.state.infoOpen}
                        results={this.state.assets.results[this.state.collectionIndex].attachments.results}
                        closeModal={this.closeModal}
                        toggleInfo={this.toggleInfo}
                        handleCarouselChange={this.handleCarouselChange}
                        updateActiveAsset={this.updateActiveAsset}

                        filter={this.state.filter.source}
                        collectionItemIndex={this.state.collectionItemIndex}
                        date={this.state.activeDate}
                        title={this.state.activeTitle}
                        collectionIndex={this.state.collectionIndex}
                    />

                </bem.AssetGallery>
            );

        } else {
            return null;
        }
    }
});

let CollectionHeading = React.createClass({
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
                        <input className="text-display" placeholder={this.props.currentFilter.label} onChange={this.props.setSearchTerm}/>
                        <Select ref="filterSelect" className="icon-button-select" options={this.props.filters} simpleValue name="selected-filter" value={this.props.currentFilter.source} onChange={this.props.switchFilter} searchable={false}/>
                    </bem.AssetGallery__headingSearchFilter>
                </div>
            </bem.AssetGallery__heading>
        )
    }
});

let Collection = React.createClass({
    getInitialState: function() {
        return {
            collectionPage: 1,
            hasMoreAttachments: false,
        };
    },
    toggleLoadMoreBtn: function(){
        let currentlyLoadedCollectionAttachments =  this.state.collectionPage * this.props.defaultPageSize;
        let collectionHasMore = (currentlyLoadedCollectionAttachments < this.props.collectionAttachmentsCount ) ? true : false;
        this.setState({hasMoreAttachments: collectionHasMore});
    },
    componentDidMount(){
        this.toggleLoadMoreBtn();
        this.setState({collectionPage: this.state.collectionPage + 1});
    },
    loadMoreAttachments: function() {
        this.props.loadMoreAttachments(this.props.collectionIndex, this.state.collectionPage, this.state);
        this.toggleLoadMoreBtn();
        let newCollectionPage = (this.state.hasMoreAttachments) ? this.state.collectionPage + 1 : this.state.collectionPage;
        this.setState({collectionPage: newCollectionPage});
    },
    render(){
        return (
            <div key={this.props.collectionIndex}>
                <h2>{this.props.collectionTitle}</h2>
                {this.props.collectionItems.map(function(item, j) {
                    var timestamp = (this.props.currentFilter === 'question') ? item.submission.date_created : this.props.collectionDate;
                    return (
                        <CollectionItem
                            key={j}
                            date={this.props.formatDate(timestamp)}
                            itemTitle={this.props.currentFilter === 'question' ? 'Record #' + parseInt(j + 1) : item.question.label}
                            download_url={item.download_url}
                            collectionIndex={this.props.collectionIndex}
                            collectionItemIndex={j}
                            openModal={this.props.openModal}
                        />
                    );
                }.bind(this))}

                <div className="form-view__cell form-view__cell--centered">
                    {(this.state.hasMoreAttachments  && this.props.currentFilter === 'question') ? <button onClick={this.loadMoreAttachments} className='mdl-button mdl-button--colored'>Load more</button> : null}
                </div>
            </div>
        );
    }
});

let CollectionItem = React.createClass({
    componentDidMount() {
        // Get the components DOM node
        var elem = ReactDOM.findDOMNode(this);
      	// Set the opacity of the element to 0
      	elem.style.opacity = 0;
      	window.requestAnimationFrame(function() {
      		// Now set a transition on the opacity
      		elem.style.transition = "opacity 500ms";
      		// and set the opacity to 1
      		elem.style.opacity = 1;
      	});
    },
    render(){
        let itemStyle = {
            backgroundImage: 'url(' + this.props.download_url + ')',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center center',
            backgroundSize: 'cover'
        }
        return (
            <bem.AssetGallery__gridItem className="col4 one-one" style={itemStyle} onClick={() => this.props.openModal(this.props.collectionIndex , this.props.collectionItemIndex)}>
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
