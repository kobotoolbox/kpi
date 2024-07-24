# coding: utf-8
from urllib.request import urlopen

from django.utils.http import urlencode
from kobo.apps.openrosa.libs.utils.hash import get_hash

DEFAULT_GRAVATAR = "https://formhub.org/static/images/formhub_avatar.png"
GRAVATAR_ENDPOINT = "https://secure.gravatar.com/avatar/"
GRAVATAR_SIZE = str(60)


def get_gravatar_img_link(user):
    url = GRAVATAR_ENDPOINT +\
        get_hash(user.email.lower()) + "?" + urlencode({
            'd': DEFAULT_GRAVATAR, 's': GRAVATAR_SIZE
        })
    return url


def gravatar_exists(user):
    url = GRAVATAR_ENDPOINT +\
        get_hash(user.email.lower()) + "?" + "d=404"
    exists = urlopen(url).getcode() != 404
    return exists
