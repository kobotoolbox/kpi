import json

from constance import config
from django import template
from django.utils.translation import get_language

register = template.Library()


@register.simple_tag
def get_custom_guidance_text():
    """
    Get the custom guidance text for passwords set in constance config
    """

    # Get language code
    language = get_language()

    # Don't return anything if the custom guidance text is disabled
    if config.ENABLE_CUSTOM_PASSWORD_GUIDANCE_TEXT:
        messages_dict = json.loads(config.CUSTOM_PASSWORD_GUIDANCE_TEXT)
        # If the language is not found, return the default text
        try:
            text = messages_dict[language]
        except KeyError:
            text = messages_dict['default']
        return text
    # Return an empty string because 'None' or 'False' will display as text
    return ''
