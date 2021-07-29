# coding: utf-8
from datetime import timedelta

from django.utils import timezone

def one_minute_from_now():
    return several_minutes_from_now(1)

def several_minutes_from_now(minutes: int):
    """
    Return a datetime object of many minutes (specified with `minutes`)
    from now.
    """
    return timezone.now() + timedelta(minutes=minutes)

def ten_minutes_from_now():
    return several_minutes_from_now(10)