import {runRoutes} from './components/app';
import $ from 'jquery';

var el = (function(){
  var $d = $('<div>', {'class': 'kpiapp'})
  $('body').prepend($d);
  return $d.get(0);
})();

if (window.location.pathname == "/") {
  $('.wrapper').hide();
  runRoutes(el);
}

