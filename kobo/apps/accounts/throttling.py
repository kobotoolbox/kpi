import hashlib

import constance
from rest_framework.exceptions import APIException
from rest_framework.throttling import SimpleRateThrottle


class EmailConfirmationRequestEmailThrottle(SimpleRateThrottle):
    """
    Per-address limit on the unauthenticated "resend confirmation email" endpoint

    Keying on the requested address rather than on the caller is deliberate: it is
    the recipient's inbox, and the sending domain's reputation, that need
    protecting, and a caller rotating through source addresses must not be able to
    buy a fresh budget for the same victim.
    """

    scope = 'email_confirmation_request_email'

    def get_rate(self):
        # Stored as a plain number, so an admin cannot enter a rate string DRF
        # fails to parse. 0 disables the limit; without this it would parse as
        # "allow nothing" and break every account activation
        per_hour = constance.config.EMAIL_CONFIRMATION_REQUESTS_PER_HOUR
        return f'{per_hour}/hour' if per_hour else None

    def get_cache_key(self, request, view):
        try:
            data = request.data
        except APIException:
            # Unparseable body; the view will reject it, and no mail can be sent
            # for a request that never yields an address
            return None

        email = data.get('email') if hasattr(data, 'get') else None
        if not isinstance(email, str) or not email.strip():
            return None

        # Hash rather than store the address: throttle keys live in Redis and
        # surface in its logs and monitoring, and a raw address there would
        # disclose exactly which inboxes have been probed
        ident = hashlib.sha256(email.strip().lower().encode()).hexdigest()
        # The cache key format is inherited from `SimpleRateThrottle.cache_format`
        # and follows the pattern: 'throttle_<scope>_<ident>'
        return self.cache_format % {'scope': self.scope, 'ident': ident}
