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
OPENAPI_KNOWN_MISMATCHES = frozenset({
    ('request-payload-validation', 'api/v2/asset_snapshots/', 'POST'),
    ('request-payload-validation', 'api/v2/assets/', 'POST'),
    ('request-payload-validation', 'api/v2/assets/(?P<uid_asset>[^/.]+)/', 'PATCH'),
    (
        'request-payload-validation',
        'api/v2/assets/(?P<uid_asset>[^/.]+)/advanced-features/(?P<uid_advanced_feature>[^/.]+)/',  # noqa: E501
        'PATCH',
    ),
    (
        'request-payload-validation',
        'api/v2/assets/(?P<uid_asset>[^/.]+)/data/(?P<pk>[^/.]+)/duplicate/',  # noqa: E501
        'POST',
    ),
    (
        'request-payload-validation',
        'api/v2/assets/(?P<uid_asset>[^/.]+)/data/bulk/',  # noqa: E501
        'PATCH',
    ),
    (
        'request-payload-validation',
        'api/v2/assets/(?P<uid_asset>[^/.]+)/data/supplements/bulk/',  # noqa: E501
        'POST',
    ),
    (
        'request-payload-validation',
        'api/v2/assets/(?P<uid_asset>[^/.]+)/data/validation_statuses/',  # noqa: E501
        'PATCH',
    ),
    (
        'request-payload-validation',
        'api/v2/assets/(?P<uid_asset>[^/.]+)/exports/',  # noqa: E501
        'POST',
    ),
    (
        'request-payload-validation',
        'api/v2/assets/(?P<uid_asset>[^/.]+)/files/',  # noqa: E501
        'POST',
    ),
    (
        'request-payload-validation',
        'api/v2/assets/(?P<uid_asset>[^/.]+)/hooks/',  # noqa: E501
        'POST',
    ),
    (
        'request-payload-validation',
        'api/v2/assets/(?P<uid_asset>[^/.]+)/paired-data/',  # noqa: E501
        'POST',
    ),
    (
        'request-payload-validation',
        'api/v2/assets/(?P<uid_asset>[^/.]+)/permission-assignments/',  # noqa: E501
        'POST',
    ),
    (
        'request-payload-validation',
        'api/v2/assets/<uid_asset>/data/<root_uuid>/supplement/',  # noqa: E501
        'PATCH',
    ),
    ('request-payload-validation', 'api/v2/assets/bulk/', 'POST'),
    (
        'request-payload-validation',
        'api/v2/scim/v2/(?P<idp_slug>[^/.]+)/Groups',  # noqa: E501
        'POST',
    ),
    (
        'request-payload-validation',
        'api/v2/scim/v2/(?P<idp_slug>[^/.]+)/Groups/(?P<pk>[^/.]+)',  # noqa: E501
        'PUT',
    ),
    ('request-payload-validation', 'api/v2/scim/v2/(?P<idp_slug>[^/.]+)/Users', 'POST'),
    (
        'request-payload-validation',
        'api/v2/scim/v2/(?P<idp_slug>[^/.]+)/Users/(?P<pk>[^/.]+)',  # noqa: E501
        'PUT',
    ),
    ('response-validation', 'api/v2/asset_snapshots/', 'POST'),
    (
        'response-validation',
        'api/v2/asset_snapshots/(?P<uid_asset_snapshot>[^/.]+)/',  # noqa: E501
        'GET',
    ),
    ('response-validation', 'api/v2/assets/', 'GET'),
    ('response-validation', 'api/v2/assets/', 'POST'),
    ('response-validation', 'api/v2/assets/(?P<uid_asset>[^/.]+)/', 'GET'),
    ('response-validation', 'api/v2/assets/(?P<uid_asset>[^/.]+)/', 'PATCH'),
    (
        'response-validation',
        'api/v2/assets/(?P<uid_asset>[^/.]+)/advanced-features/',  # noqa: E501
        'POST',
    ),
    (
        'response-validation',
        'api/v2/assets/(?P<uid_asset>[^/.]+)/advanced-features/bulk-actions/',  # noqa: E501
        'GET',
    ),
    (
        'response-validation',
        'api/v2/assets/(?P<uid_asset>[^/.]+)/advanced-features/bulk-actions/',  # noqa: E501
        'POST',
    ),
    (
        'response-validation',
        'api/v2/assets/(?P<uid_asset>[^/.]+)/advanced-features/bulk-actions/(?P<action_uid>[^/.]+)/',  # noqa: E501
        'GET',
    ),
    (
        'response-validation',
        'api/v2/assets/(?P<uid_asset>[^/.]+)/advanced-features/bulk-actions/(?P<action_uid>[^/.]+)/',  # noqa: E501
        'PATCH',
    ),
    (
        'response-validation',
        'api/v2/assets/(?P<uid_asset>[^/.]+)/attachments/audio-duration/',  # noqa: E501
        'POST',
    ),
    (
        'response-validation',
        'api/v2/assets/(?P<uid_asset>[^/.]+)/attachments/bulk/',  # noqa: E501
        'DELETE',
    ),
    ('response-validation', 'api/v2/assets/(?P<uid_asset>[^/.]+)/counts/', 'GET'),
    ('response-validation', 'api/v2/assets/(?P<uid_asset>[^/.]+)/data/', 'GET'),
    (
        'response-validation',
        'api/v2/assets/(?P<uid_asset>[^/.]+)/data/(?P<pk>[^/.]+)/',  # noqa: E501
        'GET',
    ),
    (
        'response-validation',
        'api/v2/assets/(?P<uid_asset>[^/.]+)/data/(?P<pk>[^/.]+)/enketo/edit/',  # noqa: E501
        'GET',
    ),
    (
        'response-validation',
        'api/v2/assets/(?P<uid_asset>[^/.]+)/data/(?P<pk>[^/.]+)/enketo/view/',  # noqa: E501
        'GET',
    ),
    (
        'response-validation',
        'api/v2/assets/(?P<uid_asset>[^/.]+)/data/(?P<pk>[^/.]+)/validation_status/',  # noqa: E501
        'GET',
    ),
    (
        'response-validation',
        'api/v2/assets/(?P<uid_asset>[^/.]+)/data/(?P<pk>[^/.]+)/validation_status/',  # noqa: E501
        'PATCH',
    ),
    (
        'response-validation',
        'api/v2/assets/(?P<uid_asset>[^/.]+)/data/(?P<uid_data>[^/.]+)/attachments/',  # noqa: E501
        'GET',
    ),
    ('response-validation', 'api/v2/assets/(?P<uid_asset>[^/.]+)/deployment/', 'PATCH'),
    ('response-validation', 'api/v2/assets/(?P<uid_asset>[^/.]+)/deployment/', 'POST'),
    ('response-validation', 'api/v2/assets/(?P<uid_asset>[^/.]+)/exports/', 'POST'),
    (
        'response-validation',
        'api/v2/assets/(?P<uid_asset>[^/.]+)/exports/(?P<uid_export>[^/.]+)/',  # noqa: E501
        'GET',
    ),
    ('response-validation', 'api/v2/assets/(?P<uid_asset>[^/.]+)/hooks/', 'GET'),
    ('response-validation', 'api/v2/assets/(?P<uid_asset>[^/.]+)/hooks/', 'POST'),
    (
        'response-validation',
        'api/v2/assets/(?P<uid_asset>[^/.]+)/hooks/(?P<uid_hook>[^/.]+)/',  # noqa: E501
        'GET',
    ),
    (
        'response-validation',
        'api/v2/assets/(?P<uid_asset>[^/.]+)/hooks/(?P<uid_hook>[^/.]+)/',  # noqa: E501
        'PATCH',
    ),
    (
        'response-validation',
        'api/v2/assets/(?P<uid_asset>[^/.]+)/hooks/(?P<uid_hook>[^/.]+)/logs/(?P<uid_log>[^/.]+)/retry/',  # noqa: E501
        'PATCH',
    ),
    ('response-validation', 'api/v2/assets/(?P<uid_asset>[^/.]+)/paired-data/', 'GET'),
    ('response-validation', 'api/v2/assets/(?P<uid_asset>[^/.]+)/paired-data/', 'POST'),
    (
        'response-validation',
        'api/v2/assets/(?P<uid_asset>[^/.]+)/permission-assignments/bulk/',  # noqa: E501
        'POST',
    ),
    ('response-validation', 'api/v2/assets/(?P<uid_asset>[^/.]+)/reports/', 'GET'),
    ('response-validation', 'api/v2/assets/<uid_asset>/data/<pk>/edit/', 'GET'),
    (
        'response-validation',
        'api/v2/assets/<uid_asset>/data/<root_uuid>/supplement/',  # noqa: E501
        'GET',
    ),
    (
        'response-validation',
        'api/v2/assets/<uid_asset>/data/<root_uuid>/supplement/',  # noqa: E501
        'PATCH',
    ),
    ('response-validation', 'api/v2/audit-logs/', 'GET'),
    ('response-validation', 'api/v2/environment/', 'GET'),
    ('response-validation', 'api/v2/imports/(?P<uid_import>[^/.]+)/', 'GET'),
    (
        'response-validation',
        'api/v2/organizations/(?P<uid_organization>[^/.]+)/asset_usage/',  # noqa: E501
        'GET',
    ),
    (
        'response-validation',
        'api/v2/organizations/(?P<uid_organization>[^/.]+)/assets/',  # noqa: E501
        'GET',
    ),
    (
        'response-validation',
        'api/v2/organizations/(?P<uid_organization>[^/.]+)/members/',  # noqa: E501
        'GET',
    ),
    (
        'response-validation',
        'api/v2/organizations/(?P<uid_organization>[^/.]+)/members/(?P<username>[^/.]+)/',  # noqa: E501
        'GET',
    ),
    (
        'response-validation',
        'api/v2/organizations/(?P<uid_organization>[^/.]+)/members/(?P<username>[^/.]+)/',  # noqa: E501
        'PATCH',
    ),
    ('response-validation', 'api/v2/project-ownership/invites/', 'POST'),
    (
        'response-validation',
        'api/v2/project-ownership/invites/(?P<uid_invite>[^/.]+)/',  # noqa: E501
        'GET',
    ),
    (
        'response-validation',
        'api/v2/project-ownership/invites/(?P<uid_invite>[^/.]+)/',  # noqa: E501
        'PATCH',
    ),
    (
        'response-validation',
        'api/v2/project-views/(?P<uid_project_view>[^/.]+)/assets/',  # noqa: E501
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
})
