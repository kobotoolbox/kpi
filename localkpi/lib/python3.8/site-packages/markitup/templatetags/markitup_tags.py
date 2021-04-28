from __future__ import unicode_literals

from django import template
try:
    from django.urls import NoReverseMatch, reverse
except ImportError:
    from django.core.urlresolvers import reverse, NoReverseMatch
from markitup import settings
from markitup.util import absolute_url
from markitup.fields import render_func


register = template.Library()


@register.filter
def render_markup(content):
    return render_func(content)



# we do some funny stuff here for testability (the tests need to be
# able to force a recalculation of this context)
def _get_markitup_context():
    context = {
        'MARKITUP_SET': absolute_url(settings.MARKITUP_SET).rstrip('/'),
        'MARKITUP_SKIN': absolute_url(settings.MARKITUP_SKIN).rstrip('/'),
        'MARKITUP_JS': absolute_url('markitup/jquery.markitup.js'),
        'AJAXCSRF_JS': absolute_url('markitup/ajax_csrf.js'),
        'DJANGO_MARKITUP_JS': absolute_url('markitup/django-markitup.js'),
        }
    if settings.JQUERY_URL is not None:
        context['JQUERY_URL'] = absolute_url(settings.JQUERY_URL)
    return context
register._markitup_context = _get_markitup_context()



@register.inclusion_tag('markitup/include_all.html')
def markitup_media(no_jquery=False):
    include_jquery = not bool(no_jquery) and settings.JQUERY_URL is not None
    return dict(register._markitup_context, include_jquery=include_jquery)



@register.inclusion_tag('markitup/include_js.html')
def markitup_js(no_jquery=False):
    include_jquery = not bool(no_jquery) and settings.JQUERY_URL is not None
    return dict(register._markitup_context, include_jquery=include_jquery)



@register.inclusion_tag('markitup/include_css.html')
def markitup_css():
    return register._markitup_context



@register.inclusion_tag('markitup/editor.html')
def markitup_editor(textarea_id, auto_preview=None):
    if auto_preview is not None:
        auto_preview = (auto_preview == 'auto_preview')
    else:
        auto_preview = settings.MARKITUP_AUTO_PREVIEW

    try:
       preview_url = reverse('markitup_preview')
    except NoReverseMatch:
       preview_url = None;

    return {'textarea_id': textarea_id,
            'AUTO_PREVIEW': auto_preview,
            'preview_url': preview_url}
