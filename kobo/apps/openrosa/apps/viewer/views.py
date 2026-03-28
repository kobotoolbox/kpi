# coding: utf-8
import json
import os

from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.http import (
    HttpResponse,
    HttpResponseBadRequest,
    HttpResponseForbidden,
    HttpResponseRedirect,
)
from django.shortcuts import get_object_or_404, render
from django.urls import resolve, reverse
from django.utils.translation import gettext as t
from django.views.decorators.clickjacking import xframe_options_exempt
from django.views.decorators.http import require_POST

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models import Attachment, XForm
from kobo.apps.openrosa.apps.viewer.models.export import Export
from kobo.apps.openrosa.apps.viewer.tasks import create_async_export
from kobo.apps.openrosa.libs.authentication import digest_authentication
from kobo.apps.openrosa.libs.utils.logger_tools import response_with_mimetype_and_name
from kobo.apps.openrosa.libs.utils.user_auth import has_permission, helper_auth_helper
from kobo.apps.openrosa.libs.utils.viewer_tools import export_def_from_filename
from kpi.deployment_backends.kc_access.storage import (
    default_kobocat_storage as default_storage,
)
from kpi.utils.storage import is_filesystem_storage
from kpi.views.v2.attachment import AttachmentViewSet


@login_required
@require_POST
@xframe_options_exempt
def create_export(request, username, id_string, export_type):
    owner = get_object_or_404(User, username__iexact=username)
    xform = get_object_or_404(XForm, id_string__exact=id_string, user=owner)
    if not has_permission(xform, owner, request):
        return HttpResponseForbidden(t('Not shared.'))

    query = request.POST.get('query')
    force_xlsx = request.POST.get('xls') != 'true'

    # export options
    group_delimiter = request.POST.get('options[group_delimiter]', '/')
    if group_delimiter not in ['.', '/']:
        return HttpResponseBadRequest(
            t('%s is not a valid delimiter' % group_delimiter)
        )

    # default is True, so when dont_.. is yes
    # split_select_multiples becomes False
    split_select_multiples = (
        request.POST.get('options[dont_split_select_multiples]', 'no') == 'no'
    )

    binary_select_multiples = getattr(settings, 'BINARY_SELECT_MULTIPLES',
                                      False)
    options = {
        'group_delimiter': group_delimiter,
        'split_select_multiples': split_select_multiples,
        'binary_select_multiples': binary_select_multiples,
    }

    try:
        create_async_export(xform, export_type, query, force_xlsx, options)
    except Export.ExportTypeError:
        return HttpResponseBadRequest(t('%s is not a valid export type' % export_type))
    else:
        return HttpResponseRedirect(
            reverse(
                export_list,
                kwargs={
                    'username': username,
                    'id_string': id_string,
                    'export_type': export_type,
                },
            )
        )


@xframe_options_exempt
def export_list(request, username, id_string, export_type):
    try:
        Export.EXPORT_TYPE_DICT[export_type]
    except KeyError:
        return HttpResponseBadRequest(t('Invalid export type'))

    owner = get_object_or_404(User, username__iexact=username)
    xform = get_object_or_404(XForm, id_string__exact=id_string, user=owner)
    if not has_permission(xform, owner, request):
        return HttpResponseForbidden(t('Not shared.'))

    data = {
        'username': owner.username,
        'xform': xform,
        'export_type': export_type,
        'export_type_name': Export.EXPORT_TYPE_DICT[export_type],
        'exports': Export.objects.filter(
            xform=xform, export_type=export_type).order_by('-created_on')
    }

    return render(request, 'export_list.html', data)


@xframe_options_exempt
def export_progress(request, username, id_string, export_type):
    owner = get_object_or_404(User, username__iexact=username)
    xform = get_object_or_404(XForm, id_string__exact=id_string, user=owner)
    if not has_permission(xform, owner, request):
        return HttpResponseForbidden(t('Not shared.'))

    # find the export entry in the db
    export_ids = request.GET.getlist('export_ids')
    exports = Export.objects.filter(xform=xform, id__in=export_ids)
    statuses = []
    for export in exports:
        status = {
            'complete': False,
            'url': None,
            'filename': None,
            'export_id': export.id
        }

        if export.status == Export.SUCCESSFUL:
            status['url'] = reverse(export_download, kwargs={
                'username': owner.username,
                'id_string': xform.id_string,
                'export_type': export.export_type,
                'filename': export.filename
            })
            status['filename'] = export.filename

        # mark as complete if it either failed or succeeded but NOT pending
        if export.status == Export.SUCCESSFUL or export.status == Export.FAILED:
            status['complete'] = True
        statuses.append(status)

    return HttpResponse(
        json.dumps(statuses), content_type='application/json')


@xframe_options_exempt
def export_download(request, username, id_string, export_type, filename):

    helper_auth_helper(request)

    owner = get_object_or_404(User, username__iexact=username)
    xform = get_object_or_404(XForm, id_string__exact=id_string, user=owner)

    if not has_permission(xform, owner, request):
        return HttpResponseForbidden(t('Not shared.'))

    # find the export entry in the db
    export = get_object_or_404(Export, xform=xform, filename=filename)

    ext, mime_type = export_def_from_filename(export.filename)

    if not is_filesystem_storage(default_storage):
        return HttpResponseRedirect(default_storage.url(export.filepath))

    basename = os.path.splitext(export.filename)[0]
    response = response_with_mimetype_and_name(
        mime_type,
        name=basename,
        extension=ext,
        file_path=export.filepath,
        show_date=False,
    )
    return response


@login_required
@require_POST
@xframe_options_exempt
def delete_export(request, username, id_string, export_type):
    owner = get_object_or_404(User, username__iexact=username)
    xform = get_object_or_404(XForm, id_string__exact=id_string, user=owner)
    if not has_permission(xform, owner, request):
        return HttpResponseForbidden(t('Not shared.'))

    export_id = request.POST.get('export_id')

    # find the export entry in the db
    export = get_object_or_404(Export, id=export_id)
    export.delete()

    return HttpResponseRedirect(
        reverse(
            export_list,
            kwargs={
                'username': username,
                'id_string': id_string,
                'export_type': export_type,
            },
        )
    )


def briefcase_attachment_url(request, att_uid):
    """
    Serves attachment files for ODK Briefcase clients.

    Handles Digest authentication and delegates file serving to the KPI v2
    AttachmentViewSet. Lookup by UID is stable after project transfers,
    unlike the legacy path-based lookup.
    """
    attachment = get_object_or_404(Attachment, uid=att_uid)
    xform = attachment.xform

    helper_auth_helper(request)

    if not request.user.is_superuser and not has_permission(xform, xform.user, request):
        if request.user.is_anonymous:
            if digest_response := digest_authentication(request):
                return digest_response
        return HttpResponseForbidden(t('Not shared.'))

    internal_url = reverse(
        'api_v2:attachment-detail',
        kwargs={
            'uid_asset': xform.kpi_asset_uid,
            'uid_data': str(attachment.instance.pk),
            'pk': attachment.uid,
        },
    )
    resolver_match = resolve(internal_url)
    view = AttachmentViewSet.as_view({'get': 'retrieve'})
    return view(request=request, **resolver_match.kwargs)
