from drf_spectacular.extensions import OpenApiAuthenticationExtension

class CustomBasicAuthExtension(OpenApiAuthenticationExtension):
    target_class = 'kpi.authentication.BasicAuthentication'
    name = 'BasicAuth'

    def get_security_definition(self, auto_schema):
        return {
            'type': 'http',
            'scheme': 'basic'
        }

class CustomDigestAuthExtension(OpenApiAuthenticationExtension):
    target_class = 'kpi.authentication.DigestAuthentication'
    name = 'DigestAuth'

    def get_security_definition(self, auto_schema):
        return {
            'type': 'http',
            'scheme': 'digest',  # 'digest' is nonstandard but used in some tools
        }

class CustomSessionAuthExtension(OpenApiAuthenticationExtension):
    target_class = 'kpi.authentication.SessionAuthentication'
    name = 'SessionAuth'

    def get_security_definition(self, auto_schema):
        return {
            'type': 'apiKey',
            'in': 'cookie',
            'name': 'sessionid',  # or whatever cookie your session uses
        }

class CustomOAuth2AuthExtension(OpenApiAuthenticationExtension):
    target_class = 'kpi.authentication.OAuth2Authentication'
    name = 'OAuth2'

    def get_security_definition(self, auto_schema):
        return {
            'type': 'http',
            'scheme': 'bearer',
            'bearerFormat': 'JWT'  # or whatever you use
        }


