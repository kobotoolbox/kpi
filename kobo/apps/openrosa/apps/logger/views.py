# coding: utf-8
import json
import os
import tempfile

from django.contrib.auth.decorators import login_required
from django.http import (
    HttpResponse,
    HttpResponseBadRequest,
    HttpResponseForbidden,
    HttpResponseNotFound,
    HttpResponseRedirect,
    StreamingHttpResponse,
)
from django.shortcuts import get_object_or_404
from django.shortcuts import render
from django.template import loader
from django.utils.translation import gettext as t
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_exempt

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa import koboform
from kobo.apps.openrosa.apps.logger.import_tools import import_instances_from_zip
from kobo.apps.openrosa.apps.logger.models.xform import XForm
from kobo.apps.openrosa.libs.utils.logger_tools import BaseOpenRosaResponse
from kobo.apps.openrosa.libs.utils.logger_tools import (
    response_with_mimetype_and_name,
)
from kobo.apps.openrosa.libs.utils.user_auth import (
    helper_auth_helper,
    has_permission,
    add_cors_headers,
)
from kpi.deployment_backends.kc_access.storage import (
    default_kobocat_storage as default_storage,
)
from ...koboform.pyxform_utils import convert_csv_to_xls

IO_ERROR_STRINGS = [
    'request data read error',
    'error during read(65536) on wsgi.input'
]


def _bad_request(e):
    strerror = str(e)

    return strerror and strerror in IO_ERROR_STRINGS


def _extract_uuid(text):
    text = text[text.find("@key="):-1].replace("@key=", "")
    if text.startswith("uuid:"):
        text = text.replace("uuid:", "")
    return text


def _parse_int(num):
    try:
        return num and int(num)
    except ValueError:
        pass


def _submission_response(request, instance):
    data = {
        'message': t("Successful submission."),
        'formid': instance.xform.id_string,
        'encrypted': instance.xform.encrypted,
        'instanceID': f'uuid:{instance.uuid}',
        'submissionDate': instance.date_created.isoformat(),
        'markedAsCompleteDate': instance.date_modified.isoformat()
    }

    template_ = loader.get_template('submission.xml')

    return BaseOpenRosaResponse(template_.render(data, request=request))


@require_POST
@csrf_exempt
def bulksubmission(request, username):
    # puts it in a temp directory.
    # runs "import_tools(temp_directory)"
    # deletes
    posting_user = get_object_or_404(User, username__iexact=username)

    # request.FILES is a django.utils.datastructures.MultiValueDict
    # for each key we have a list of values
    try:
        temp_postfile = request.FILES.pop("zip_submission_file", [])
    except IOError:
        return HttpResponseBadRequest(t("There was a problem receiving your "
                                        "ODK submission. [Error: IO Error "
                                        "reading data]"))
    if len(temp_postfile) != 1:
        return HttpResponseBadRequest(t("There was a problem receiving your"
                                        " ODK submission. [Error: multiple "
                                        "submission files (?)]"))

    postfile = temp_postfile[0]
    tempdir = tempfile.gettempdir()
    our_tfpath = os.path.join(tempdir, postfile.name)

    with open(our_tfpath, 'wb') as f:
        f.write(postfile.read())

    with open(our_tfpath, 'rb') as f:
        total_count, success_count, errors = import_instances_from_zip(
            f, posting_user)
    # chose the try approach as suggested by the link below
    # http://stackoverflow.com/questions/82831
    try:
        os.remove(our_tfpath)
    except IOError:
        # TODO: log this Exception somewhere
        pass
    json_msg = {
        'message': t("Submission complete. Out of %(total)d "
                     "survey instances, %(success)d were imported, "
                     "(%(rejected)d were rejected as duplicates, "
                     "missing forms, etc.)") %
        {'total': total_count, 'success': success_count,
         'rejected': total_count - success_count},
        'errors': "%d %s" % (len(errors), errors)
    }
    response = HttpResponse(json.dumps(json_msg))
    response.status_code = 200
    response['Location'] = request.build_absolute_uri(request.path)
    return response


@login_required
def bulksubmission_form(request, username=None):
    username = username if username is None else username.lower()
    if request.user.username == username:
        return render(request, 'bulk_submission_form.html')
    else:
        return HttpResponseRedirect('/%s' % request.user.username)


def download_xlsform(request, username, id_string):

    helper_auth_helper(request)
    if request.user.is_anonymous:
        return HttpResponseRedirect(koboform.login_url())

    xform = get_object_or_404(
        XForm, user__username__iexact=username, id_string__exact=id_string
    )
    owner = User.objects.get(username__iexact=username)

    if not has_permission(xform, owner, request, xform.shared):
        return HttpResponseForbidden('Not shared.')

    file_path = xform.xls.name

    if file_path != '' and default_storage.exists(file_path):
        if file_path.endswith('.csv'):
            with default_storage.open(file_path) as ff:
                xls_io = convert_csv_to_xls(ff.read())
                response = StreamingHttpResponse(
                    xls_io,
                    content_type='application/vnd.ms-excel; charset=utf-8',
                )
                response['Content-Disposition'] = (
                    'attachment; filename=%s.xls' % xform.id_string
                )
                return response

        split_path = file_path.split(os.extsep)
        extension = 'xls'

        if len(split_path) > 1:
            extension = split_path[len(split_path) - 1]

        response = response_with_mimetype_and_name(
            'vnd.ms-excel',
            id_string,
            show_date=False,
            extension=extension,
            file_path=file_path,
        )

        return response

    else:
        return HttpResponseNotFound(
            t('No XLS file for your form %(id)s') % {'id': id_string}
        )


def download_jsonform(request, username, id_string):

    helper_auth_helper(request)

    owner = get_object_or_404(User, username__iexact=username)
    xform = get_object_or_404(
        XForm, user__username__iexact=username, id_string__exact=id_string
    )
    if request.method == 'OPTIONS':
        response = HttpResponse()
        add_cors_headers(response)
        return response

    if not has_permission(xform, owner, request, xform.shared):
        response = HttpResponseForbidden(t('Not shared.'))
        add_cors_headers(response)
        return response
    response = response_with_mimetype_and_name(
        'json', id_string, show_date=False
    )
    if 'callback' in request.GET and request.GET.get('callback') != '':
        callback = request.GET.get('callback')
        response.content = "%s(%s)" % (callback, xform.json)
    else:
        add_cors_headers(response)
        response.content = xform.json
    return response
