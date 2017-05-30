import React from 'react';
import bem from '../../bem';
import ReactDOM from 'react-dom';
import FormGalleryModal from './formGalleryModal';
import FormGalleryFilter from './formGalleryFilter';
import {dataInterface} from '../../dataInterface';
import moment from 'moment';
import {t} from '../../utils';

var FormGallery = React.createClass({
    displayName: 'FormGallery',
    propTypes: {
        label: React.PropTypes.string
    },
    //Init
    getInitialState: function() {
        this.toggleInfo = this.toggleInfo.bind(this);
        return {
            defaultPageSize: 2,
            hasMoreRecords: false,
            nextRecordsPage: 2,
            showModal: false,
            isModalSidebarOpen: true,
            activeID: null,
            activeTitle: null,
            activeDate: null,
            galleryIndex: 0,
            galleryItemIndex: 0,
            searchTerm: '',
            filter: {
                source: 'question',
                label: t('Group by Question'),
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
    componentDidMount: function() {
        this.loadGalleryData(this.props.uid, 'question');
    },
    formatDate : function(myDate){
        let timestamp = moment(new Date(myDate)).format('DD-MMM-YYYY h:mm:ssa');
        return timestamp;
    },
    loadGalleryData: function(uid, filter) {
        dataInterface.filterGalleryImages(uid, filter, this.state.defaultPageSize).done((response) => {
            response.loaded = true;
            this.setState({
                assets: response
            });
        });
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
        this.setState({'searchTerm': event.target.value});
    },

    // Pagination
    loadMoreAttachments(galleryIndex, galleryPage) {
        this.state.assets.loaded = false;
        dataInterface.loadQuestionAttachment(this.props.uid, this.state.filter.source, galleryIndex, galleryPage, this.state.defaultPageSize).done((response) => {
            let assets = this.state.assets;
            assets.results[galleryIndex].attachments.results.push(...response.attachments.results);
            assets.loaded= true;
            this.setState({assets});
        });
    },
	loadMoreRecords() {
        this.state.assets.loaded = false;
        console.log("Inside loadMoreRecords", this.state.nextRecordsPage);
        return dataInterface.loadMoreRecords(this.props.uid, this.state.filter.source, this.state.nextRecordsPage, this.state.defaultPageSize).done((response) => {
            let assets = this.state.assets;
            assets.loaded = true;
            assets.results.push(...response.results);
            this.setState({assets, hasMoreRecords: response.next, nextRecordsPage: this.state.nextRecordsPage + 1});
        });
    },
    // MODAL
    openModal: function(record_index, attachment_index) {
        let record = this.state.assets.results[record_index];
        let attachment = record.attachments.results[attachment_index];
        this.setState({
            showModal: true,
            activeID: attachment.id,
            galleryIndex: record_index,
            galleryItemIndex: attachment_index,
            activeTitle: record.label || attachment.question.label,
            activeDate: this.formatDate(record.date_created || attachment.submission.date_created)
        });
    },
    closeModal: function() {
        this.setState({showModal: false});
    },
    toggleInfo(){
        this.setState({
            isModalSidebarOpen: !this.state.isModalSidebarOpen
        });
    },
    goToSlide(index) {
        this.refs.slider.slickGoTo(index);
    },
    //Modal Custom
    handleCarouselChange: function(currentSlide, nextSlide) {
        let record = this.state.assets.results[this.state.galleryIndex];
        let attachment = record.attachments.results[nextSlide];
        this.setState({
            galleryItemIndex: nextSlide,
            activeTitle: record.label || attachment.question.label,
            activeDate: this.formatDate(record.date_created || attachment.submission.date_created)
        });
    },
    updateActiveAsset(record_index, attachment_index) {
        let record = this.state.assets.results[record_index];
        let attachment = record.attachments[attachment_index];
        this.setState({
            galleryIndex: record_index,
            galleryItemIndex: attachment_index,
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
                label: t('Group by Question')
            }, {
                value: 'submission',
                label: t('Group by Record')
            }
        ]
        if (this.state.assets.loaded) {
            return (
                <bem.AssetGallery>
                    <FormGalleryFilter
                        attachments_count={this.state.assets.attachments_count}
                        currentFilter={this.state.filter}
                        filters={filters}
                        switchFilter={this.switchFilter}
                        setSearchTerm={this.setSearchTerm}/>


                        {this.state.assets.results.map(function(record, i) {
                            let galleryTitle =  (this.state.filter.source === 'question') ? record.label : 'Record #' + parseInt(i + 1);
                            let searchRegEx = new RegExp(this.state.searchTerm, "i");
                            let searchTermMatched = this.state.searchTerm =='' || galleryTitle.match(searchRegEx) || this.formatDate(record.date_created).match(this.state.searchTerm);

                            if(searchTermMatched){
                                return (
                                    <FormGalleryGrid
                                        key={i}
                                        uid={this.props.uid}
                                        galleryTitle={galleryTitle}
                                        galleryIndex={i}
                                        galleryItems={record.attachments.results}
                                        galleryDate={record.date_created}
                                        galleryAttachmentsCount={record.attachments.count}
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

                    {/*  TODO move modal inside gallery and pass local props */}
                    <FormGalleryModal
                        showModal={this.state.showModal}
                        isModalSidebarOpen={this.state.isModalSidebarOpen}
                        results={this.state.assets.results[this.state.galleryIndex].attachments.results}
                        closeModal={this.closeModal}
                        toggleInfo={this.toggleInfo}
                        handleCarouselChange={this.handleCarouselChange}
                        updateActiveAsset={this.updateActiveAsset}
                        filter={this.state.filter.source}
                        galleryIndex={this.state.galleryIndex}
                        galleryItemIndex={this.state.galleryItemIndex}
                        date={this.state.activeDate}
                        title={this.state.activeTitle}
                    />

                </bem.AssetGallery>
            );

        } else {
            return null;
        }
    }
});


let FormGalleryGrid = React.createClass({
    getInitialState: function() {
        return {
            galleryPage: 1,
            hasMoreAttachments: false,
        };
    },
    toggleLoadMoreBtn: function(){
        let currentlyLoadedGalleryAttachments =  this.state.galleryPage * this.props.defaultPageSize;
        let galleryHasMore = (currentlyLoadedGalleryAttachments < this.props.galleryAttachmentsCount ) ? true : false;
        this.setState({hasMoreAttachments: galleryHasMore});
    },
    componentDidMount(){
        this.toggleLoadMoreBtn();
        this.setState({galleryPage: this.state.galleryPage + 1});
    },
    loadMoreAttachments: function() {
        this.props.loadMoreAttachments(this.props.galleryIndex, this.state.galleryPage);
        this.toggleLoadMoreBtn();
        let newGalleryPage = (this.state.hasMoreAttachments) ? this.state.galleryPage + 1 : this.state.galleryPage;
        this.setState({galleryPage: newGalleryPage});
    },
    render(){
        return (
            <div key={this.props.galleryIndex}>
                <h2>{this.props.galleryTitle}</h2>
                <bem.AssetGallery__grid>
                    {this.props.galleryItems.map(function(item, j) {
                        var timestamp = (this.props.currentFilter === 'question') ? item.submission.date_created : this.props.galleryDate;
                        return (
                            <FormGalleryGridItem
                                key={j}
                                date={this.props.formatDate(timestamp)}
                                itemTitle={this.props.currentFilter === 'question' ? t('Record') + ' #' + parseInt(j + 1) : item.question.label}
                                url={item.medium_download_url}
                                galleryIndex={this.props.galleryIndex}
                                galleryItemIndex={j}
                                openModal={this.props.openModal}
                            />
                        );
                    }.bind(this))}

                    <div className="form-view__cell form-view__cell--centered">
                        {(this.state.hasMoreAttachments  && this.props.currentFilter === 'question') ? <button onClick={this.loadMoreAttachments} className='mdl-button mdl-button--colored'>{t('Load More')}</button> : null}
                    </div>
                </bem.AssetGallery__grid>
            </div>
        );
    }
});

let FormGalleryGridItem = React.createClass({
    componentDidMount() {
        var elem = ReactDOM.findDOMNode(this);
      	elem.style.opacity = 0;
      	window.requestAnimationFrame(function() {
      		elem.style.transition = "opacity 500ms";
      		elem.style.opacity = 1;
      	});
    },
    render(){
        let itemStyle = {
            backgroundImage: 'url(' + this.props.url + ')',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center center',
            backgroundSize: 'cover'
        }
        return (
            <bem.AssetGallery__gridItem className="col4 one-one" style={itemStyle} onClick={() => this.props.openModal(this.props.galleryIndex , this.props.galleryItemIndex)}>
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

module.exports = FormGallery;
