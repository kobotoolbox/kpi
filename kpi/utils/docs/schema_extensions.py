from drf_spectacular.extensions import OpenApiAuthenticationExtension


class BasicAuthExtension(OpenApiAuthenticationExtension):
    target_class = 'kpi.authentication.BasicAuthentication'
    name = 'BasicAuth'

    def get_security_definition(self, auto_schema):
        return {'type': 'http', 'scheme': 'basic'}


class DigestAuthExtension(OpenApiAuthenticationExtension):
    target_class = 'kpi.authentication.DigestAuthentication'
    name = 'DigestAuth'

    def get_security_definition(self, auto_schema):
        return {
            'type': 'http',
            'scheme': 'digest',
        }


class OAuth2AuthExtension(OpenApiAuthenticationExtension):
    target_class = 'kpi.authentication.OAuth2Authentication'
    name = 'OAuth2'

    def get_security_definition(self, auto_schema):
        return {
            'type': 'http',
            'scheme': 'bearer',
            'bearerFormat': 'JWT',
        }


class SessionAuthExtension(OpenApiAuthenticationExtension):
    target_class = 'kpi.authentication.SessionAuthentication'
    name = 'SessionAuth'

    def get_security_definition(self, auto_schema):
        return {
            'type': 'apiKey',
            'in': 'cookie',
            'name': 'sessionid',
        }


class TokenAuthExtension(OpenApiAuthenticationExtension):
    target_class = 'kpi.authentication.TokenAuthentication'
    name = 'TokenAuth'

    def get_security_definition(self, auto_schema):
        return {
            'type': '',
            'scheme': '',
            # TODO
            #   finish token auth extension
        }

