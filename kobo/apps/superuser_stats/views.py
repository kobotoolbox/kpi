import datetime
import re

from django.contrib.auth.decorators import user_passes_test
from django.core.files.storage import get_storage_class
from django.http import HttpResponse, StreamingHttpResponse, Http404

from .tasks import generate_user_report

def _base_filename_to_full_filename(base_filename, username):
    return '__'.join([
        username,
        base_filename
    ])

@user_passes_test(lambda u: u.is_superuser)
def user_report(request):
    base_filename = 'user-report_{}_{}_{}.csv'.format(
        re.sub('[^a-zA-Z0-9]', '-', request.META['HTTP_HOST']),
        datetime.date.today(),
        datetime.datetime.now().microsecond
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
def retrieve_user_report(request, base_filename):
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
