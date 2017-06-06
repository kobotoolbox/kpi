import React from 'react';
import Modal from 'react-modal';
import bem from '../../bem';
import ui from '../../ui';
// import {dataInterface} from '../../dataInterface';
import {t} from '../../utils';

let PaginatedModal = React.createClass({
    componentDidUpdate : function(){

    },
    render(){
        return (
            <Modal isOpen={this.props.show} contentLabel="Modal" >
                <bem.PaginatedModal>
                    <ui.Modal.Body>
                        <bem.PaginatedModal_heading>
                            <i className="close-modal k-icon-close" onClick={this.props.togglePaginatedModal}></i>
                            <h2>{t('All Photo of') + " " + this.props.galleryTitle}</h2>
                            <h4>{t('Showing')} <b>{this.props.currentlyLoadedGalleryAttachments}</b> {t('of')} <b>{this.props.galleryAttachmentsCount}</b></h4>
                        </bem.PaginatedModal_heading>
                        <bem.PaginatedModal_pagination>

                        </bem.PaginatedModal_pagination>

                    </ui.Modal.Body>
                </bem.PaginatedModal>
            </Modal>
        );
    }
});




module.exports = PaginatedModal;
