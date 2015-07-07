import hashlib
import urllib

def gravatar_url(email, https=True):
    return "%s://www.gravatar.com/avatar/%s?%s" % (
        'https' if https else 'http',
        hashlib.md5(email.lower()).hexdigest(),
        urllib.urlencode({'s': '40'}),
        )
