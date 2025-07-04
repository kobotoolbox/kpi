from django.conf import settings


def build_url_type(viewname: str, **kwargs) -> dict:
    from rest_framework.reverse import reverse_lazy

    example_url = settings.KOBOFORM_URL + reverse_lazy(viewname=viewname, kwargs=kwargs)
    return {
        'type': 'string',
        'format': 'uri',
        'example': example_url,
    }
