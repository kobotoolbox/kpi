import React from 'react';
import Modal from 'react-modal';
import bem from '../../bem';
import ui from '../../ui';
import {dataInterface} from '../../dataInterface';
import Slider from 'react-slick';
import {t} from '../../utils';

let CollectionModal = React.createClass({
    // getInitialState: function(){
    //     return{
    //         modalIsOpen : ,
    //         modalInfoOpen:
    //     }
    // },

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
			initialSlide: this.props.collectionItemIndex,
			nextArrow: <RightNavButton/>,
			prevArrow: <LeftNavButton/>
		}
        return (
            <Modal isOpen={this.props.showModal} contentLabel="Modal" >
                <bem.AssetGallery__modal>
                    <ui.Modal.Body>
                        <bem.AssetGallery__modalCarousel className={"col8 "+ (this.props.infoOpen ? '' : 'full-screen')}>
                            <bem.AssetGallery__modalCarouselTopbar className={this.props.infoOpen ? 'show' : 'show--hover'}>
                                <i className="close-modal material-icons" onClick={this.props.closeModal}>keyboard_backspace</i>
                                <i className="toggle-info material-icons" onClick={this.props.toggleInfo}>info_outline</i>
                            </bem.AssetGallery__modalCarouselTopbar>
                            <Slider ref="slider" {...settings} beforeChange={this.props.handleCarouselChange}>
                                {this.props.results.map(function (item, i) {
                                    return (
                                        <div key={item.id}>
                                            <img alt={this.props.title} src={item.large_download_url}/>
                                        </div>
                                    )
                                }.bind(this))}
                            </Slider>
                        </bem.AssetGallery__modalCarousel>

                        <CollectionModalSidebar
                            results={this.props.results}
                            isInfoOpen={this.props.infoOpen}
                            toggleInfo={this.props.toggleInfo}
                            filter={this.props.filter}
                            collectionItemIndex={this.props.collectionItemIndex}
                            collectionIndex={this.props.collectionIndex}
                            title={this.props.title}
                            date={this.props.date}

                            updateActiveAsset={this.props.updateActiveAsset}
                        />

                    </ui.Modal.Body>
                </bem.AssetGallery__modal>
            </Modal>
        );
    }
});

let CollectionModalSidebar = React.createClass({
    getInitialState: function(){
        return {
            status:  (this.props.isInfoOpen) ? 'open' : 'closed',
        }
    },
    render(){
        let currentRecordIndex = (this.props.filter === 'question' ? this.props.collectionItemIndex + 1 : this.props.collectionIndex + 1);
        return (
            <bem.AssetGallery__modalSidebar className={"col4 " + this.state.status}>
                <i className="toggle-info material-icons" onClick={this.props.toggleInfo}>{t('close')}</i>
                <div>
                    <div className="info__outer">
                        <div className="light-grey-bg">
                            <h4>{t('Information')}</h4>
                        </div>
                        <div className="info__inner">
                            <p>{t('Record')} #{currentRecordIndex}</p>
                            <h3>{this.props.title}</h3>
                            <p>{this.props.date}</p>
                        </div>
                    </div>

                    <CollectionModalSidebarGrid
                        results={this.props.results}
                        filter={this.props.filter}
                        currentRecordIndex={currentRecordIndex}
                        currentQuestion={this.props.title}
                        collectionItemIndex={this.props.collectionItemIndex}
                        collectionIndex={this.props.collectionIndex}
                        updateActiveAsset={this.props.updateActiveAsset}
                        date={this.props.date}
                    />
                </div>
            </bem.AssetGallery__modalSidebar>
        );
    }
});

let CollectionModalSidebarGrid = React.createClass({
    getInitialState: function() {
        return {
            maxItems: 2,
            count : 0
        };
    },
    render(){
        let gridLabel = (this.props.filter === 'submission' ? 'Record #' + this.props.currentRecordIndex : this.props.currentQuestion);
        let moreforItem = null;
        return (
            <div className="padding--15">
                <h5>More for {gridLabel}</h5>
                <bem.AssetGallery__modalSidebarGrid>

                    {this.props.results.map(function(item, j) {
                        if (this.props.collectionItemIndex !== j){ // if the item is not the active attachment
                            var divStyle = {
                                backgroundImage: 'url('+ item.download_url + ')',
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'center center',
                                backgroundSize: 'cover'
                            }
                            return (
                                <bem.AssetGallery__modalSidebarGridItem key={j} className="col6" onClick={() => this.props.updateActiveAsset(this.props)}>
                                    <div className="one-one" style={divStyle}></div>
                                </bem.AssetGallery__modalSidebarGridItem>
                            )
                        }
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




module.exports = CollectionModal;
