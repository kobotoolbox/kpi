from drf_spectacular.generators import SchemaGenerator, EndpointEnumerator

OPEN_ROSA_ENDPOINTS = [
    # Openrosa add when user is authentified
    '/formList',
    '/submission',
    '/xformsManifest/{pk}',
    '/xformsMedia/{pk}/{metadata}',
    # Openrosa add when user is anonymous
    '/{username}/formList',
    '/{username}/submission',
    '/{username}/xformsManifest/{pk}',
    '/{username}/xformsMedia/{pk}/{metadata}',
    # Openrosa edit
    '/api/v2/asset_snapshots/{uid}/formList',
    '/api/v2/asset_snapshots/{uid}/manifest',
    '/api/v2/asset_snapshots/{uid}/submission',
]

class ApiOpenRosaEndpointEnumerator(EndpointEnumerator):

    """
    This enumerator filters through all endpoint path and only keeps those
    that are part of openrosa
    """
    def _get_api_endpoints(self, patterns, prefix):
        endpoints = super()._get_api_endpoints(patterns, prefix)

        filtered = []

        for path, path_regex, method, callback in endpoints:
            if path not in OPEN_ROSA_ENDPOINTS:
                continue

            filtered.append((path, path_regex, method, callback))

        return filtered


class ApiV2EndpointEnumerator(EndpointEnumerator):

    """
    This enumerator filters through all endpoint path and only keeps those
    that are part of the api/v2
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


class ApiOpenRosaSchemaGenerator(SchemaGenerator):
    endpoint_inspector_cls = ApiOpenRosaEndpointEnumerator


class ApiV2SchemaGenerator(SchemaGenerator):
    endpoint_inspector_cls = ApiV2EndpointEnumerator
