import {runRoutes} from './app';
import $ from 'jquery';


var el = (function(){
  var $d = $('<div>', {'class': 'kpiapp'});
  $('body').prepend($d);
  return $d.get(0);
})();

window.csrftoken = $('input[name=csrfmiddlewaretoken]').eq(0).val() || $('meta[name=csrf-token]').attr('content');

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

