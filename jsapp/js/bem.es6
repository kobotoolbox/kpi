import React from 'react/addons';
React.createBemElement = require('./libs/react-create-bem-element');
// import Router from 'react-router';
// let Link = Router.Link;

var bem = {};

bem.AssetRow = React.createBemElement('asset-row', '<li>');
bem.AssetRow__cell        = bem.AssetRow.__('cell');
bem.AssetRow__actionIcon  = bem.AssetRow.__('action-icon');
// bem.AssetRow__actionLink  = bem.AssetRow.__('action-icon', Link);

export default bem;