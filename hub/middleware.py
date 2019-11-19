# coding: utf-8
from django.utils.deprecation import MiddlewareMixin


class UsernameInResponseHeaderMiddleware(MiddlewareMixin):
    """
    Record the authenticated user (if any) in the `X-KoBoNaUt` HTTP header
    """
    def process_response(self, request, response):
        try:
            user = request.user
        except AttributeError:
            return response
        if user.is_authenticated:
            response['X-KoBoNaUt'] = request.user.username
        return response
