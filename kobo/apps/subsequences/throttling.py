import constance
from rest_framework.exceptions import Throttled
from rest_framework.throttling import SimpleRateThrottle

from kobo.apps.subsequences.constants import Action


class AutomaticQARateThrottle(SimpleRateThrottle):
    scope = 'automatic_qa'

    def get_rate(self):
        rate = constance.config.AUTOMATIC_QA_REQUESTS_PER_SECOND
        return f'{rate}/second'

    def get_cache_key(self, request, view):
        user = getattr(request, 'user', None)
        if user and user.is_authenticated:
            # Cache key format: 'automatic_qa:<user_id>'
            return self.cache_format % {
                'scope': self.scope,
                'ident': user.pk
            }
        return None


def check_automatic_qa_throttle(request, view):
    throttle = AutomaticQARateThrottle()
    if not throttle.allow_request(request, view):
        raise Throttled(wait=throttle.wait())


def is_automatic_qa_request(data: dict) -> bool:
    for xpath, actions in data.items():
        if isinstance(actions, dict) and Action.AUTOMATIC_BEDROCK_QUAL in actions:
            return True
    return False
