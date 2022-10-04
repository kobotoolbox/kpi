# coding: utf-8
import re
from datetime import datetime, date, timedelta

from django.contrib.auth.decorators import user_passes_test
from django.core.files.storage import get_storage_class
from django.http import HttpResponse, StreamingHttpResponse, Http404
from django.urls import reverse
from django.utils import timezone

from kobo.settings.base import KOBOFORM_URL
from .tasks import (
    generate_country_report,
    generate_continued_usage_report,
    generate_domain_report,
    generate_forms_count_by_submission_range,
    generate_media_storage_report,
    generate_user_count_by_organization,
    generate_user_statistics_report,
    generate_user_details_report,
    generate_user_report,
)


def _base_filename_to_full_filename(base_filename, username):
    return '__'.join([
        username,
        base_filename
    ])


@user_passes_test(lambda u: u.is_superuser)
def country_report(request):
    """
    Generates a report which counts the number of submissions and forms
    per country as reported by the user
    """
    today = timezone.now().date()
    base_filename = 'country-report_{}_{}_{}.csv'.format(
        re.sub('[^a-zA-Z0-9]', '-', request.META['HTTP_HOST']),
        today,
        datetime.now().microsecond
    )

    # Get the date filters from the query and set defaults
    start_date = request.GET.get('start_date', today)
    tomorrow = today + timedelta(days=1)
    end_date = request.GET.get('end_date', tomorrow)

    # Generate the CSV file
    filename = _base_filename_to_full_filename(
        base_filename, request.user.username)
    generate_country_report.delay(filename, start_date, end_date)

    template_ish = (
        f'<html><head><title>Countries report</title></head>'
        f'<body>Your report is being generated. Once finished, it will be '
        f'available at <a href="{base_filename}">{base_filename}</a>.<br>'
        f'If you receive a 404, please refresh your browser periodically until '
        f'your request succeeds.<br><br>'
        f'To select a date range, add a <code style="background: lightgray">?</code> at the end of the URL and set the '
        f'<code style="background: lightgray">start_date</code> parameter to <code style="background: lightgray">YYYY-MM-DD</code> and/or the '
        f'<code style="background: lightgray">end_date</code> parameter to <code style="background: lightgray">YYYY-MM-DD</code>.<br><br>'
        f'<b>Example:</b><br>'
        f'<a href="{KOBOFORM_URL}/superuser_stats/country_report/?start_date=2020-01-31&end_date=2021-02-28">'
        f'  {KOBOFORM_URL}/superuser_stats/country_report/?start_date=2020-01-31&end_date=2021-02-28'
        f'</a>'
        f'</body></html>'
    )

    return HttpResponse(template_ish)


@user_passes_test(lambda u: u.is_superuser)
def continued_usage_report(request):
    """
    Tracks users usage over a given year with the last day being set by
    'end_date'
    """
    today = timezone.now().date()
    base_filename = 'continued-usage-report_{}_{}_{}.csv'.format(
        re.sub('[^a-zA-Z0-9]', '-', request.META['HTTP_HOST']),
        today,
        timezone.now().microsecond
    )

    # Get the date filters from the query and set defaults
    tomorrow = today + timedelta(days=1)
    end_date = request.GET.get('end_date', tomorrow)

    # Generate the CSV file
    filename = _base_filename_to_full_filename(
        base_filename, request.user.username)
    generate_continued_usage_report.delay(filename, end_date)

    template_ish = (
        f'<html><head><title>Continued usage report</title></head>'
        f'<body>Your report is being generated. Once finished, it will be '
        f'available at <a href="{base_filename}">{base_filename}</a>.<br>'
        f'If you receive a 404, please refresh your browser periodically until '
        f'your request succeeds.<br><br>'
        f'To select a date range, add a <code style="background: lightgray">?</code> at the end of the URL and set the '
        f'<code style="background: lightgray">end_date</code> parameter to <code style="background: lightgray">YYYY-MM-DD</code>.<br><br>'
        f'<b>Example:</b><br>'
        f'<a href="{KOBOFORM_URL}/superuser_stats/continued_usage_report/?end_date=2021-02-28">'
        f'  {KOBOFORM_URL}/superuser_stats/continued_usage_report/?end_date=2021-02-28'
        f'</a>'
        f'</body></html>'
    )

    return HttpResponse(template_ish)


@user_passes_test(lambda u: u.is_superuser)
def domain_report(request):
    """
    Generates a report which counts the amount of users
    with the same email address domain
    """
    # Generate the file basename
    today = timezone.now().date()
    base_filename = 'domain-report_{}_{}_{}.csv'.format(
        re.sub('[^a-zA-Z0-9]', '-', request.META['HTTP_HOST']),
        today,
        timezone.now().microsecond
    )

    # Get the date filters from the query and set defaults
    start_date = request.GET.get(
        'start_date',
        f'{today.year}-{today.month}-{today.day}'
    )
    tomorrow = timezone.now() + timedelta(days=1)
    end_date = request.GET.get(
        'end_date',
        f'{tomorrow.year}-{tomorrow.month}-{tomorrow.day}'
    )

    # Generate the CSV file
    filename = _base_filename_to_full_filename(
        base_filename, request.user.username)
    generate_domain_report.delay(filename, start_date, end_date)

    # Generate page text
    template_ish = (
        f'<html><head><title>Domains report</title></head>'
        f'<body>Your report is being generated. Once finished, it will be '
        f'available at <a href="{base_filename}">{base_filename}</a>.<br>'
        f'If you receive a 404, please refresh your browser periodically until '
        f'your request succeeds.<br><br>'
        f'To select a date range, add a <code style="background: lightgray">?</code> at the end of the URL and set the '
        f'<code style="background: lightgray">start_date</code> parameter to <code style="background: lightgray">YYYY-MM-DD</code> and/or the '
        f'<code style="background: lightgray">end_date</code> parameter to <code style="background: lightgray">YYYY-MM-DD</code>.<br><br>'
        f'<b>Example:</b><br>'
        f'<a href="{KOBOFORM_URL}/superuser_stats/domain_report/?start_date=2020-01-31&end_date=2021-02-28">'
        f'  {KOBOFORM_URL}/superuser_stats/domain_report/?start_date=2020-01-31&end_date=2021-02-28'
        f'</a>'
        f'<p>The default date range is for today, but submissions count will not be'
        f' 0 unless it includes the range includes first of the month.</p>'
        f'</body></html>'
    )

    return HttpResponse(template_ish)


@user_passes_test(lambda u: u.is_superuser)
def forms_count_by_submission_report(request):
    """
    generates a report counting the number of forms within a
    submission range
    """
    today = timezone.now().date()
    base_filename = 'form-count-by-submissions-count-report_{}_{}_{}.csv'.format(
        re.sub('[^a-zA-Z0-9]', '-', request.META['HTTP_HOST']),
        today,
        datetime.now().microsecond
    )
    filename = _base_filename_to_full_filename(
        base_filename, request.user.username
    )
    generate_forms_count_by_submission_range.delay(filename)
    template_ish = (
        f'<html><head><title>Forms count by submissions count report.</title></head>'
        f'<body>Your report is being generated. Once finished, it will be '
        f'available at <a href="{base_filename}">{base_filename}</a>.<br>'
        f'If you receive a 404, please refresh your browser periodically until '
        f'your request succeeds.'
        f'</body></html>'
    )
    return HttpResponse(template_ish)


@user_passes_test(lambda u: u.is_superuser)
def media_storage(request):
    """
    Generates a report which totals the amount of GB a user
    has stored
    """
    base_filename = 'media_storage_report_{}_{}_{}.csv'.format(
        re.sub('[^a-zA-Z0-9]', '-', request.META['HTTP_HOST']),
        date.today(),
        datetime.now().microsecond
    )
    filename = _base_filename_to_full_filename(
        base_filename, request.user.username)
    generate_media_storage_report.delay(filename)
    template_ish = (
        '<html><head><title>Hello, superuser.</title></head>'
        '<body>Your report is being generated. Once finished, it will be '
        f'available at <a href="{base_filename}">{base_filename}</a>.<br>'
        'If you receive a 404, please refresh your browser periodically until '
        'your request succeeds.'
        '</body></html>'
    ).format(base_filename)
    return HttpResponse(template_ish)


@user_passes_test(lambda u: u.is_superuser)
def reports_list(request):
    """
    Generates a list of reports available to superusers
    """
    template_ish = (
        '<html><head><title>Super User Reports</title></head>'
        'This is a list of the available superuser reports<br>'
        '<a href="{0}">{0}</a><br>'
        '<a href="{1}">{1}</a><br>'
        '<a href="{2}">{2}</a><br>'
        '<a href="{3}">{3}</a><br>'
        '<a href="{4}">{4}</a><br>'
        '<a href="{5}">{5}</a><br>'
        '<a href="{6}">{6}</a><br>'
        '<a href="{7}">{7}</a><br>'
        '</html>'
    ).format(
        reverse(country_report),
        reverse(continued_usage_report),
        reverse(domain_report),
        reverse(forms_count_by_submission_report),
        reverse(media_storage),
        reverse(user_count_by_organization),
        reverse(user_report),
        reverse(user_statistics_report),
    )
    return HttpResponse(template_ish)


@user_passes_test(lambda u: u.is_superuser)
def user_count_by_organization(request):
    """
    Generates a report that counts the number of users per organization
    """
    # Generate the file basename
    base_filename = 'user-count-by-organization_{}_{}_{}.csv'.format(
        re.sub('[^a-zA-Z0-9]', '-', request.META['HTTP_HOST']),
        date.today(),
        datetime.now().microsecond
    )

    # Generate the CSV file
    filename = _base_filename_to_full_filename(
        base_filename, request.user.username)
    generate_user_count_by_organization.delay(filename)

    # Generate page text
    template_ish = (
        f'<html><head><title>Hello, superuser.</title></head>'
        f'<body>Your report is being generated. Once finished, it will be '
        f'available at <a href="{base_filename}">{base_filename}</a>.<br>'
        f'If you receive a 404, please refresh your browser periodically until '
        f'your request succeeds.</body></html>'
    )

    return HttpResponse(template_ish)


@user_passes_test(lambda u: u.is_superuser)
def user_report(request):
    """
    Generates a detailed report with a users details
    """
    base_filename = 'user-report_{}_{}_{}.csv'.format(
        re.sub('[^a-zA-Z0-9]', '-', request.META['HTTP_HOST']),
        date.today(),
        datetime.now().microsecond
    )
    filename = _base_filename_to_full_filename(
        base_filename, request.user.username)
    generate_user_report.delay(filename)
    template_ish = (
        f'<html><head><title>Hello, superuser.</title></head>'
        f'<body>Your report is being generated. Once finished, it will be '
        f'available at <a href="{base_filename}">{base_filename}</a>. If you receive a 404, please '
        f'refresh your browser periodically until your request succeeds.'
        f'</body></html>'
    )
    return HttpResponse(template_ish)


@user_passes_test(lambda u: u.is_superuser)
def user_statistics_report(request):
    """
    View for the User Statisctics Report
    Generates a detailed report of a user's activity
    over a period of time
    """
    base_filename = 'user-statistics-report_{}_{}_{}.csv'.format(
        re.sub('[^a-zA-Z0-9]', '-', request.META['HTTP_HOST']),
        date.today(),
        datetime.now().microsecond
    )

    # Get the date filters from the query and set defaults
    today = timezone.now().date()
    start_date = request.GET.get('start_date', today)
    tomorrow = today + timedelta(days=1)
    end_date = request.GET.get('end_date', tomorrow)

    # Generate the CSV file
    filename = _base_filename_to_full_filename(
        base_filename, request.user.username)
    generate_user_statistics_report.delay(filename, start_date, end_date)

    template_ish = (
        f'<html><head><title>User statistics report</title></head>'
        f'<body>Your report is being generated. Once finished, it will be '
        f'available at <a href="{base_filename}">{base_filename}</a>.<br>If you '
        f'receive a 404, please refresh your browser periodically until your '
        f'request succeeds.<br><br>'
        f'To select a date range, add a <code style="background: lightgray">?</code> at the end of the URL and set the '
        f'<code style="background: lightgray">start_date</code> parameter to <code style="background: lightgray">YYYY-MM-DD</code> and/or the '
        f'<code style="background: lightgray">end_date</code> parameter to <code style="background: lightgray">YYYY-MM-DD</code>.<br><br>'
        f'<b>Example:</b><br>'
        f'<a href="{KOBOFORM_URL}/superuser_stats/domain_report/?start_date=2020-01-31&end_date=2021-02-28">'
        f'  {KOBOFORM_URL}/superuser_stats/domain_report/?start_date=2020-01-31&end_date=2021-02-28'
        f'</a>'
        f'</body></html>'
    )
    return HttpResponse(template_ish)


def user_details_report(request):
    base_filename = 'user-details-report_{}_{}_{}.csv'.format(
        re.sub('[^a-zA-Z0-9]', '-', request.META['HTTP_HOST']),
        date.today(),
        datetime.now().microsecond,
    )
    filename = _base_filename_to_full_filename(
        base_filename, request.user.username
    )
    generate_user_details_report.delay(filename)
    template_ish = (
        f'<html><head><title>User details report</title></head>'
        f'<body>Your report is being generated. Once finished, it will be '
        f'available at <a href="{base_filename}">{base_filename}</a>.<br>'
        f'If you receive a 404, please refresh your browser periodically until '
        f'your request succeeds.'
        f'</body></html>'
    )
    return HttpResponse(template_ish)


@user_passes_test(lambda u: u.is_superuser)
def retrieve_reports(request, base_filename):
    """
    Retrieves the generated report from the storage system
    or returns a 404
    """
    filename = _base_filename_to_full_filename(
        base_filename, request.user.username)
    default_storage = get_storage_class()()
    if not default_storage.exists(filename):
        raise Http404
    # File is intentionally left open so it can be read by the streaming
    # response
    f = default_storage.open(filename)
    response = StreamingHttpResponse(f, content_type='text/csv')
    response['Content-Disposition'] = f'attachment;filename="{base_filename}"'
    return response
