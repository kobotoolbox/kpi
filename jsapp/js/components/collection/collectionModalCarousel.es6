import React from 'react';
import Modal from 'react-modal';
import bem from '../../bem';
import ui from '../../ui';
import Slider from 'react-slick'

const CollectionsModalCarousel = React.createClass({
  getInitialState() {
    return {
      index: 0,
      direction: null
    };
  },
  renderItem: function(item, key){
    return <CarouselItem item={item} key={key} {...this.props} />;
  },
  render() {
    const settings = {
      dots: false,
      fade: true,
      infinite: false,
      speed: 500,
      slidesToShow: 1,
      slidesToScroll: 1,
      nextArrow: <RightNavButton/>,
      prevArrow: <LeftNavButton/>
    }
    return (
      <Slider {...settings}>
        <div>
          <img width={900} height={500} alt="900x500" src="https://react-bootstrap.github.io/assets/carousel.png"/>
        </div>
        <div>
          <img width={900} height={500} alt="900x500" src="https://react-bootstrap.github.io/assets/carousel.png"/>
        </div>
        <div>
          <img width={900} height={500} alt="900x500" src="https://react-bootstrap.github.io/assets/carousel.png"/>
        </div>
      </Slider>
    )
  }
});

let CarouselItem = React.createClass({
  render() {
    return (
      <div>
        <img width={900} height={500} alt="900x500" src="https://react-bootstrap.github.io/assets/carousel.png"/>
        <div>
          <h3>First slide label</h3>
          <p>Nulla vitae elit libero, a pharetra augue mollis interdum.</p>
        </div>
      </div>
    )
  }
});

let RightNavButton = React.createClass({
  render() {
    return (
      <button {...this.props}>
        <i className="material-icons">chevron_right</i>
      </button>
    )
  }
});
let LeftNavButton = React.createClass({
  render() {
    return (
      <button {...this.props}>
        <i className="material-icons">chevron_left</i>
      </button>
    )
  }
});


module.exports = CollectionsModalCarousel;
