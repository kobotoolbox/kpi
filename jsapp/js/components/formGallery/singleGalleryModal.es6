import _ from 'underscore';
import React from 'react';
import Slider from 'react-slick';
import autoBind from 'react-autobind';
import reactMixin from 'react-mixin';
import Reflux from 'reflux';
import bem from '../../bem';
import ui from '../../ui';
import stores from '../../stores';
import {galleryActions, galleryStore} from './galleryInterface';
import {
  assign,
  t
} from '../../utils';
import {GALLERY_FILTER_OPTIONS} from '../../constants';

export default class SingleGalleryModal extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
    this.state = this.getInitialState();
    this.slickSettings = {
      dots: false,
      fade: true,
      lazyLoad: true,
      infinite: false,
      speed: 300,
      slidesToShow: 1,
      slide: 'slide',
      slidesToScroll: 1,
      initialSlide: this.state.activeGalleryIndex,
      nextArrow: <RightNavButton />,
      prevArrow: <LeftNavButton />,
      beforeChange: this.onBeforeSliderChange
    };
    this.setSliderIndexDebounced = _.debounce(this.setSliderIndex, this.slickSettings.speed + 100);
  }

  getInitialState() {
    const stateObj = {}
    assign(stateObj, galleryStore.state);
    stateObj.isGalleryReady = stateObj.activeGallery !== null;
    return stateObj;
  }

  componentDidMount() {
    this.listenTo(galleryStore, (storeChanges) => {
      if (storeChanges.activeGallery !== null) {
        assign(storeChanges, {isGalleryReady: true});
      }
      if (storeChanges.activeGalleryIndex !== null) {
        this.setSliderIndexDebounced(storeChanges.activeGalleryIndex);
      }
      this.setState(storeChanges);
    });
  }

  onBeforeSliderChange(prevIndex, newIndex) {
    this.setState({currentSliderIndex: newIndex});
  }

  setSliderIndex(newIndex) {
    if (newIndex !== this.state.currentSliderIndex) {
      this.refs.slider.slickGoTo(newIndex);
    }
  }

  showMoreFrom(questionName) {
    galleryActions.setFilters({filterQuery: questionName});
    stores.pageState.hideModal();
  }

  changeActiveGalleryIndex(evt) {
    galleryActions.setActiveGalleryIndex(evt.currentTarget.dataset.index);
  }

  renderLoadingMessage() {
    return (
      <bem.Loading>
        <bem.Loading__inner>
          <i />
          {t('loading...')}
        </bem.Loading__inner>
      </bem.Loading>
    );
  }

  renderGallery() {
    return (
      <React.Fragment>
        <bem.SingleGalleryModal__carousel>
          <Slider
            ref='slider'
            {...this.slickSettings}
          >
            {this.state.activeGalleryAttachments.map(
              function(item, i) {
                const inlineStyle = {
                  'backgroundImage': `url(${item.large_download_url})`,
                };
                return (
                  <bem.SingleGalleryModal__carouselImage key={i}>
                    <picture
                      style={inlineStyle}
                      title={item.short_filename}
                    />
                  </bem.SingleGalleryModal__carouselImage>
                );
              }.bind(this)
            )}
          </Slider>
        </bem.SingleGalleryModal__carousel>

        {this.renderSidebar()}
      </React.Fragment>
    );
  }

  renderSidebar() {
    return (
      <bem.SingleGalleryModal__sidebar className='open'>
        <bem.SingleGalleryModal__sidebarInfo>
            <p>{t('Record')} #{this.state.activeGalleryIndex}</p>
            <h3>{this.state.activeGalleryTitle}</h3>
            <p>{this.state.activeGalleryDate}</p>
        </bem.SingleGalleryModal__sidebarInfo>

        {this.state.activeGalleryAttachments &&
          <bem.SingleGalleryModal__sidebarGridWrap>
            <h5 onClick={() => this.showMoreFrom(this.state.activeGalleryTitle)}>
              {t('More from ##question##').replace('##question##', this.state.activeGalleryTitle)}
            </h5>

            <bem.SingleGalleryModal__sidebarGrid>
              {this.state.activeGalleryAttachments.map(
                function(item, j) {
                  const divStyle = {
                    backgroundImage: `url(${item.medium_download_url})`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center center',
                    backgroundSize: 'cover'
                  };
                  return (
                    <bem.SingleGalleryModal__sidebarGridItem
                      m={this.state.activeGalleryIndex === j ? 'selected' : null}
                      data-index={j}
                      onClick={this.changeActiveGalleryIndex}
                      key={j}
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

  render() {
    return (
      <bem.SingleGalleryModal>
        {!this.state.isGalleryReady &&
          this.renderLoadingMessage()
        }
        {this.state.isGalleryReady &&
          this.renderGallery()
        }
      </bem.SingleGalleryModal>
    );
  }
};

class RightNavButton extends React.Component {
  goRight() {
    let newIndex = galleryStore.state.activeGalleryIndex + 1;
    if (newIndex >= this.props.slideCount - 1) {
      newIndex = this.props.slideCount - 1;
    }
    galleryActions.setActiveGalleryIndex(newIndex);
  }

  render() {
    return (
      <button onClick={this.goRight.bind(this)} className={this.props.className}>
        <i className='k-icon-next' />
      </button>
    );
  }
};

class LeftNavButton extends React.Component {
  goLeft() {
    let newIndex = galleryStore.state.activeGalleryIndex - 1;
    if (newIndex < 0) {
      newIndex = 0;
    }
    galleryActions.setActiveGalleryIndex(newIndex);
  }

  render() {
    return (
      <button onClick={this.goLeft.bind(this)} className={this.props.className}>
        <i className='k-icon-prev' />
      </button>
    );
  }
};

reactMixin(SingleGalleryModal.prototype, Reflux.ListenerMixin);
