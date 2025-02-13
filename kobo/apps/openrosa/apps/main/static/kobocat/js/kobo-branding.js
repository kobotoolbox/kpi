$(document).ready(function() {
  $(document).on("click", ".header-bar__top-level-menu-button", function () {
    $('.top-level-menu').toggleClass('is-active');
  });

  $('table.published_forms__table').footable();

  if (inIframe()) {
  	$('body').addClass('in-iframe');
  } else {
  	$('body').addClass('not-in-iframe');
  }
}); 

function inIframe () {
    try {
        return window.self !== window.top;
    } catch (e) {
        return true;
    }
}