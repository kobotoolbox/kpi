import React from 'react';
// import Modal from 'react-modal';
import bem from '../../bem';
import ui from '../../ui';
import FormGalleryGridItem from './formGalleryGridItem';
import {dataInterface} from '../../dataInterface';
import {t} from '../../utils';
import ReactPaginate from 'react-paginate';
import Select from 'react-select';

let PaginatedModal = React.createClass({
    getInitialState: function() {
        return {
            offset: 1,
            offsetOptions: [
                {
                    value : 1,
                    label: 1
                },
                {
                    value : 10,
                    label: 10
                },
                {
                    value : 25,
                    label: 25
                },
                {
                    value : 50,
                    label: 50
                },
                {
                    value : 100,
                    label: 100
                }
            ],
            sortOptions: [
                {
                    'label': t('Show latest first'),
                    'value': 'desc'
                },
                {
                    'label': t('Show oldest first'),
                    'value': 'asc'
                }
            ],
            sortValue: 'asc',
            attachments: [],
            attachments_count: this.props.galleryAttachmentsCount,
            totalPages: 0,
            currentAttachmentsLoaded: 0,
            activeAttachmentsIndex: 0,
        }
    },
    componentDidMount: function() {
        this.resetGallery();
    },
    resetGallery: function(){
        this.setState({
            attachments: [],
            currentAttachmentsLoaded: 0
        })
        this.loadAttachments(1);
        this.setTotalPages();
        this.setActiveAttachmentsIndex(0);
    },
    setTotalPages: function() {
        let totalPages = Math.ceil(this.state.attachments_count / this.state.offset);
        this.setState({'totalPages' : totalPages});
    },
    setActiveAttachmentsIndex: function(index) {
        this.setState({'activeAttachmentsIndex': index});
    },
    changeOffset: function(offset){
        this.setState({'offset': offset}, function(){
            this.resetGallery();
        });
    },
    changeSort: function(sort){
        this.setState({'sortValue': sort}, function(){
            this.resetGallery();
        });
    },
    goToPage: function(page) {
        let attachmentNextPage = page.selected+1;
        let newActiveIndex = page.selected;
        if (this.state.attachments['page_'+attachmentNextPage] == undefined){
            this.loadAttachments(attachmentNextPage, ()=>{
                this.setActiveAttachmentsIndex(newActiveIndex);
            });
        }else{
            this.setActiveAttachmentsIndex(newActiveIndex);
        }
    },
    loadAttachments: function(page, callback) {
        dataInterface.loadQuestionAttachment(this.props.uid, 'question', this.props.galleryIndex, page, this.state.offset, this.state.sortValue).done((response) => {
            let newAttachments = this.state.attachments;
            let currentAttachementsLoaded = this.state.currentAttachmentsLoaded + response.attachments.results.length;
            newAttachments['page_'+page] = response.attachments.results;
            this.setState({
                'attachments': newAttachments,
                'currentAttachmentsLoaded': currentAttachementsLoaded
            });
        });
        if(callback){
            callback();
        }

    },
    render() {
        return (
            <bem.PaginatedModal>
                <ui.Modal open large onClose={this.props.togglePaginatedModal}>
                    <ui.Modal.Body>
                        <bem.PaginatedModal_heading>
                            <h2>{t('All Photo of') + " " + this.props.galleryTitle}</h2>
                            <h4>{t('Showing')} <b>{this.state.currentAttachmentsLoaded}</b> {t('of')} <b>{this.props.galleryAttachmentsCount}</b></h4>
                        </bem.PaginatedModal_heading>

                        <bem.PaginatedModal_body>

                            <GalleryControls
                                offsetOptions={this.state.offsetOptions}
                                offsetValue={this.state.offset}
                                changeOffset={this.changeOffset}
                                pageCount={this.state.totalPages}
                                goToPage={this.goToPage}
                                activeAttachmentsIndex={this.state.activeAttachmentsIndex}
                                sortOptions={this.state.sortOptions}
                                sortValue={this.state.sortValue}
                                changeSort={this.changeSort}
                            />

                            <bem.AssetGallery__grid>
                                {(this.state.attachments['page_'+(this.state.activeAttachmentsIndex+1)] != undefined) ?
                                    this.state.attachments['page_'+(this.state.activeAttachmentsIndex+1)].map(function(item, j) {
                                            var timestamp = (this.props.currentFilter === 'question') ? item.submission.date_created : this.props.galleryDate;
                                            return (
                                                <FormGalleryGridItem
                                                    key={j}
                                                    itemsPerRow="10"
                                                    date={this.props.formatDate(timestamp)}
                                                    itemTitle={this.props.currentFilter === 'question' ? t('Record') + ' ' + parseInt(j + 1) : item.question.label}
                                                    url={item.small_download_url}
                                                    galleryIndex={this.props.galleryIndex}
                                                    galleryItemIndex={j}
                                                    openModal={this.props.openModal}
                                                />
                                            );
                                    }.bind(this)) : null
                                }
                            </bem.AssetGallery__grid>

                            <GalleryControls
                                offsetOptions={this.state.offsetOptions}
                                offsetValue={this.state.offset}
                                changeOffset={this.changeOffset}
                                pageCount={this.state.totalPages}
                                goToPage={this.goToPage}
                                activeAttachmentsIndex={this.state.activeAttachmentsIndex}
                                sortOptions={this.state.sortOptions}
                                sortValue={this.state.sortValue}
                                changeSort={this.changeSort}
                            />

                        </bem.PaginatedModal_body>

                    </ui.Modal.Body>
                </ui.Modal>
            </bem.PaginatedModal>
        )
    }
});


let GalleryControls = React.createClass({

    render(){
        return(
            <div className='gallery-controls'>
                <div className='change-offset'>
                    <label>{t('Per page:')}</label>
                    <div className='form-modal__item'>
                        <Select
                            className="icon-button-select"
                            options={this.props.offsetOptions}
                            simpleValue
                            name="selected-filter"
                            value={this.props.offsetValue}
                            onChange={this.props.changeOffset}
                            autoBlur={true}
                            searchable={false}
                            clearable={false}
                        />
                    </div>
                </div>
                <div className='form-modal__item'>
                    <ReactPaginate
                        previousLabel={"Prev"}
                        nextLabel={"Next"}
                        breakLabel={'...'}
                        breakClassName={"break-me"}
                        pageCount={this.props.pageCount}
                        marginPagesDisplayed={1}
                        pageRangeDisplayed={3}
                        onPageChange={this.props.goToPage}
                        containerClassName={"pagination"}
                        activeClassName={"active"}
                        forcePage={this.props.activeAttachmentsIndex}
                    />
                </div>

                <div className='form-modal__item change-sort'>
                    <Select
                        className="icon-button-select"
                        options={this.props.sortOptions}
                        simpleValue
                        name="selected-filter"
                        value={this.props.sortValue}
                        onChange={this.props.changeSort}
                        autoBlur={true}
                        searchable={false}
                        clearable={false}
                    />
                </div>
            </div>
        )
    }
})
module.exports = PaginatedModal;
