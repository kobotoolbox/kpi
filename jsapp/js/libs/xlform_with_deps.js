
// TODO: why require instead of import?
/* eslint-disable no-undef */
var $ = require('jquery');
window.jQuery = $;
window.$ = $;
window._ = require('underscore');
window.Backbone = require('backbone');
window.Backbone.$ = $;
window.BackboneValidation = require('backbone-validation');

module.exports = require('./xlform');
