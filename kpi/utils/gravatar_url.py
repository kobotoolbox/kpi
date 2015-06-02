import hashlib
import urllib

def gravatar_url(email):
    return "http://www.gravatar.com/avatar/%s?%s" % (
        hashlib.md5(email.lower()).hexdigest(),
        urllib.urlencode({'s': '40'}),
        )
