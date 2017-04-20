import {runRoutes} from './app';
import $ from 'jquery';
import cookie from 'react-cookie';

require('../scss/main.scss');

var el = (function(){
  var $d = $('<div>', {'class': 'kpiapp'});
  $('body').prepend($d);
  return $d.get(0);
})();

window.csrftoken = cookie.load('csrftoken');

function csrfSafeMethod(method) {
    // these HTTP methods do not require CSRF protection
    return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
}
$.ajaxSetup({
    beforeSend: function(xhr, settings) {
        if (!csrfSafeMethod(settings.type) && !this.crossDomain) {
            xhr.setRequestHeader('X-CSRFToken', csrftoken);
        }
    }
});

if (document.head.querySelector('meta[name=kpi-root-url]')) {
  runRoutes(el);
} else {
  console.error('no kpi-root-url meta tag set. skipping react-router init');
}
