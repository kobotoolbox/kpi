import React from 'react';
// var assign = require('react/lib/Object.assign');

var icons = {
  asset: ()=> <i className='fa fa-file-o' />,
  collection: ()=> <i className='fa fa-folder-o' />,
  large: {
    asset: ()=> <i className='fa fa-lg fa-file' />,
    collection: ()=> <i className='fa fa-lg fa-folder' />,
  }
};

module.exports = icons;
