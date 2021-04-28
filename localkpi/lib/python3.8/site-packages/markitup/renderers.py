from __future__ import unicode_literals

try:
    from docutils.core import publish_parts

    def render_rest(markup, **docutils_settings):
        docutils_settings.update({
            'raw_enabled': False,
            'file_insertion_enabled': False,
        })

        parts = publish_parts(
            source=markup,
            writer_name="html4css1",
            settings_overrides=docutils_settings,
        )
        return parts["html_body"]
except ImportError:
    pass
