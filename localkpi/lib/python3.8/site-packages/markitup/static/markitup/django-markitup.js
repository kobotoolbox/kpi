'use strict';
(function($) {
  // Configure a MarkItUp editor on element
  // Config comes from data attributes on config
  function configure_markitup_editor(element, config) {
    var preview_url = config.attr('data-preview-url');
    var auto_preview = config.attr('data-auto-preview') == '1';
    if (!element.hasClass("markItUpEditor")) {
      if (preview_url) {
        mySettings["previewParserPath"] = preview_url;
      }
      element.markItUp(mySettings);
    }
    if (auto_preview) {
      $('a[title="Preview"]').trigger('mouseup');
    }
  };

  $(function() {
    $('.django-markitup-widget').each(function(index) {
      var element = $(this);
      configure_markitup_editor(element, element);
    });

    $('.django-markitup-editor-config').each(function(index) {
      var config = $(this);
      var element = $(config.attr('data-element'));
      configure_markitup_editor(element, config);
    });
  });
})(jQuery || django.jQuery);
