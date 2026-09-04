# flake8: noqa: E501
# API path prefixes that should be validated by the OpenAPI middleware
API_PATH_PREFIXES = (
    '/api/v2/',
    '/me/',
    '/environment/',
)

# Known, accepted mismatches between the API and the OpenAPI schema, as
# (error_code, django_route, method) tuples. Strict validation (tests) lets
# these through; anything else fails the test that triggers it.
#
# Each entry is a documented bug: either the schema lies about the endpoint or
# the endpoint does not honor the schema. Fix the schema and delete the entry.
# See README.md to regenerate this list after a large merge.
OPENAPI_KNOWN_MISMATCHES = frozenset(
    {
        # Both views read `request.query_params` but declare a
        # `serializer_class`, so drf-spectacular documents a required request
        # body that the endpoints never read
        ('missing-required-payload', 'api/v2/stripe/checkout-link', 'POST'),
        ('missing-required-payload', 'api/v2/stripe/customer-portal', 'POST'),
        ('request-payload-validation', 'api/v2/asset_snapshots/', 'POST'),
        ('request-payload-validation', 'api/v2/assets/', 'POST'),
        ('request-payload-validation', 'api/v2/assets/(?P<uid_asset>[^/.]+)/', 'PATCH'),
        (
            'request-payload-validation',
            'api/v2/assets/(?P<uid_asset>[^/.]+)/advanced-features/(?P<uid_advanced_feature>[^/.]+)/',
            'PATCH',
        ),
        (
            'request-payload-validation',
            'api/v2/assets/(?P<uid_asset>[^/.]+)/data/(?P<pk>[^/.]+)/duplicate/',
            'POST',
        ),
        (
            'request-payload-validation',
            'api/v2/assets/(?P<uid_asset>[^/.]+)/data/bulk/',
            'PATCH',
        ),
        (
            'request-payload-validation',
            'api/v2/assets/(?P<uid_asset>[^/.]+)/data/supplements/bulk/',
            'POST',
        ),
        (
            'request-payload-validation',
            'api/v2/assets/(?P<uid_asset>[^/.]+)/data/validation_statuses/',
            'PATCH',
        ),
        (
            'request-payload-validation',
            'api/v2/assets/(?P<uid_asset>[^/.]+)/exports/',
            'POST',
        ),
        (
            'request-payload-validation',
            'api/v2/assets/(?P<uid_asset>[^/.]+)/files/',
            'POST',
        ),
        (
            'request-payload-validation',
            'api/v2/assets/(?P<uid_asset>[^/.]+)/hooks/',
            'POST',
        ),
        (
            'request-payload-validation',
            'api/v2/assets/(?P<uid_asset>[^/.]+)/paired-data/',
            'POST',
        ),
        (
            'request-payload-validation',
            'api/v2/assets/(?P<uid_asset>[^/.]+)/permission-assignments/',
            'POST',
        ),
        (
            'request-payload-validation',
            'api/v2/assets/<uid_asset>/data/<root_uuid>/supplement/',
            'PATCH',
        ),
        ('request-payload-validation', 'api/v2/assets/bulk/', 'POST'),
        (
            'request-payload-validation',
            'api/v2/scim/v2/(?P<idp_slug>[^/.]+)/Groups',
            'POST',
        ),
        (
            'request-payload-validation',
            'api/v2/scim/v2/(?P<idp_slug>[^/.]+)/Groups/(?P<pk>[^/.]+)',
            'PUT',
        ),
        (
            'request-payload-validation',
            'api/v2/scim/v2/(?P<idp_slug>[^/.]+)/Users',
            'POST',
        ),
        (
            'request-payload-validation',
            'api/v2/scim/v2/(?P<idp_slug>[^/.]+)/Users/(?P<pk>[^/.]+)',
            'PUT',
        ),
        ('response-validation', 'api/v2/asset_snapshots/', 'POST'),
        (
            'response-validation',
            'api/v2/asset_snapshots/(?P<uid_asset_snapshot>[^/.]+)/',
            'GET',
        ),
        ('response-validation', 'api/v2/assets/', 'GET'),
        ('response-validation', 'api/v2/assets/', 'POST'),
        ('response-validation', 'api/v2/assets/(?P<uid_asset>[^/.]+)/', 'GET'),
        ('response-validation', 'api/v2/assets/(?P<uid_asset>[^/.]+)/', 'PATCH'),
        (
            'response-validation',
            'api/v2/assets/(?P<uid_asset>[^/.]+)/advanced-features/',
            'POST',
        ),
        (
            'response-validation',
            'api/v2/assets/(?P<uid_asset>[^/.]+)/advanced-features/bulk-actions/',
            'GET',
        ),
        (
            'response-validation',
            'api/v2/assets/(?P<uid_asset>[^/.]+)/advanced-features/bulk-actions/',
            'POST',
        ),
        (
            'response-validation',
            'api/v2/assets/(?P<uid_asset>[^/.]+)/advanced-features/bulk-actions/(?P<action_uid>[^/.]+)/',
            'GET',
        ),
        (
            'response-validation',
            'api/v2/assets/(?P<uid_asset>[^/.]+)/advanced-features/bulk-actions/(?P<action_uid>[^/.]+)/',
            'PATCH',
        ),
        (
            'response-validation',
            'api/v2/assets/(?P<uid_asset>[^/.]+)/attachments/audio-duration/',
            'POST',
        ),
        (
            'response-validation',
            'api/v2/assets/(?P<uid_asset>[^/.]+)/attachments/bulk/',
            'DELETE',
        ),
        ('response-validation', 'api/v2/assets/(?P<uid_asset>[^/.]+)/counts/', 'GET'),
        ('response-validation', 'api/v2/assets/(?P<uid_asset>[^/.]+)/data/', 'GET'),
        (
            'response-validation',
            'api/v2/assets/(?P<uid_asset>[^/.]+)/data/(?P<pk>[^/.]+)/',
            'GET',
        ),
        (
            'response-validation',
            'api/v2/assets/(?P<uid_asset>[^/.]+)/data/(?P<pk>[^/.]+)/enketo/edit/',
            'GET',
        ),
        (
            'response-validation',
            'api/v2/assets/(?P<uid_asset>[^/.]+)/data/(?P<pk>[^/.]+)/enketo/view/',
            'GET',
        ),
        (
            'response-validation',
            'api/v2/assets/(?P<uid_asset>[^/.]+)/data/(?P<pk>[^/.]+)/validation_status/',
            'GET',
        ),
        (
            'response-validation',
            'api/v2/assets/(?P<uid_asset>[^/.]+)/data/(?P<pk>[^/.]+)/validation_status/',
            'PATCH',
        ),
        (
            'response-validation',
            'api/v2/assets/(?P<uid_asset>[^/.]+)/data/(?P<uid_data>[^/.]+)/attachments/',
            'GET',
        ),
        (
            'response-validation',
            'api/v2/assets/(?P<uid_asset>[^/.]+)/deployment/',
            'PATCH',
        ),
        (
            'response-validation',
            'api/v2/assets/(?P<uid_asset>[^/.]+)/deployment/',
            'POST',
        ),
        ('response-validation', 'api/v2/assets/(?P<uid_asset>[^/.]+)/exports/', 'POST'),
        (
            'response-validation',
            'api/v2/assets/(?P<uid_asset>[^/.]+)/exports/(?P<uid_export>[^/.]+)/',
            'GET',
        ),
        ('response-validation', 'api/v2/assets/(?P<uid_asset>[^/.]+)/hooks/', 'GET'),
        ('response-validation', 'api/v2/assets/(?P<uid_asset>[^/.]+)/hooks/', 'POST'),
        (
            'response-validation',
            'api/v2/assets/(?P<uid_asset>[^/.]+)/hooks/(?P<uid_hook>[^/.]+)/',
            'GET',
        ),
        (
            'response-validation',
            'api/v2/assets/(?P<uid_asset>[^/.]+)/hooks/(?P<uid_hook>[^/.]+)/',
            'PATCH',
        ),
        (
            'response-validation',
            'api/v2/assets/(?P<uid_asset>[^/.]+)/hooks/(?P<uid_hook>[^/.]+)/logs/(?P<uid_log>[^/.]+)/retry/',
            'PATCH',
        ),
        (
            'response-validation',
            'api/v2/assets/(?P<uid_asset>[^/.]+)/paired-data/',
            'GET',
        ),
        (
            'response-validation',
            'api/v2/assets/(?P<uid_asset>[^/.]+)/paired-data/',
            'POST',
        ),
        (
            'response-validation',
            'api/v2/assets/(?P<uid_asset>[^/.]+)/permission-assignments/bulk/',
            'POST',
        ),
        ('response-validation', 'api/v2/assets/(?P<uid_asset>[^/.]+)/reports/', 'GET'),
        ('response-validation', 'api/v2/assets/<uid_asset>/data/<pk>/edit/', 'GET'),
        (
            'response-validation',
            'api/v2/assets/<uid_asset>/data/<root_uuid>/supplement/',
            'GET',
        ),
        (
            'response-validation',
            'api/v2/assets/<uid_asset>/data/<root_uuid>/supplement/',
            'PATCH',
        ),
        ('response-validation', 'api/v2/audit-logs/', 'GET'),
        ('response-validation', 'api/v2/environment/', 'GET'),
        ('response-validation', 'api/v2/imports/(?P<uid_import>[^/.]+)/', 'GET'),
        (
            'response-validation',
            'api/v2/organizations/(?P<uid_organization>[^/.]+)/asset_usage/',
            'GET',
        ),
        (
            'response-validation',
            'api/v2/organizations/(?P<uid_organization>[^/.]+)/assets/',
            'GET',
        ),
        # Invite errors are returned as a flat `detail` string (DEV-1218) instead
        # of DRF's default field-keyed arrays, so they don't honor the schema.
        (
            'response-validation',
            'api/v2/organizations/(?P<uid_organization>[^/.]+)/invites/(?P<guid>[^/.]+)/',
            'PATCH',
        ),
        (
            'response-validation',
            'api/v2/organizations/(?P<uid_organization>[^/.]+)/members/',
            'GET',
        ),
        (
            'response-validation',
            'api/v2/organizations/(?P<uid_organization>[^/.]+)/members/(?P<username>[^/.]+)/',
            'GET',
        ),
        (
            'response-validation',
            'api/v2/organizations/(?P<uid_organization>[^/.]+)/members/(?P<username>[^/.]+)/',
            'PATCH',
        ),
        ('response-validation', 'api/v2/project-ownership/invites/', 'POST'),
        (
            'response-validation',
            'api/v2/project-ownership/invites/(?P<uid_invite>[^/.]+)/',
            'GET',
        ),
        (
            'response-validation',
            'api/v2/project-ownership/invites/(?P<uid_invite>[^/.]+)/',
            'PATCH',
        ),
        (
            'response-validation',
            'api/v2/project-views/(?P<uid_project_view>[^/.]+)/assets/',
            'GET',
        ),
        ('response-validation', 'api/v2/service_usage/', 'GET'),
        ('response-validation', 'api/v2/stripe/change-plan', 'GET'),
        ('response-validation', 'api/v2/stripe/checkout-link', 'POST'),
        ('response-validation', 'api/v2/stripe/customer-portal', 'POST'),
        ('response-validation', 'api/v2/stripe/products/', 'GET'),
        ('response-validation', 'api/v2/stripe/subscriptions/', 'GET'),
        ('response-validation', 'api/v2/stripe/subscriptions/(?P<id>[^/.]+)/', 'GET'),
        ('response-validation', 'api/v2/translation-services/', 'GET'),
        ('response-validation', 'api/v2/user-reports/', 'GET'),
        ('response-validation', 'me/', 'DELETE'),
        ('response-validation', 'me/', 'GET'),
        ('response-validation', 'me/', 'PATCH'),
        ('response-validation', 'me/social-accounts/', 'GET'),
    }
)
