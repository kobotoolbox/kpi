# coding: utf-8
import csv
import io
import json
import uuid
from datetime import datetime
from typing import TextIO, Union

from kobo.apps.openrosa.apps.logger.models import Instance
from kobo.apps.openrosa.libs.utils.logger_tools import (
    dict2xml,
    safe_create_instance,
)


def get_submission_meta_dict(xform, instance_id):
    """Generates metadata for our submission

    Checks if `instance_id` belongs to an existing submission.
    If it does, it's considered an edit and its uuid gets deprecated.
    In either case, a new one is generated and assigned.

    :param kobo.apps.openrosa.apps.logger.models.XForm xform: The submission's XForm.
    :param string instance_id: The submission/instance `uuid`.

    :return: The metadata dict
    :rtype:  dict
    """
    uuid_arg = 'uuid:{}'.format(uuid.uuid4())
    meta = {'instanceID': uuid_arg}

    update = 0

    if xform.instances.filter(uuid=instance_id).count() > 0:
        uuid_arg = 'uuid:{}'.format(uuid.uuid4())
        meta.update({'instanceID': uuid_arg,
                     'deprecatedID': 'uuid:{}'.format(instance_id)})
        update += 1
    return [meta, update]


def dict2xmlsubmission(submission_dict, xform, instance_id, submission_date):
    """Creates and xml submission from an appropriate dict (& other data)

    :param dict submission_dict: A dict containing form submission data.
    :param kobo.apps.openrosa.apps.logger.models.XForm xfrom: The submission's XForm.
    :param string instance_id: The submission/instance `uuid`.
    :param string submission_date: An isoformatted datetime string.

    :return: An xml submission string
    :rtype: string
    """
    return ('<?xml version="1.0" ?>'
            '<{0} id="{1}" instanceID="uuid:{2}" submissionDate="{3}" '
            'xmlns="http://opendatakit.org/submissions">{4}'
            '</{0}>'.format(
                json.loads(xform.json).get('name', xform.id_string),
                xform.id_string, instance_id, submission_date,
                dict2xml(submission_dict).replace('\n', '')))


def submit_csv(
    request: 'django.http.HttpRequest',
    xform: 'kobo.apps.openrosa.apps.logger.models.XForm',
    csv_file: Union[str, TextIO],
) -> dict:
    """
    Imports CSV data to an existing form

    Takes a csv formatted file or string containing rows of submission/instance
    and converts those to xml submissions and finally submits them by calling
    :py:func:`kobo.apps.openrosa.libs.utils.logger_tools.safe_create_instance`

    """

    if hasattr(csv_file, 'readable'):
        csv_file = io.TextIOWrapper(csv_file, encoding='utf-8')

    if isinstance(csv_file, str):
        csv_file = io.StringIO(csv_file)
    elif csv_file is None or not hasattr(csv_file, 'read'):
        return {
            'error': (
                'Invalid param type for `csv_file`. '
                'Expected file or String '
                'got {} instead.'.format(type(csv_file).__name__)
            )
        }

    csv_reader = csv.DictReader(csv_file)
    rollback_uuids = []
    submission_time = datetime.utcnow().isoformat()
    ona_uuid = {'formhub': {'uuid': xform.uuid}}
    error = None
    additions = inserts = 0
    for row in csv_reader:
        # fetch submission uuid before purging row metadata
        row_uuid = row.get('_uuid')
        submission_date = row.get('_submission_time', submission_time)

        row_iter = dict(row)
        for key in row_iter:  # seems faster than a comprehension
            # remove metadata (keys starting with '_')
            if key.startswith('_'):
                del row[key]
            # process nested data e.g x[formhub/uuid] => x[formhub][uuid]
            if r'/' in key:
                p, c = key.split('/')
                row[p] = {c: row[key]}
                del row[key]

        # inject our form's uuid into the submission
        row.update(ona_uuid)

        old_meta = row.get('meta', {})
        new_meta, update = get_submission_meta_dict(xform, row_uuid)
        inserts += update
        old_meta.update(new_meta)
        row.update({'meta': old_meta})

        row_uuid = row.get('meta').get('instanceID')
        rollback_uuids.append(row_uuid.replace('uuid:', ''))

        xml_file = io.StringIO(
            dict2xmlsubmission(row, xform, row_uuid, submission_date))

        try:
            error, instance = safe_create_instance(
                request.user.username, xml_file, [], xform.uuid, request
            )
        except ValueError as e:
            error = e

        if error:
            Instance.objects.filter(uuid__in=rollback_uuids,
                                    xform=xform).delete()
            return {'error': str(error)}
        else:
            additions += 1

    return {'additions': additions - inserts, 'updates': inserts}
