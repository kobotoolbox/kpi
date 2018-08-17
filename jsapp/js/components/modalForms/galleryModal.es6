import React from 'react';
import Reflux from 'reflux';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import bem from '../../bem';
import stores from '../../stores';
import mixins from '../../mixins';
import {
  t,
  formatTime
} from '../../utils';

class GalleryModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
    autoBind(this);
  }

  render() {
    return (
      <div>gallery</div>
    );
  }
}

reactMixin(GalleryModal.prototype, Reflux.ListenerMixin);

export default GalleryModal;
