import React from 'react';
import Modal from 'react-modal';
import bem from '../../bem';
import ui from '../../ui';

const CollectionsModalSidebar = React.createClass({
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
  render() {
    const settings = {
      dots: true,
      infinite: true,
      speed: 500,
      slidesToShow: 1,
      slidesToScroll: 1
    }
    return (
      <div>
        <div className="light-grey-bg">
          <h2>Information</h2>
        </div>
      </div>
    )
  }
});

module.exports = CollectionsModalSidebar;
