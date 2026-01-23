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
    DEV_DOMAIN_NAMES = [
        'http://kpi',
        'http://kf.kobo.local:8080',
        'http://kf.kobo.localhost',
    ]

    example_url = settings.KOBOFORM_URL + '/api/v2/' + viewname
    if ':' in viewname:
        _, viewname = viewname.split(':')

    urls_pattern_mapping = {
        'asset-detail': '/api/v2/assets/{uid_asset}/',
        'asset-permission-assignment-detail': '/api/v2/assets/{uid_asset}/permission-assignments/{uid_permission_assignment}/',  # noqa
        'permission-detail': '/api/v2/permissions/{codename}/',
        'user-kpi-detail': '/api/v2/users/{username}/',
        'assetsnapshot-detail': '/api/v2/asset_snapshots/{uid_asset_snapshot}/',
        'assetsnapshot-preview': '/api/v2/asset_snapshots/{uid_asset_snapshot}/preview/',
        'assetsnapshot-xml-with-disclaimer': '/api/v2/asset_snapshots/{uid_asset_snapshot}/xml_with_disclaimer/',  # noqa
        'assetsnapshot-manifest-openrosa': '/api/v2/asset_snapshots/{uid_asset_snapshot}/manifest',
        'userassetsubscription-detail': '/api/v2/asset_subscription/{uid_asset_subscription}/',
        'asset-version-detail': '/api/v2/assets/{uid_asset}/versions/{uid_version}/',
        'asset-xform': '/api/v2/assets/{uid_asset}/xform/',
        'hook-list': '/api/v2/assets/{uid_asset}/hooks/',
        'asset-xls': '/api/v2/assets/{uid_asset}.xls',
        'asset-export-list': '/api/v2/assets/{uid_asset}/exports/',
        'submission-list': '/api/v2/assets/{uid_asset}/submissions/',
        'paired-data-list': '/api/v2/assets/{uid_asset}/paired-data/',
        'attachment-detail': '/api/v2/assets/{uid_asset}/data/{uid_data}/attachments/{pk}',  # noqa
        'attachment-thumb': '/api/v2/assets/{uid_asset}/data/{uid_data}/attachments/{pk}/{suffix}/',  # noqa
        'paired-data-detail': '/api/v2/assets/{uid_asset}/paired-data/{uid_paired_data}/',  # noqa
        'project-ownership-transfer-detail': '/api/v2/project-ownership/invites/{uid_invite}/transfers/{uid_transfer}/',  # noqa
        'asset-reports': '/api/v2/assets/{uid_asset}/reports/',
        'asset-export-settings-detail': '/api/v2/assets/{uid_asset}/export-settings/{uid_export_setting}/',  # noqa
        'asset-export-settings-detail-format': '/api/v2/assets/{uid_asset}/export-settings/{uid_export_setting}/data.{format}',  # noqa
        'asset-export-detail': '/api/v2/assets/{uid_asset}/exports/{uid_export}/',
        'serve_private_file': '/private-media/{username}/exports/assets-{username}-view_pvNNUan8EBhzfkrv6sCNuzR-2025-08-11T143443Z.csv',  # noqa
        'serve_asset_private_file': '{path}',
        'asset-file-detail': '/api/v2/assets/{uid_asset}/files/{uid_file}/',
        'asset-file-content': '/api/v2/assets/{uid_asset}/files/{uid_file}/content/',  # noqa
        'hook-log-list': '/api/v2/assets/{uid_asset}/hooks/{uid_hook}/logs/',  # noqa
        'hook-log-detail': '/api/v2/assets/{uid_asset}/hooks/{uid_hook}/logs/{uid_log}/',  # noqa
        'organization-members-list': '/api/v2/organizations/{uid_organization}/members/',
        'organizations-assets': '/api/v2/organizations/{uid_organization}/assets/',
        'organizations-service-usage': '/api/v2/organizations/{uid_organization}/service_usage/',
        'organizations-asset-usage': '/api/v2/organizations/{uid_organization}/assets_usage/',
        'organizations-detail': '/api/v2/organizations/{uid_organization}/',
        'language-detail': '/api/v2/language/{code}/',
        'user_profile': '/{username}',
        'organization-invites-detail': '/api/v2/organizations/{uid_organization}/invites/{guid}/',  # noqa
        'tags-detail': '/api/v2/tags/{taguid__uid}/',
        'tags-list': '/api/v2/tags/',
        'terms-of-service-detail': '/api/v2/terms-of-service/{slug}/',
        'enketo_edit_link': '{path}',
        'enketo_view_link': '{path}',
        'importtask-detail': '/api/v2/imports/{uid_import}/',
        'organization-members-detail': '/api/v2/organizations/{uid_organization}/members/{username}/',  # noqa
        'project-ownership-invite-detail': '/api/v2/project-ownership/invites/{uid_invite}/',
        'projectview-detail': '/api/v2/project-views/{uid_project_view}/',
        'projectview-assets': '/api/v2/project-views/{uid_project_view}/assets/',
        'projectview-export': '/api/v2/project-views/{uid_project_view}/{obj_type}/export/',
        'projectview-users': '/api/v2/project-views/{uid_project_view}/users/',
        'user-kpi-migrate': '/api/v2/users/{username}/migrate/{task_id}/',
        'download-url-openrosa': '/forms/{id}/form.xml',
        'manifest-openrosa': '/xformsManifest/{id}',
        'xform-download-openrosa': '/xformsMedia/{form_media_id}/{media_id}.jpg',
    }

    try:
        example_url = urls_pattern_mapping[viewname]
    except KeyError:
        example_url = f'/{viewname}/{str(kwargs)}'
    else:
        for key, value in kwargs.items():
            example_url = example_url.replace(f'{{{key}}}', value)

    koboform_url = settings.KOBOFORM_URL

    if koboform_url in DEV_DOMAIN_NAMES:
        koboform_url = 'https://kf.kobotoolbox.org'

    return {
        'type': 'string',
        'format': 'uri',
        'example': koboform_url + example_url,
    }
