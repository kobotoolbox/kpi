from django.conf import settings


def build_url_type(viewname: str, **kwargs) -> dict:
    """
    Utility used to build API schema examples for drf-spectacular.

    In practice, we initially tried using `reverse_lazy` to generate realistic URLs,
    but since drf-spectacular parses all code at schema generation time — before Django
    has fully loaded all apps and URL patterns — this caused import issues and circular
    references.

    To avoid that, we hardcode the URL patterns via a `urls_pattern_mapping` to simulate
    the behavior of `reverse_lazy`, while ensuring the examples still match the actual
    API routes.

    This utility helps produce meaningful URLs in Swagger UI, instead of dummy or
    unrelated placeholders.
    """
    example_url = settings.KOBOFORM_URL + '/api/v2/' + viewname
    if ':' in viewname:
        _, viewname = viewname.split(':')

    urls_pattern_mapping = {
        'asset-detail': '/api/v2/assets/{uid}/',
        'asset-permission-assignment-detail': '/api/v2/assets/{parent_lookup_asset}/permission-assignments/{uid}/',  # noqa
        'permission-detail': '/api/v2/permissions/{codename}/',
        'user-kpi-detail': '/api/v2/users/{username}/',
        'assetsnapshot-detail': '/api/v2/asset_snapshots/{uid}/',
        'assetsnapshot-preview': '/api/v2/asset_snapshots/{uid}/preview/',
        'assetsnapshot-xml-with-disclaimer': '/api/v2/asset_snapshots/{uid}/xml_with_disclaimer/',  # noqa
        'assetsnapshot-manifest-openrosa': '/api/v2/asset_snapshots/{uid}/manifest/',
        'userassetsubscription-detail': '/api/v2/asset_subscription/{uid}/',
        'asset-version-detail': '/api/v2/assets/{parent_lookup_asset}/versions/{uid}/',
        'asset-xform': '/api/v2/assets/{uid}/xform/',
        'hook-list': '/api/v2/assets/{parent_lookup_asset}/hooks/',
        'asset-xls': '/api/v2/assets/{uid}/',
        'asset-export-list': '/api/v2/assets/{parent_lookup_asset}/exports/',
        'submission-list': '/api/v2/assets/{parent_lookup_asset}/submissions/',
        'paired-data-list': '/api/v2/assets/{parent_lookup_asset}/paired-data/',
        'attachment-detail': '/api/v2/assets/{parent_lookup_asset}/data/{parent_lookup_data}/attachments/{pk}',  # noqa
        'attachment-thumb': '/api/v2/assets/{parent_lookup_asset}/data/{parent_lookup_data}/attachments/{pk}/{suffix}/',  # noqa
        'paired-data-detail': '/api/v2/assets/{parent_lookup_asset}/paired-data/{paired_data_uid}',  # noqa
        'project-ownership-transfer-detail': '/api/v2/project-ownership/invites/{parent_lookup_invite_uid}/transfers/{uid}/',  # noqa
        'asset-reports': '/api/v2/assets/{uid}/reports/',
        'asset-export-settings-detail': '/api/v2/assets/{parent_lookup_asset}/export-settings/{uid}/',  # noqa
        'asset-export-settings-detail-format': '/api/v2/assets/{parent_lookup_asset}/export-settings/{uid}/data.{format}',  # noqa
        'asset-export-detail': '/api/v2/assets/{parent_lookup_asset}/exports/{uid}/',
        'serve_private_file': '/private-media/{username}/exports/assets-{username}-view_pvNNUan8EBhzfkrv6sCNuzR-2025-08-11T143443Z.csv',  # noqa
        'asset-file-detail': '/api/v2/assets/{parent_lookup_asset}/files/{uid}/',
        'asset-file-content': '/api/v2/assets/{parent_lookup_asset}/files/{uid}/content/',  # noqa
        'hook-log-list': '/api/v2/assets/{parent_lookup_asset}/hooks/{parent_lookup_hook}/logs/',  # noqa
        'hook-log-detail': '/api/v2/assets/{parent_lookup_asset}/hooks/{parent_lookup_hook}/logs/{uid}/',  # noqa
        'organization-members-list': '/api/v2/organizations/{id}/members/',
        'organizations-assets': '/api/v2/organizations/{id}/assets/',
        'organizations-service-usage': '/api/v2/organizations/{id}/service_usage/',
        'organizations-asset-usage': '/api/v2/organizations/{id}/assets_usage/',
        'organizations-detail': '/api/v2/organizations/{id}/',
        'language-detail': '/api/v2/language/{code}/',
        'user_profile': '/{username}',
        'organization-invites-detail': '/api/v2/organizations/{organization_id}/invites/{guid}/',  # noqa
        'tags-detail': '/api/v2/tags/{taguid__uid}/',
        'tags-list': '/api/v2/tags/',
        'terms-of-service-detail': '/api/v2/terms-of-service/{slug}/',
        'enketo_edit_link': '{path}',
        'enketo_view_link': '{path}',
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
