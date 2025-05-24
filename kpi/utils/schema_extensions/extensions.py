from drf_spectacular.extensions import OpenApiAuthenticationExtension


class BasicAuthExtension(OpenApiAuthenticationExtension):
    target_class = 'kpi.authentication.BasicAuthentication'
    name = 'BasicAuth'

    def get_security_definition(self, auto_schema):
        return {'type': 'http', 'scheme': 'basic'}


class TokenAuthExtension(OpenApiAuthenticationExtension):
    target_class = 'kpi.authentication.TokenAuthentication'
    name = 'TokenAuth'

    def get_security_definition(self, auto_schema):
        return {
            'type': 'apiKey',
            'in': 'header',
            'name': 'Authorization',
            'description': 'Token-based authentication. Use the format: `Token <your-token>`'
        }
