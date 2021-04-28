from __future__ import unicode_literals

from django.conf import settings

MARKITUP_PREVIEW_FILTER = getattr(settings, 'MARKITUP_PREVIEW_FILTER',
                                  getattr(settings, 'MARKITUP_FILTER', None))
MARKITUP_AUTO_PREVIEW = getattr(settings, 'MARKITUP_AUTO_PREVIEW', False)
# Defaults include trailing slash so that others know path is a directory
MARKITUP_SET = getattr(settings, 'MARKITUP_SET', 'markitup/sets/default/')
MARKITUP_SKIN = getattr(settings, 'MARKITUP_SKIN', 'markitup/skins/simple/')
JQUERY_URL = getattr(
    settings, 'JQUERY_URL',
    '//ajax.googleapis.com/ajax/libs/jquery/2.0.3/jquery.min.js')
