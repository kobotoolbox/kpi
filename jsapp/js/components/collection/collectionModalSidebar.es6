import React from 'react';
import Modal from 'react-modal';
import bem from '../../bem';
import ui from '../../ui';

const CollectionsModalSidebar = React.createClass({
  getInitialState() {
    return {
      index: 0,
    }
  },
  toggleInfo(){
    this.setState(prevState => ({
      isOpen: !prevState.isOpen
    }));
  },
  render() {
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
