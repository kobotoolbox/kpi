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
            offset: 4,
            offsetValues: [
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
            isOpen: false,
            sortBy: 'asc',
            attachments: [],
            attachments_count: this.props.galleryAttachmentsCount,
            totalPages: 0,
            currentAttachmentsLoaded: 0,
            activeAttachmentsIndex: 0,
            galleryLoaded: false
        }
    },
    componentDidMount: function() {
        this.resetGallery();
    },
    resetGallery: function(){
        // this.setState({'galleryLoaded' : false});
        this.loadAttachments(1, true);
        this.setTotalPages();
        this.setActiveAttachmentsIndex(0);
        this.setState({'galleryLoaded' : true});
    },
    setTotalPages: function() {
        let totalPages = Math.ceil(this.state.attachments_count / this.state.offset);
        this.setState({'totalPages' : totalPages});
    },
    setActiveAttachmentsIndex: function(index) {
        console.log("CUrrent Inedx: ", index);
        this.setState({'activeAttachmentsIndex': index});
    },
    changeOffset: function(offset){
        this.setState({'offset': offset}, function(){
            this.resetGallery();
        });
    },
    goToPage: function(page) {
        console.log("goToPage:");
        console.log(page.selected + 1);
        let attachmentNextPage = page.selected+1;
        let newActiveIndex = page.selected - 1;
        if (this.state.attachments[attachmentNextPage] == undefined){
            this.loadAttachments(attachmentNextPage, ()=>{
                this.setActiveAttachmentsIndex(newActiveIndex);
            });
        }else{
            this.setActiveAttachmentsIndex(newActiveIndex);
        }
    },
    loadAttachments: function(page, reset=false, callback) {
        console.log(this.props.uid, 'question', this.props.galleryIndex, page, this.state.offset, this.state.sortBy);
        dataInterface.loadQuestionAttachment(this.props.uid, 'question', this.props.galleryIndex, page, this.state.offset, this.state.sortBy).done((response) => {
            // If this is called with reset empty the attachments array otherwise set it to the value of attachments
            let newAttachments = (!reset) ? this.state.attachments : [];
            let currentAttachementsLoaded = (reset) ? response.attachments.results.length : this.state.currentAttachmentsLoaded + response.attachments.results.length;
            newAttachments.push(response.attachments.results);
            console.log("newAttachments: ");
            console.log(newAttachments);
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
        let activeAttachmentsArray = this.state.attachments[this.state.activeAttachmentsIndex];

        if (activeAttachmentsArray != undefined && this.state.galleryLoaded) {
            console.log(activeAttachmentsArray);
            return (
                <bem.PaginatedModal>
                    <ui.Modal open large onClose={this.props.togglePaginatedModal}>
                        <ui.Modal.Body>
                            <bem.PaginatedModal_heading>
                                <h2>{t('All Photo of') + " " + this.props.galleryTitle}</h2>
                                <h4>{t('Showing')} <b>{this.state.currentAttachmentsLoaded}</b> {t('of')} <b>{this.props.galleryAttachmentsCount}</b></h4>

                                <Select
                                    className="icon-button-select"
                                    options={this.state.offsetValues}
                                    simpleValue
                                    name="selected-filter"
                                    value={this.state.offsetValues.value}
                                    onChange={this.changeOffset}
                                    autoBlur={true}
                                    searchable={false}/>

                            </bem.PaginatedModal_heading>
                            <bem.PaginatedModal_body>

                                    <ReactPaginate previousLabel={"Prev"}
                                       nextLabel={"Next"}
                                       breakLabel={<a>...</a>}
                                       breakClassName={"break-me"}
                                       pageCount={this.state.totalPages}
                                       marginPagesDisplayed={1}
                                       pageRangeDisplayed={3}
                                       onPageChange={this.goToPage}
                                       containerClassName={"pagination"}
                                       activeClassName={"active"}
                                    />

                                    <bem.AssetGallery__grid>
                                        {activeAttachmentsArray.map(function(item, j) {
                                            var timestamp = (this.props.currentFilter === 'question')
                                                ? item.submission.date_created
                                                : this.props.galleryDate;
                                            return (<FormGalleryGridItem key={j} itemsPerRow="10" date={this.props.formatDate(timestamp)} itemTitle={this.props.currentFilter === 'question'
                                                ? t('Record') + ' ' + parseInt(j + 1)
                                                : item.question.label} url={item.small_download_url} galleryIndex={this.props.galleryIndex} galleryItemIndex={j} openModal={this.props.openModal}/>);
                                        }.bind(this))}
                                    </bem.AssetGallery__grid>

                            </bem.PaginatedModal_body>
                        </ui.Modal.Body>
                    </ui.Modal>
                </bem.PaginatedModal>
            )
        }else{
            return null;
        }

    }
});

module.exports = PaginatedModal;
