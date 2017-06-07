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
        this.setState({'galleryLoaded' : false});
        this.loadAttachments(1, true);
        this.setTotalPages();
        this.setActiveAttachmentsIndex(0);
        this.setState({'galleryLoaded' : true});
        console.log(this.state);
    },
    setTotalPages: function() {
        let totalPages = Math.ceil(this.state.attachments_count / this.state.offset);
        this.setState({'totalPages' : totalPages});
    },
    setActiveAttachmentsIndex: function(index) {
        this.setState({'activeAttachmentsIndex': index});
    },
    changeOffset: function(offset){
        console.log(offset);
        this.setState({'offset': offset}, function(){
            console.log(this.state.offset);
            this.resetGallery();
        });
    },
    goToPage: function(page) {
        console.log(page.selected);
        this.loadAttachments(page.selected + 1);
        this.setActiveAttachmentsIndex(page.selected);
    },
    loadAttachments: function(page, reset=false) {
        console.log("Load Page: ", page);
        if (this.state.attachments[page - 1] == undefined) {
            dataInterface.loadQuestionAttachment(this.props.uid, 'question', this.props.galleryIndex, page, this.state.offset, this.state.sortBy).done((response) => {
                let newAttachments = (reset) ? this.state.attachments : [];
                let currentAttachementsLoaded = (reset) ? response.attachments.results.length : this.state.currentAttachmentsLoaded + response.attachments.results.length;
                newAttachments.push(response.attachments.results);
                console.log(newAttachments);
                this.setState({
                    'attachments': newAttachments,
                    'currentAttachmentsLoaded': currentAttachementsLoaded
                });
            });
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

                                    <ReactPaginate previousLabel={"previous"}
                                       nextLabel={"next"}
                                       breakLabel={<a href="">...</a>}
                                       breakClassName={"break-me"}
                                       pageCount={this.state.totalPages}
                                       marginPagesDisplayed={2}
                                       pageRangeDisplayed={5}
                                       onPageChange={this.goToPage}
                                       containerClassName={"pagination"}
                                       subContainerClassName={"pages pagination"}
                                       activeClassName={"active"} />

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
