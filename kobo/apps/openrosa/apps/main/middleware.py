import re

from django.conf import settings
from reversion.middleware import RevisionMiddleware as ReversionRevisionMiddleware


class RevisionMiddleware(ReversionRevisionMiddleware):
    """
    Overload reversion middleware to avoid creating revisions based on the
    url pattern and the request method.
    """
    def request_creates_revision(self, request):
        url_patterns = settings.REVERSION_MIDDLEWARE_SKIPPED_URL_PATTERNS
        for url_pattern, methods in url_patterns.items():
            if re.match(url_pattern, request.path) and request.method in methods:
                return False

        return super().request_creates_revision(request)
