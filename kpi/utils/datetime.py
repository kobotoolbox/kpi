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


def next_first_day_of_the_month():
    """
    Return a datetime object for first day of the next month. If today is the first, return today's date.
    """
    date = timezone.now()
    if date.day != 1:
        month = date.month + 1
        if month > 12:
            date = date.replace(year=date.year + 1)
            month = month % 12
        date = date.replace(day=1, month=month)
    return date


def next_first_day_of_the_year():
    date = timezone.now()
    next_year = date.year + 1
    if date.day != 1 or date.month != 1:
        date = date.replace(day=1, month=1, year=next_year)
    return date
