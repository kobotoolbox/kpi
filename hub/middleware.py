from django.conf import settings
from django.middleware.locale import LocaleMiddleware as DjangoLocaleMiddleware
from django.utils.deprecation import MiddlewareMixin


class LocaleMiddleware(DjangoLocaleMiddleware):
    def process_response(self, request, response):
        response = super().process_response(request, response)
        try:
            request.COOKIES[settings.LANGUAGE_COOKIE_NAME]
        except KeyError:
            # If cookie does not exist, let's set it
            # "Content-Language" attribute is set by `super()`
            current_language = response['Content-Language']
            response.set_cookie(
                settings.LANGUAGE_COOKIE_NAME,
                current_language,
                max_age=settings.LANGUAGE_COOKIE_AGE,
                path=settings.LANGUAGE_COOKIE_PATH,
                domain=settings.LANGUAGE_COOKIE_DOMAIN,
                secure=settings.LANGUAGE_COOKIE_SECURE,
                httponly=settings.LANGUAGE_COOKIE_HTTPONLY,
                samesite=settings.LANGUAGE_COOKIE_SAMESITE,
            )

        return response


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
