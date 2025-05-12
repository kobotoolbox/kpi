from django.conf import settings
from rest_framework.reverse import reverse


def build_url_type(viewname: str, **kwargs) -> dict:
    example_url = settings.KOBOFORM_URL + reverse(viewname=viewname, kwargs=kwargs)

    return {
        'type': 'string',
        'format': 'uri',
        'example': example_url,
    }
