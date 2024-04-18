# coding: utf-8
import re
from datetime import datetime, date

from django.contrib.auth.decorators import user_passes_test
from django.core.files.storage import default_storage
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
    first_of_month = today.replace(day=1)
    base_filename = 'country-report_{}_{}_{}.csv'.format(
        re.sub('[^a-zA-Z0-9]', '-', request.META['HTTP_HOST']),
        today,
        datetime.now().microsecond
    )

    # Get the date filters from the query and set defaults
    if not (start_date := request.GET.get('start_date')):
        start_date = str(first_of_month)

    if not (end_date := request.GET.get('end_date')):
        end_date = str(today)

    # Generate the CSV file
    filename = _base_filename_to_full_filename(
        base_filename, request.user.username)
    generate_country_report.delay(filename, start_date, end_date)

    url = f"{KOBOFORM_URL}{reverse('superuser_stats:countries_report')}"
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
        f'<a href="{url}?start_date={first_of_month}&end_date={today}">'
        f'  {url}?start_date={first_of_month}&end_date={today}'
        f'</a>'
        f'<p>Range is <b>inclusive</b>.</p>'
        f'<p>The default range is current month: {today.strftime("%B %Y")}.</p>'
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
    if not (end_date := request.GET.get('end_date')):
        end_date = str(today)

    # Generate the CSV file
    filename = _base_filename_to_full_filename(
        base_filename, request.user.username)
    generate_continued_usage_report.delay(filename, end_date)

    url = f"{KOBOFORM_URL}{reverse('superuser_stats:continued_usage_report')}"
    template_ish = (
        f'<html><head><title>Continued usage report</title></head>'
        f'<body>Your report is being generated. Once finished, it will be '
        f'available at <a href="{base_filename}">{base_filename}</a>.<br>'
        f'If you receive a 404, please refresh your browser periodically until '
        f'your request succeeds.<br><br>'
        f'To select an end date, add a <code style="background: lightgray">?</code> at the end of the URL and set the '
        f'<code style="background: lightgray">end_date</code> parameter to <code style="background: lightgray">YYYY-MM-DD</code>.<br><br>'
        f'<b>Example:</b><br>'
        f'<a href="{url}?end_date={today}">'
        f'  {url}?end_date={today}'
        f'</a>'
        f'<p>The default end date is {today}.</p>'
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
    first_of_month = today.replace(day=1)
    base_filename = 'domain-report_{}_{}_{}.csv'.format(
        re.sub('[^a-zA-Z0-9]', '-', request.META['HTTP_HOST']),
        today,
        timezone.now().microsecond
    )

    # Get the date filters from the query and set defaults
    if not (start_date := request.GET.get('start_date')):
        start_date = str(first_of_month)

    if not (end_date := request.GET.get('end_date')):
        end_date = str(today)

    # Generate the CSV file
    filename = _base_filename_to_full_filename(
        base_filename, request.user.username)

    generate_domain_report.delay(filename, start_date, end_date)

    # Generate page text
    url = f"{KOBOFORM_URL}{reverse('superuser_stats:domains_report')}"
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
        f'<a href="{url}?start_date={first_of_month}&end_date={today}">'
        f'  {url}?start_date={first_of_month}&end_date={today}'
        f'</a>'
        f'<p>Range is <b>inclusive</b>.</p>'
        f'<p>The default range is current month: {today.strftime("%B %Y")}.</p>'
        f'<p>Submissions count will be 0 unless the range includes first of the month.</p>'
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
        f'<html><head><title>Media storage report</title></head>'
        f'<body>Your report is being generated. Once finished, it will be '
        f'available at <a href="{base_filename}">{base_filename}</a>.<br>'
        f'If you receive a 404, please refresh your browser periodically until '
        f'your request succeeds.'
        f'</body></html>'
    ).format(base_filename)
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
        f'<html><head><title>Users by organization report</title></head>'
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
        f'<html><head><title>Users report</title></head>'
        f'<body>Your report is being generated. Once finished, it will be '
        f'available at <a href="{base_filename}">{base_filename}</a>.<br>'
        f'If you receive a 404, please refresh your browser periodically until '
        f'your request succeeds.'
        f'</body></html>'
    )
    return HttpResponse(template_ish)


@user_passes_test(lambda u: u.is_superuser)
def user_statistics_report(request):
    """
    View for the User Statistics Report
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
    first_of_month = today.replace(day=1)
    if start_month := request.GET.get('start_month'):
        start_date = f'{start_month}-1'
    else:
        start_date = str(first_of_month)
        start_month = first_of_month.strftime('%Y-%m')

    if end_month := request.GET.get('end_month'):
        end_date = f'{end_month}-01'
    else:
        end_date = str(first_of_month)
        end_month = first_of_month.strftime('%Y-%m')

    # Generate the CSV file
    filename = _base_filename_to_full_filename(
        base_filename, request.user.username)
    generate_user_statistics_report.delay(filename, start_date, end_date)

    url = f"{KOBOFORM_URL}{reverse('superuser_stats:user_statistics_report')}"
    template_ish = (
        f'<html><head><title>User statistics report</title></head>'
        f'<body>Your report is being generated. Once finished, it will be '
        f'available at <a href="{base_filename}">{base_filename}</a>.<br>If you '
        f'receive a 404, please refresh your browser periodically until your '
        f'request succeeds.<br><br>'
        f'To select a date range, add a <code style="background: lightgray">?</code> at the end of the URL and set the '
        f'<code style="background: lightgray">start_month</code> parameter to <code style="background: lightgray">YYYY-MM</code> and/or the '
        f'<code style="background: lightgray">end_month</code> parameter to <code style="background: lightgray">YYYY-MM</code>.<br><br>'
        f'<b>Example:</b><br>'
        f'<a href="{url}?start_month={start_month}&end_month={end_month}">'
        f'  {url}?start_month={start_month}&end_month={end_month}'
        f'</a>'
        f'<p>Range is <b>inclusive</b>.</p>'
        f'<p>The default range is current month: {today.strftime("%B %Y")}.</p>'
        f'</body></html>'
    )
    return HttpResponse(template_ish)


@user_passes_test(lambda u: u.is_superuser)
def user_details_report(request):

    # Get the date filters from the query and set defaults
    today = timezone.now().date()
    first_of_month = today.replace(day=1)
    if not (start_date := request.GET.get('start_date')):
        start_date = str(first_of_month)

    if not (end_date := request.GET.get('end_date')):
        end_date = str(today)

    base_filename = 'user-details-report_{}_{}_{}.csv'.format(
        re.sub('[^a-zA-Z0-9]', '-', request.META['HTTP_HOST']),
        date.today(),
        datetime.now().microsecond,
    )
    filename = _base_filename_to_full_filename(
        base_filename, request.user.username
    )
    url = f"{KOBOFORM_URL}{reverse('superuser_stats:user_details_report')}"
    generate_user_details_report.delay(filename, start_date, end_date)
    template_ish = (
        f'<html><head><title>User details report</title></head>'
        f'<body>Your report is being generated. Once finished, it will be '
        f'available at <a href="{base_filename}">{base_filename}</a>.<br>'
        f'If you receive a 404, please refresh your browser periodically until '
        f'your request succeeds.<br><br>'
        f'To select a date range based on the user\'s date joined, add a <code style="background: lightgray">?</code> at the end of the URL and set the '
        f'<code style="background: lightgray">start_date</code> parameter to <code style="background: lightgray">YYYY-MM-DD</code> and/or the '
        f'<code style="background: lightgray">end_date</code> parameter to <code style="background: lightgray">YYYY-MM-DD</code>.<br><br>'
        f'<b>Example:</b><br>'
        f'<a href="{url}?start_date={first_of_month}&end_date={today}">'
        f'  {url}?start_date={first_of_month}&end_date={today}'
        f'</a>'
        f'<p>Range is <b>inclusive</b>.</p>'
        f'<p>The default range is current month: {today.strftime("%B %Y")}.</p>'
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
    if not default_storage.exists(filename):
        raise Http404
    # File is intentionally left open so it can be read by the streaming
    # response
    f = default_storage.open(filename)
    response = StreamingHttpResponse(f, content_type='text/csv')
    response['Content-Disposition'] = f'attachment;filename="{base_filename}"'
    return response
