import React from 'react';
import Modal from 'react-modal';
import bem from '../../bem';
import ui from '../../ui';
import Carousel from 'react-bootstrap/lib/Carousel';
import 'bootstrap/dist/css/bootstrap.css'

const CollectionsModalCarousel = React.createClass({
  getInitialState() {
    return {
      index: 0,
      direction: null,
      items: [
        {
          "download_url": "http://172.17.0.1:8001/media/wolejkoa/attachments/2d2ebe6357924842ad2f21ac3da38338/682e5deb-c4c2-4f13-842f-19589f5df6bc/test-9_3_0-large.jpeg",
          "small_download_url": "http://example.com/api/v1/media/1-small.jpg",
          "medium_download_url": "http://example.com/api/v1/media/1-medium.jpg",
          "filename": "test-9_3_0-large.jpeg",
          "id": 1,
          "instance": 1,
          "mimetype": "image/jpeg",
          "url": "http://example.com/api/v1/media/1",
          "xform": 1
        },
        {
          "download_url": "http://172.17.0.1:8001/media/wolejkoa/attachments/2d2ebe6357924842ad2f21ac3da38338/682e5deb-c4c2-4f13-842f-19589f5df6bc/test-9_3_0-large.jpeg",
          "small_download_url": "http://example.com/api/v1/media/1-small.jpg",
          "medium_download_url": "http://example.com/api/v1/media/1-medium.jpg",
          "filename": "test-9_3_0-large.jpeg",
          "id": 1,
          "instance": 1,
          "mimetype": "image/jpeg",
          "url": "http://example.com/api/v1/media/1",
          "xform": 1
        },
        {
          "download_url": "http://172.17.0.1:8001/media/wolejkoa/attachments/2d2ebe6357924842ad2f21ac3da38338/682e5deb-c4c2-4f13-842f-19589f5df6bc/test-9_3_0-large.jpeg",
          "small_download_url": "http://example.com/api/v1/media/1-small.jpg",
          "medium_download_url": "http://example.com/api/v1/media/1-medium.jpg",
          "filename": "test-9_3_0-large.jpeg",
          "id": 1,
          "instance": 1,
          "mimetype": "image/jpeg",
          "url": "http://example.com/api/v1/media/1",
          "xform": 1
        },
        {
          "download_url": "http://172.17.0.1:8001/media/wolejkoa/attachments/2d2ebe6357924842ad2f21ac3da38338/682e5deb-c4c2-4f13-842f-19589f5df6bc/test-9_3_0-large.jpeg",
          "small_download_url": "http://example.com/api/v1/media/1-small.jpg",
          "medium_download_url": "http://example.com/api/v1/media/1-medium.jpg",
          "filename": "test-9_3_0-large.jpeg",
          "id": 1,
          "instance": 1,
          "mimetype": "image/jpeg",
          "url": "http://example.com/api/v1/media/1",
          "xform": 1
        },
        {
          "download_url": "http://172.17.0.1:8001/media/wolejkoa/attachments/2d2ebe6357924842ad2f21ac3da38338/682e5deb-c4c2-4f13-842f-19589f5df6bc/test-9_3_0-large.jpeg",
          "small_download_url": "http://example.com/api/v1/media/1-small.jpg",
          "medium_download_url": "http://example.com/api/v1/media/1-medium.jpg",
          "filename": "test-9_3_0-large.jpeg",
          "id": 1,
          "instance": 1,
          "mimetype": "image/jpeg",
          "url": "http://example.com/api/v1/media/1",
          "xform": 1
        }
      ]
    };
  },

  handleSelect(selectedIndex, e) {
    console.log('selected=' + selectedIndex + ', direction=' + e.direction);
    this.setState({
      index: selectedIndex,
      direction: e.direction
    });
  },
  renderItem: function(item, key){
    return <CarouselItem item={item} key={key} {...this.props} />;
  },
  render() {
    return (
      <Carousel activeIndex={this.state.index} direction={this.state.direction} onSelect={this.handleSelect}>
         {this.state.items.map(this.renderItem)}
      </Carousel>

    )
  }
});

let CarouselItem = React.createClass({
  render() {
    return (
      <Carousel.Item>
        <img width={900} height={500} alt="900x500" src="https://react-bootstrap.github.io/assets/carousel.png"/>
        <Carousel.Caption>
          <h3>First slide label</h3>
          <p>Nulla vitae elit libero, a pharetra augue mollis interdum.</p>
        </Carousel.Caption>
      </Carousel.Item>
    )
  }
});

module.exports = CollectionsModalCarousel;
