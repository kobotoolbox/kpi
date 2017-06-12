import React from 'react';
import Modal from 'react-modal';
import bem from '../../bem';
import ui from '../../ui';
// import {dataInterface} from '../../dataInterface';
import Slider from 'react-slick';
import {t} from '../../utils';

let FormGalleryModal = React.createClass({
    componentDidUpdate : function(){
        if (this.refs.slider) {
            this.refs.slider.slickGoTo(this.props.galleryItemIndex);
        }
    },
    handleCarouselChange(currentIndex, newIndex){
        this.props.changeActiveGalleryIndex(newIndex);
    },

    render(){
		const settings = {
			dots: false,
			fade: true,
			lazyLoad: true,
			infinite: false,
			speed: 500,
			slidesToShow: 1,
			slide: 'slide',
			slidesToScroll: 1,
			initialSlide: this.props.galleryItemIndex,
			nextArrow: <RightNavButton/>,
			prevArrow: <LeftNavButton/>
		}

        return (
            <Modal isOpen={true} contentLabel="Modal">
                <bem.AssetGallery__modal>
                    <ui.Modal.Body>

                        <bem.AssetGallery__modalCarousel className="col8">
                            <Slider ref="slider" {...settings} beforeChange={this.handleCarouselChange}>
                                {this.props.activeGalleryAttachments.map(function (item, i) {
                                    return (
                                        <div key={i}>
                                            <img alt={this.props.galleryTitle} src={item.large_download_url}/>
                                        </div>
                                    )
                                }.bind(this))}
                            </Slider>
                        </bem.AssetGallery__modalCarousel>

                        <FormGalleryModalSidebar
                            activeGalleryAttachments={this.props.activeGalleryAttachments}
                            filter={this.props.filter}
                            galleryItemIndex={this.props.galleryItemIndex}
                            galleryTitle={this.props.galleryTitle}
                            galleryIndex={this.props.activeGallery.index}
                            date={this.props.galleryDate}
                            changeActiveGalleryIndex={this.props.changeActiveGalleryIndex}
                            closeModal={this.props.closeModal}
                            setSearchTerm={this.props.setSearchTerm}
                        />

                    </ui.Modal.Body>
                </bem.AssetGallery__modal>
            </Modal>
        );
    }
});

let FormGalleryModalSidebar = React.createClass({
    render(){
        let currentRecordIndex = (this.props.filter === 'question' ? this.props.galleryItemIndex + 1 : this.props.galleryIndex + 1);
        return (
            <bem.AssetGallery__modalSidebar className="col4 open">
                <i className="toggle-info k-icon-close" onClick={this.props.closeModal}></i>
                <div>
                    <div className="info__outer">
                        <div className="light-grey-bg">
                            <h4>{t('Information')}</h4>
                        </div>
                        <div className="info__inner">
                            <p>{t('Record')} #{currentRecordIndex}</p>
                            <h3>{this.props.galleryTitle}</h3>
                            <p>{this.props.date}</p>
                        </div>
                    </div>

                    {(this.props.activeGalleryAttachments != undefined) ?
                        <FeaturedGridItems
                            activeGalleryAttachments={this.props.activeGalleryAttachments}
                            galleryTitle={this.props.galleryTitle}
                            galleryItemIndex={this.props.galleryItemIndex}
                            changeActiveGalleryIndex={this.props.changeActiveGalleryIndex}
                        />
                    : null}

                </div>
            </bem.AssetGallery__modalSidebar>
        );
    }
});

let FeaturedGridItems = React.createClass({
    getInitialState: function() {
        return {
            maxItems: 2,
            currentIndex : 0
        };
    },
    goToFilter: function(gridLabel){
        this.props.closeModal();
        this.props.setSearchTerm(gridLabel);
    },
    render(){
        let featuredItems = this.props.activeGalleryAttachments.slice();
        featuredItems.splice(this.props.galleryItemIndex, 1);
        return (
            <div className="padding--15">
                <h5 onClick={() => this.goToFilter(this.props.galleryTitle)}>{t('More for') + " " + this.props.galleryTitle}</h5>
                <bem.AssetGallery__modalSidebarGrid>
                    {featuredItems.filter((j, index) => (index < 6)).map(function(item, j) {

                        var divStyle = {
                            backgroundImage: 'url('+ item.medium_download_url + ')',
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'center center',
                            backgroundSize: 'cover'
                        }
                        return (
                            <bem.AssetGallery__modalSidebarGridItem key={j} className="col6" onClick={() => this.props.changeActiveGalleryIndex(j)}>
                                <div className="one-one" style={divStyle}></div>
                            </bem.AssetGallery__modalSidebarGridItem>
                        )

                    }.bind(this))}
                </bem.AssetGallery__modalSidebarGrid>
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
                <i className="k-icon-next"></i>
            </button>
        )
    }
});

let LeftNavButton = React.createClass({
    render() {
        const {className, onClick} = this.props;
        return (
            <button onClick={onClick} className={className}>
                <i className="k-icon-prev"></i>
            </button>
        )
    }
});




module.exports = FormGalleryModal;
