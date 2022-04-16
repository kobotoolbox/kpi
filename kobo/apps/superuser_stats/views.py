# coding: utf-8
import re
from datetime import datetime, date, timedelta

from django.contrib.auth.decorators import user_passes_test
from django.core.files.storage import get_storage_class
from django.http import HttpResponse, StreamingHttpResponse, Http404
from django.urls import reverse

from .tasks import (
    generate_country_report,
    generate_continued_usage_report,
    generate_domain_report,
    generate_forms_count_by_submission_range,
    generate_media_storage_report,
    generate_user_count_by_organization,
    generate_user_report,
    generate_user_statistics_report,
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
    base_filename = 'country-report_{}_{}_{}.csv'.format(
        re.sub('[^a-zA-Z0-9]', '-', request.META['HTTP_HOST']),
        date.today(),
        datetime.now().microsecond
    )

    # Get the date date filters from the query and set defaults
    start_date = request.GET.get('start_date', date.today())
    tomorrow = date.today() + timedelta(days=1)
    end_date = request.GET.get('end_date', tomorrow)

    # Generate the CSV file
    filename = _base_filename_to_full_filename(
        base_filename, request.user.username)
    generate_country_report.delay(filename, start_date, end_date)

    template_ish = (
        '<html><head><title>Hello, superuser.</title></head>'
        '<body>Your report is being generated. Once finished, it will be '
        'available at <a href="{0}">{0}</a>. If you receive a 404, please '
        'refresh your browser periodically until your request succeeds.<br><br>'
        'To select a date range, add a ? at the end of the URL and set the '
        'start_date parameter to YYYY-MM-DD and/or the end_date parameter to '
        'YYYY-MM-DD. Example:<br>'
        'https://{{ kpi_base_url }}/superuser_stats/country_report/?start_date'
        '=2020-01-31&end_date=2021-02-28'
        '</body></html>'
    ).format(base_filename)

    return HttpResponse(template_ish)


@user_passes_test(lambda u: u.is_superuser)
def continued_usage_report(request):
    """
    Tracks users usage over a given year with the last day being set by
    'end_date'
    """
    base_filename = 'continued-usage-report_{}_{}_{}.csv'.format(
        re.sub('[^a-zA-Z0-9]', '-', request.META['HTTP_HOST']),
        date.today(),
        datetime.now().microsecond
    )

    # Get the date filters from the query and set defaults
    tomorrow = date.today() + timedelta(days=1)
    end_date = request.GET.get('end_date', tomorrow)

    # Generate the CSV file
    filename = _base_filename_to_full_filename(
        base_filename, request.user.username)
    generate_continued_usage_report.delay(filename, end_date)

    template_ish = (
        '<html><head><title>Hello, superuser.</title></head>'
        '<body>Your report is being generated. Once finished, it will be '
        'available at <a href="{0}">{0}</a>. If you receive a 404, please '
        'refresh your browser periodically until your request succeeds.<br><br>'
        'To select a date range, add a ? at the end of the URL and set the '
        'the end_date parameter to YYYY-MM-DD. Example:<br>'
        'https://{{ kpi_base_url }}/superuser_stats/continued_usage_report/?'
        'end_date=2021-02-28<br>'
        ''
        '</body></html>'
    ).format(base_filename)

    return HttpResponse(template_ish)


@user_passes_test(lambda u: u.is_superuser)
def domain_report(request):
    """
    Generates a report which counts the amount of users
    with the same email address domain
    """
    # Generate the file basename
    base_filename = 'domain-report_{}_{}_{}.csv'.format(
        re.sub('[^a-zA-Z0-9]', '-', request.META['HTTP_HOST']),
        date.today(),
        datetime.now().microsecond
    )

    # Get the date filters from the query and set defaults
    start_date = request.GET.get('start_date', date.today())
    tomorrow = date.today() + timedelta(days=1)
    end_date = request.GET.get('end_date', tomorrow)

    # Generate the CSV file
    filename = _base_filename_to_full_filename(
        base_filename, request.user.username)
    generate_domain_report.delay(filename, start_date, end_date)

    # Generate page text
    template_ish = (
        '<html><head><title>Hello, superuser.</title></head>'
        '<body>Your report is being generated. Once finished, it will be '
        'available at <a href="{0}">{0}</a>. If you receive a 404, please '
        'refresh your browser periodically until your request succeeds.<br><br>'
        'To select a date range, add a ? at the end of the URL and set the '
        'start_date parameter to YYYY-MM-DD and/or the end_date parameter to '
        'YYYY-MM-DD. Example:<br>'
        'https://{{ kpi_base_url }}/superuser_stats/domain_report/?start_date'
        '=2020-01-31&end_date=2021-02-28<br><br>'
        'The default date range is for today, but submissions count will not be'
        ' 0 unless it includes the range includes first of the month'
        '</body></html>'
    ).format(base_filename)

    return HttpResponse(template_ish)


@user_passes_test(lambda u: u.is_superuser)
def forms_count_by_submission_report(request):
    """
    generates a report counting the number of forms within a
    submission range
    """
    base_filename = 'form-count-by-submissions-count-report_{}_{}_{}.csv'.format(
        re.sub('[^a-zA-Z0-9]', '-', request.META['HTTP_HOST']),
        date.today(),
        datetime.now().microsecond
    )
    filename = _base_filename_to_full_filename(
        base_filename, request.user.username)
    generate_forms_count_by_submission_range.delay(filename)
    template_ish = (
        '<html><head><title>Hello, superuser.</title></head>'
        '<body>Your report is being generated. Once finished, it will be '
        'available at <a href="{0}">{0}</a>. If you receive a 404, please '
        'refresh your browser periodically until your request succeeds.'
        '</body></html>'
    ).format(base_filename)
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
        'available at <a href="{0}">{0}</a>. If you receive a 404, please '
        'refresh your browser periodically until your request succeeds.'
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
        '<a href="{8}">{8}</a><br>'
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
        '<html><head><title>Hello, superuser.</title></head>'
        '<body>Your report is being generated. Once finished, it will be '
        'available at <a href="{0}">{0}</a>. If you receive a 404, please '
        'refresh your browser periodically until your request succeeds.'
        '</body></html>'
    ).format(base_filename)

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
        '<html><head><title>Hello, superuser.</title></head>'
        '<body>Your report is being generated. Once finished, it will be '
        'available at <a href="{0}">{0}</a>. If you receive a 404, please '
        'refresh your browser periodically until your request succeeds.'
        '</body></html>'
    ).format(base_filename)
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
    start_date = request.GET.get('start_date', date.today())
    tomorrow = date.today() + timedelta(days=1)
    end_date = request.GET.get('end_date', tomorrow)

    # Generate the CSV file
    filename = _base_filename_to_full_filename(
        base_filename, request.user.username)
    generate_user_statistics_report.delay(filename, start_date, end_date)

    template_ish = (
        '<html><head><title>Hello, superuser.</title></head>'
        '<body>Your report is being generated. Once finished, it will be '
        'available at <a href="{0}">{0}</a>. If you receive a 404, please '
        'refresh your browser periodically until your request succeeds.<br><br>'
        'To select a date range, add a ? at the end of the URL and set the '
        'start_date parameter to YYYY-MM-DD and/or the end_date parameter to '
        'YYYY-MM-DD. Example:<br>'
        'https://{{ kpi_base_url }}/superuser_stats/user_statistics/?start_date'
        '=2020-01-31&end_date=2021-02-28'
        '</body></html>'
    ).format(base_filename)

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
    response['Content-Disposition'] = 'attachment;filename="{}"'.format(
        base_filename)
    return response
