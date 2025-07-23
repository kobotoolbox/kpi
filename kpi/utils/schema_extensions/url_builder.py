from django.conf import settings


def build_url_type(viewname: str, **kwargs) -> dict:

    """
    Due to the life cycle of DRF, we have no choice but to build the examples as
    belong instead of using a reverse_lazy like we did before. This util is loaded
    before the urls and models which mean the cycle will enter an infinite loop where
    it tries to get the url, then the model and so on.
    """
    example_url = settings.KOBOFORM_URL + '/api/v2/' + viewname
    if ':' in viewname:
        _, viewname = viewname.split(':')

    urls_pattern_mapping = {
        'asset-detail': '/api/v2/assets/{uid}/',
        'asset-permission-assignment-detail':
            '/api/v2/assets/{parent_lookup_asset}/permission-assignments/{uid}/',
        'permission-detail': '/api/v2/permissions/{codename}/',
        'user-kpi-detail': '/api/v2/users/{username}/',
        'assetsnapshot-detail': '/api/v2/asset_snapshots/{uid}/',
        'assetsnapshot-preview': '/api/v2/asset_snapshots/{uid}/preview/',
        'assetsnapshot-xml-with-disclaimer':
            '/api/v2/asset_snapshots/{uid}/xml_with_disclaimer/',
        'assetsnapshot-manifest-alias': '/api/v2/asset_snapshots/{uid}/manifest/',
        'userassetsubscription-detail': '/api/v2/asset_subscription/{uid}/',
        'asset-version-detail': '/api/v2/assets/{parent_lookup_asset}/versions/{uid}/',
        'asset-xform': '/api/v2/assets/{uid}/xform/',
        'hook-list': '/api/v2/assets/{parent_lookup_asset}/hooks/',
        'asset-xls': '/api/v2/assets/{uid}/',
        'asset-export-list': '/api/v2/assets/{parent_lookup_asset}/exports/',
        'submission-list': '/api/v2/assets/{parent_lookup_asset}/submissions/',
        'paired-data-list': '/api/v2/assets/{parent_lookup_asset}/paired-data/',
        'attachment-detail':
            '/api/v2/assets/{parent_lookup_asset}/data/{parent_lookup_data}/attachments/{pk}',  # noqa
        'attachment-thumb':
            '/api/v2/assets/{parent_lookup_asset}/data/{parent_lookup_data}/attachments/{pk}/{suffix}/',  # noqa
        'paired-data-detail':
            '/api/v2/assets/{parent_lookup_asset}/paired-data/{paired_data_uid}',
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
