from django.conf import settings


def build_url_type(viewname: str, **kwargs) -> dict:

    # example_url = settings.KOBOFORM_URL + reverse_lazy(viewname=viewname, kwargs=kwargs)
    example_url = settings.KOBOFORM_URL + '/api/v2/' + viewname
    if ':' in viewname:
        _, viewname = viewname.split(':')

    urls_pattern_mapping = {
        'asset-detail': '/api/v2/assets/{uid}/',
        'asset-permission-assignment-detail': '/api/v2/assets/{parent_lookup_asset}/permission-assignments/{uid}/',
        'permission-detail': '/api/v2/users/{codename}/',
        'user-kpi-detail': '/api/v2/users/{username}/',

    }

    try:
        example_url = urls_pattern_mapping[viewname]
    except KeyError:
        example_url = f'/{viewname}/{str(kwargs)}'
    else:
        for key, value in kwargs.items():
            example_url = example_url.replace(f'{{{key}}}', value)

    return {
        'type': 'string',
        'format': 'uri',
        'example': settings.KOBOFORM_URL + example_url,
    }
