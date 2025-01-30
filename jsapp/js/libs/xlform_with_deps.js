import $ from 'jquery';
import _ from 'underscore';
import Backbone from 'backbone';
import BackboneValidation from 'backbone-validation';

import xlform from './xlform';

window.jQuery = $;
window.$ = $;
window._ = _;
window.Backbone = Backbone;
window.Backbone.$ = $;
window.BackboneValidation = BackboneValidation;

export default xlform;
