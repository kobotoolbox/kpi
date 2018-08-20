import React from 'react';
import autoBind from 'react-autobind';
import bem from '../../bem';
import ui from '../../ui';
import stores from '../../stores';
import Slider from 'react-slick';
import { t } from '../../utils';

export default class SingleGalleryModal extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
  }

  componentDidUpdate() {
    if (this.refs.slider) {
      this.refs.slider.slickGoTo(this.props.galleryItemIndex);
    }
  }
  handleCarouselChange(currentIndex, newIndex) {
    this.props.changeActiveGalleryIndex(newIndex);
  }

  render() {
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
      nextArrow: <RightNavButton />,
      prevArrow: <LeftNavButton />
    };

    return (
      <bem.SingleGalleryModal>
        <bem.SingleGalleryModal__carousel>
          <Slider
            ref='slider'
            {...settings}
            beforeChange={this.handleCarouselChange}
          >
            {this.props.activeGalleryAttachments.map(
              function(item, i) {
                return (
                  <div key={i}>
                    <img
                      alt={this.props.galleryTitle}
                      src={item.large_download_url}
                    />
                  </div>
                );
              }.bind(this)
            )}
          </Slider>
        </bem.SingleGalleryModal__carousel>

        <SingleGalleryModalSidebar
          activeGalleryAttachments={this.props.activeGalleryAttachments}
          filter={this.props.filter}
          galleryItemIndex={this.props.galleryItemIndex}
          galleryTitle={this.props.galleryTitle}
          galleryIndex={this.props.activeGallery.index}
          date={this.props.galleryDate}
          changeActiveGalleryIndex={this.props.changeActiveGalleryIndex}
        />
      </bem.SingleGalleryModal>
    );
  }
};

class SingleGalleryModalSidebar extends React.Component {
  setGalleryFilterQuery(newQuery) {
    stores.currentGallery.setState({filterQuery: newQuery});
    stores.pageState.hideModal();
  }

  render() {
    let currentRecordIndex = this.props.filter === 'question'
      ? this.props.galleryItemIndex + 1
      : this.props.galleryIndex + 1;
    let featuredItems = this.props.activeGalleryAttachments.slice();
    featuredItems.splice(this.props.galleryItemIndex, 1);
    return (
      <bem.SingleGalleryModal__sidebar className='open'>
        <bem.SingleGalleryModal__sidebarInfo>
            <p>{t('Record')} #{currentRecordIndex}</p>
            <h3>{this.props.galleryTitle}</h3>
            <p>{this.props.date}</p>
        </bem.SingleGalleryModal__sidebarInfo>

        {this.props.activeGalleryAttachments != undefined &&
          <bem.SingleGalleryModal__sidebarGridWrap>
            <h5 onClick={() => this.setGalleryFilterQuery(this.props.galleryTitle)}>
              {t('More for') + ' ' + this.props.galleryTitle}
            </h5>
            <bem.SingleGalleryModal__sidebarGrid>
              {featuredItems.filter((j, index) => index < 6).map(
                function(item, j) {
                  var divStyle = {
                    backgroundImage: 'url(' +
                      item.medium_download_url +
                      ')',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center center',
                    backgroundSize: 'cover'
                  };
                  return (
                    <bem.SingleGalleryModal__sidebarGridItem
                      key={j}
                      className='col6'
                      onClick={() => this.props.changeActiveGalleryIndex(j)}
                    >
                      <div className='one-one' style={divStyle} />
                    </bem.SingleGalleryModal__sidebarGridItem>
                  );
                }.bind(this)
              )}
            </bem.SingleGalleryModal__sidebarGrid>
          </bem.SingleGalleryModal__sidebarGridWrap>
        }
      </bem.SingleGalleryModal__sidebar>
    );
  }
};

class RightNavButton extends React.Component {
  render() {
    const { className, onClick } = this.props;
    return (
      <button onClick={onClick} className={className}>
        <i className='k-icon-next' />
      </button>
    );
  }
};

class LeftNavButton extends React.Component {
  render() {
    const { className, onClick } = this.props;
    return (
      <button onClick={onClick} className={className}>
        <i className='k-icon-prev' />
      </button>
    );
  }
};
