# coding: utf-8
import json
import os

from django.http import Http404
from django.utils.translation import gettext as t
from rest_framework import exceptions

from kobo.apps.openrosa.apps.viewer.models.export import Export
from kobo.apps.openrosa.libs.exceptions import NoRecordsFoundError
from kobo.apps.openrosa.libs.utils.common_tags import SUBMISSION_TIME
from kobo.apps.openrosa.libs.utils.export_tools import (
    generate_export,
    newset_export_for,
    should_create_new_export,
)
from kobo.apps.openrosa.libs.utils.logger_tools import response_with_mimetype_and_name
from kobo.apps.openrosa.libs.utils.viewer_tools import format_date_for_mongo

EXPORT_EXT = {
    'xls': Export.XLS_EXPORT,
    'xlsx': Export.XLS_EXPORT,
    'csv': Export.CSV_EXPORT,
}


def _get_export_type(export_type):
    if export_type in EXPORT_EXT.keys():
        export_type = EXPORT_EXT[export_type]
    else:
        raise exceptions.ParseError(
            t("'%(export_type)s' format not known or not implemented!" %
              {'export_type': export_type})
        )

    return export_type


def _get_extension_from_export_type(export_type):
    extension = export_type

    if export_type == Export.XLS_EXPORT:
        extension = 'xlsx'

    return extension


def _set_start_end_params(request, query):

    # check for start and end params
    if 'start' in request.GET or 'end' in request.GET:
        query = json.loads(query) \
            if isinstance(query, str) else query
        query[SUBMISSION_TIME] = {}

        try:
            if request.GET.get('start'):
                query[SUBMISSION_TIME]['$gte'] = format_date_for_mongo(
                    request.GET['start']
                )

            if request.GET.get('end'):
                query[SUBMISSION_TIME]['$lte'] = format_date_for_mongo(
                    request.GET['end']
                )
        except ValueError:
            raise exceptions.ParseError(
                t('Dates must be in the format YY_MM_DD_hh_mm_ss')
            )
        else:
            query = json.dumps(query)

        return query


def _generate_new_export(request, xform, query, export_type):
    query = _set_start_end_params(request, query)
    extension = _get_extension_from_export_type(export_type)

    try:
        export = generate_export(
            export_type, extension, xform.user.username,
            xform.id_string, None, query
        )
    except NoRecordsFoundError:
        raise Http404(t('No records found to export'))
    else:
        return export


def should_regenerate_export(xform, export_type, request):
    return should_create_new_export(xform, export_type) or\
        'start' in request.GET or 'end' in request.GET or\
        'query' in request.GET


def custom_response_handler(request, xform, query, export_type):
    export_type = _get_export_type(export_type)

    # check if we need to re-generate,
    # we always re-generate if a filter is specified
    if should_regenerate_export(xform, export_type, request):
        export = _generate_new_export(request, xform, query, export_type)
    else:
        export = newset_export_for(xform, export_type)
        if not export.filename:
            # tends to happen when using newset_export_for.
            export = _generate_new_export(request, xform, query, export_type)

    # get extension from file_path, exporter could modify to
    # xlsx if it exceeds limits
    path, ext = os.path.splitext(export.filename)
    ext = ext[1:]
    id_string = None if request.GET.get('raw') else xform.id_string
    response = response_with_mimetype_and_name(
        Export.EXPORT_MIMES[ext], id_string, extension=ext,
        file_path=export.filepath)

    return response
