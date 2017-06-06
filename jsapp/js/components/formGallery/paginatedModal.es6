import React from 'react';
// import Modal from 'react-modal';
import bem from '../../bem';
import ui from '../../ui';
import FormGalleryGridItem from './formGalleryGridItem';
// import {dataInterface} from '../../dataInterface';
import {t} from '../../utils';

let PaginatedModal = React.createClass({
    getInitialState: function(){
        return {
            perPage: 10,
            perPageAvailableValues: [10, 25, 50, 100],
            isOpen: false
        }
    },
    componentDidUpdate : function(){

    },
    render(){
        if(this.props.show){
            return (
                <bem.PaginatedModal>
                    <ui.Modal open large onClose={this.props.togglePaginatedModal}>
                            <ui.Modal.Body>
                                <bem.PaginatedModal_heading>
                                    {/* <i className="close-modal k-icon-close" onClick={this.props.togglePaginatedModal}></i> */}
                                    <h2>{t('All Photo of') + " " + this.props.galleryTitle}</h2>
                                    <h4>{t('Showing')} <b>{this.props.currentlyLoadedGalleryAttachments}</b> {t('of')} <b>{this.props.galleryAttachmentsCount}</b></h4>
                                </bem.PaginatedModal_heading>
                                <bem.PaginatedModal_body>
                                    <bem.PaginatedModal_pagination>

                                    </bem.PaginatedModal_pagination>
                                    <bem.AssetGallery__grid>
                                        {this.props.galleryItems.map(function(item, j) {
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
