from django.conf import settings
from django.middleware.locale import LocaleMiddleware as DjangoLocaleMiddleware
from django.utils.deprecation import MiddlewareMixin

from hub.models.v1_user_tracker import V1UserTracker


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


class V1AccessLoggingMiddleware(MiddlewareMixin):
    """
    Middleware to log access to deprecated v1 endpoints by authenticated users
    """
    legacy_patterns = [
        '/api/v1/',
        '/assets/',
        '/asset_snapshots/',
        '/asset_subscriptions/',
        '/exports/',
        '/imports/',
        '/permissions/',
        '/reports/',
        '/tags/',
        '/authorized_application/',
        '/users/',
    ]

    def process_response(self, request, response):
        # DRF token/basic/oauth authentication runs during view processing,
        # not in Django's request middleware phase. Tracking on the response
        # path lets us see both session-authenticated browser requests and
        # header-authenticated API requests
        if not request.user.is_authenticated:
            return response

        if any(request.path.startswith(pattern) for pattern in self.legacy_patterns):
            V1UserTracker.objects.update_or_create(
                user=request.user,
                defaults={'last_accessed_path': request.path},
            )
        return response
