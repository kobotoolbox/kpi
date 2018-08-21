import React from 'react';
import bem from '../../bem';
import {galleryActions} from './galleryInterface';

export default class FormGalleryGridItem extends React.Component {
  onClick() {
    galleryActions.openSingleModal({
      gallery: this.props.gallery,
      galleryIndex: this.props.galleryItemIndex
    })
  }

  render() {
    let itemStyle = {
      backgroundImage: 'url(' + this.props.url + ')',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center center',
      backgroundSize: 'cover'
    };
    return (
      <bem.AssetGalleryGrid__item
        className='one-one'
        style={itemStyle}
        onClick={this.onClick.bind(this)}
      >
        <bem.AssetGalleryGrid__itemOverlay>
          <bem.AssetGalleryGrid__itemOverlayText>
            <h5>{this.props.itemTitle}</h5>
            <p>{this.props.date}</p>
          </bem.AssetGalleryGrid__itemOverlayText>
        </bem.AssetGalleryGrid__itemOverlay>
      </bem.AssetGalleryGrid__item>
    );
  }
};
