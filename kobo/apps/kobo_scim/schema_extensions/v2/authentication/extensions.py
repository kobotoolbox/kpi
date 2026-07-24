from drf_spectacular.extensions import OpenApiAuthenticationExtension


class ScimAuthExtension(OpenApiAuthenticationExtension):
    target_class = 'kobo.apps.kobo_scim.authentication.ScimAuthentication'
    name = 'ScimAuth'

    def get_security_definition(self, auto_schema):
        return {
            'type': 'http',
            'scheme': 'bearer',
            'description': (
                'Authentication via SCIM API Key provided in the '
                'Authorization header as a Bearer token.'
            ),
        }
