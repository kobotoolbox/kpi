from datetime import datetime
from zoneinfo import ZoneInfo

from django.conf import settings
from rest_framework import status
from rest_framework.response import Response


class OpenRosaViewSetMixin:

    @staticmethod
    def get_headers():
        dt = datetime.now(tz=ZoneInfo('UTC')).strftime('%a, %d %b %Y %H:%M:%S %Z')

        return {
            'Date': dt,
            'X-OpenRosa-Version': '1.0',
            'X-OpenRosa-Accept-Content-Length': settings.OPENROSA_DEFAULT_CONTENT_LENGTH,
            'Content-Type': 'text/xml; charset=utf-8',
        }

    def get_response_for_head_request(self):
        # Supporting HEAD requests is required by OpenRosa specification, e.g.
        # https://docs.getodk.org/openrosa-form-submission/#extended-transmission-considerations
        # …and the OpenRosa specification contradicts the HTTP specification:
        #     ODK Collect also requires a 204 (No Content) status code in the
        #     HEAD response.
        # (https://httpwg.org/specs/rfc7231.html#status.200 explicitly lists
        # 200 as a valid response status code for a HEAD.)
        #
        # Other requirements laid out by the HTTP specification for responses
        # to HEADs should be followed:
        #     The HEAD method is identical to GET except that the server MUST
        #     NOT send a message body in the response (i.e., the response
        #     terminates at the end of the header section). The server SHOULD
        #     send the same header fields in response to a HEAD request as it
        #     would have sent if the request had been a GET, except that the
        #     payload header fields (Section 3.3) MAY be omitted.
        #     (https://httpwg.org/specs/rfc7231.html#HEAD)
        #
        # TODO: Should this return the same `Content-Length` that would've been
        # returned in response to a GET? Currently, it returns
        # `Content-Length: 0` due to Django's `CommonMiddleware`
        # (https://docs.djangoproject.com/en/3.2/ref/middleware/#module-django.middleware.common)
        return Response(
            headers=self.get_headers(), status=status.HTTP_204_NO_CONTENT
        )
