from drf_spectacular.generators import SchemaGenerator, EndpointEnumerator

OPEN_ROSA_ENDPOINTS = [
    # '/forms/{pk}/form.xml',
    # '/{username}/forms/{pk}/form.xml',
    '/formList',
    '/submission',
    '/xformsManifest/{pk}',
    '/xformsMedia/{pk}/{metadata}',
    '/{username}/formList',
    '/{username}/submission',
    '/{username}/xformsManifest/{pk}',
    '/{username}/xformsMedia/{pk}/{metadata}',
    '/api/v2/asset_snapshots/{uid}/formList',
    '/api/v2/asset_snapshots/{uid}/manifest',
    '/api/v2/asset_snapshots/{uid}/submission',
]

class V2EndpointEnumerator(EndpointEnumerator):

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


class OpenRosaEndpointEnumerator(EndpointEnumerator):

    def _get_api_endpoints(self, patterns, prefix):
        endpoints = super()._get_api_endpoints(patterns, prefix)

        filtered = []

        for path, path_regex, method, callback in endpoints:
            if path not in OPEN_ROSA_ENDPOINTS:
                continue

            filtered.append((path, path_regex, method, callback))

        return filtered


class V2SchemaGenerator(SchemaGenerator):
    endpoint_inspector_cls = V2EndpointEnumerator


class OpenRosaSchemaGenerator(SchemaGenerator):
    endpoint_inspector_cls = OpenRosaEndpointEnumerator


def pre_processing_filtering(endpoints):
    filtered = []
    seen = []

    for path, path_regex, method, callback in endpoints:
        # Remove all endpoints not in 'api/v2/'
        if path.startswith('/api/v1/'):
            continue

        normalized_path = path.rstrip('/')
        if (normalized_path, method) in seen:
            continue

        seen.append((normalized_path, method))
        filtered.append((path, path_regex, method, callback))

    return filtered
