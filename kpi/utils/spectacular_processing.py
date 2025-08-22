from drf_spectacular.generators import EndpointEnumerator, SchemaGenerator

OPEN_ROSA_ENDPOINTS = [
    # OpenRosa endpoints for adding submissions as an authenticated user
    '/formList',
    '/submission',
    '/xformsManifest/{pk}',
    '/xformsMedia/{pk}/{metadata}',
    # OpenRosa endpoints for adding submissions as an anonymous user
    '/{username}/formList',
    '/{username}/submission',
    '/{username}/xformsManifest/{pk}',
    '/{username}/xformsMedia/{pk}/{metadata}',
    # OpenRosa endpoints for editing submissions
    '/api/v2/asset_snapshots/{uid}/formList',
    '/api/v2/asset_snapshots/{uid}/manifest',
    '/api/v2/asset_snapshots/{uid}/submission',
]


class OpenRosaAPIEndpointEnumerator(EndpointEnumerator):
    """
    Filters endpoint paths and returns only those that belong to the OpenRosa API.
    """

    def _get_api_endpoints(self, patterns, prefix):
        endpoints = super()._get_api_endpoints(patterns, prefix)

        filtered = []

        for path, path_regex, method, callback in endpoints:
            if path not in OPEN_ROSA_ENDPOINTS:
                continue

            filtered.append((path, path_regex, method, callback))

        return filtered


class OpenRosaAPISchemaGenerator(SchemaGenerator):
    endpoint_inspector_cls = OpenRosaAPIEndpointEnumerator


class V2APIEndpointEnumerator(EndpointEnumerator):
    """
    Filters endpoint paths and returns only those that belong to the `v2` API.
    """

    def _get_api_endpoints(self, patterns, prefix):
        endpoints = super()._get_api_endpoints(patterns, prefix)

        filtered = []
        seen = []

        for path, path_regex, method, callback in endpoints:
            # Remove all endpoints not in 'api/v2/'
            if path.startswith('/api/v1/'):
                continue

            if path in OPEN_ROSA_ENDPOINTS:
                continue

            normalized_path = path.rstrip('/')
            if (normalized_path, method) in seen:
                continue

            seen.append((normalized_path, method))
            filtered.append((path, path_regex, method, callback))

        return filtered


class V2APISchemaGenerator(SchemaGenerator):
    endpoint_inspector_cls = V2APIEndpointEnumerator
