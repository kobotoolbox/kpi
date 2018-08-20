import React from 'react';
import bem from '../../bem';

export default class FormGalleryGridItem extends React.Component {
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
        onClick={() =>
          this.props.openModal(
            this.props.gallery,
            this.props.galleryItemIndex
          )}
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
