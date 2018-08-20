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
      <bem.AssetGallery__gridItem
        className='one-one'
        style={itemStyle}
        onClick={() =>
          this.props.openModal(
            this.props.gallery,
            this.props.galleryItemIndex
          )}
      >
        <bem.AssetGallery__gridItemOverlay>
          <bem.AssetGallery__gridItemOverlayText>
            <h5>{this.props.itemTitle}</h5>
            <p>{this.props.date}</p>
          </bem.AssetGallery__gridItemOverlayText>
        </bem.AssetGallery__gridItemOverlay>
      </bem.AssetGallery__gridItem>
    );
  }
};
