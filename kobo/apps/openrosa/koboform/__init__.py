# coding: utf-8
from django.conf import settings
from django.urls import reverse


def redirect_url(url_param):
    return settings.KOBOFORM_URL + url_param


def login_url(next_kobocat_url=False, next_url=False):
    # use kpi login if configuration exists

    url_ = redirect_url(reverse('account_login'))
    if next_kobocat_url:
        next_url = f'/kobocat{next_kobocat_url}'
    if next_url:
        url_ = f'{url_}?next={next_url}'
    return url_
