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
    # OpenRosa endpoints for adding submissions as data collector
    '/collector/{token}/formList',
    '/collector/{token}/xformsManifest/{pk}',
    '/collector/{token}/xformsMedia/{pk}/{metadata}',
    '/collector/{token}/submission',
    # OpenRosa endpoints for editing submissions
    '/api/v2/asset_snapshots/{uid_asset_snapshot}/formList',
    '/api/v2/asset_snapshots/{uid_asset_snapshot}/manifest',
    '/api/v2/asset_snapshots/{uid_asset_snapshot}/submission',
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


def merge_allauth_headless_schema(result, generator, request, public):
    """
    Spectacular postprocessing hook to automatically add the `django-allauth` headless
    OpenAPI specifications into the generated schema.
    """
    try:
        from allauth.headless.spec.internal.schema import get_schema
    except ImportError:
        return result

    # allauth headless serves endpoints assuming a `/_allauth/` base
    # (or similar) but we want to mount/document them under `/api/v2/allauth/`
    # in the Swagger UI.
    allauth_schema = get_schema()
    if not allauth_schema:
        return result

    allauth_paths = allauth_schema.get('paths', {})
    allauth_components = allauth_schema.get('components', {})

    # We will prepend `/api/v2/allauth` to the paths in allauth's dictionary
    # because the user requested /api/v2/allauth/browser/v1/*
    merged_paths = dict(result.get('paths', {}))

    import copy

    for path_key, path_spec in allauth_paths.items():
        # The schema outputs paths with `{client}` (e.g. `/_allauth/{client}/v1/config`)
        # Since the frontend assumes specific `/browser/` and `/app/` endpoints,
        # we duplicate the generic path for each platform so Orval doesn't
        # complain about missing parameter definitions for `{client}`.
        # E.g. it would convert `_allauth/{client}/v1/config` to these endpoints:
        #   1. `/api/v2/allauth/app/v1/config`
        #   2. `/api/v2/allauth/browser/v1/config`

        clients = ['browser', 'app'] if '{client}' in path_key else [None]

        for client in clients:
            current_path_key = (
                path_key.replace('{client}', client) if client else path_key
            )

            # Handle the path based on whether it already includes the mounted namespace
            if current_path_key.startswith('/_allauth/'):
                new_path = current_path_key.replace('/_allauth/', '/api/v2/allauth/')
            elif current_path_key.startswith('/api/v2/allauth/'):
                new_path = current_path_key
            else:
                new_path = f'/api/v2/allauth{current_path_key}'

            cloned_spec = copy.deepcopy(path_spec)

            # Optionally rewrite tags to group them under something specific.
            for method, operation in cloned_spec.items():
                if isinstance(operation, dict):
                    operation['tags'] = ['Authentication (Allauth Headless)']
                    if 'operationId' not in operation:
                        # e.g., turn `/api/v2/allauth/browser/v1/auth/login` + `post`
                        # into `allauth_browser_v1_auth_login_post`
                        clean_path = (
                            new_path.strip('/')
                            .replace('/', '_')
                            .replace('{', '')
                            .replace('}', '')
                            .replace('-', '_')
                        )
                        operation['operationId'] = f'{clean_path}_{method}'
                    else:
                        # Append the client format to uniquely isolate browser vs app ID
                        # definitions
                        if client and not operation['operationId'].endswith(
                            f'_{client}'
                        ):
                            operation['operationId'] = (
                                f"{operation['operationId']}_{client}"
                            )

                        # Fix any references inside the operationId that literalize the
                        # '{client}' string
                        if 'client' in operation['operationId']:
                            operation['operationId'] = operation['operationId'].replace(
                                'client', client or 'auth'
                            )

            merged_paths[new_path] = cloned_spec

    result['paths'] = merged_paths

    # Merge all OpenAPI components (schemas, parameters, responses, etc)
    if 'components' not in result:
        result['components'] = {}

    for comp_type, comp_dict in allauth_components.items():
        if comp_type not in result['components']:
            result['components'][comp_type] = {}
        result['components'][comp_type].update(comp_dict)

    return result
