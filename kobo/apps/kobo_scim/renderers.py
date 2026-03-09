from rest_framework.parsers import JSONParser
from rest_framework.renderers import JSONRenderer


class SCIMRenderer(JSONRenderer):
    """
    Renders SCIM responses using the `application/scim+json` media type.
    """
    media_type = 'application/scim+json'


class SCIMParser(JSONParser):
    """
    Parses SCIM requests using the `application/scim+json` media type.
    """
    media_type = 'application/scim+json'
