# coding: utf-8
import os
import logging
import traceback
import requests
import zipfile
from datetime import datetime

from tempfile import NamedTemporaryFile

from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.core.files.uploadedfile import InMemoryUploadedFile
from django.core.mail import mail_admins
from django.utils.translation import gettext as t
from ua_parser import user_agent_parser as ua_parse

from kpi.deployment_backends.kc_access.storage import (
    default_kobocat_storage as default_storage,
)

SLASH = "/"


class MyError(Exception):
    pass


class EnketoError(Exception):
    pass


def format_date_for_mongo(x):
    return datetime.strptime(x, '%y_%m_%d_%H_%M_%S').strftime(
        '%Y-%m-%dT%H:%M:%S'
    )


def get_optimized_image_path(path: str, suffix: str) -> str:
    file_name, ext = os.path.splitext(path)
    return f'{file_name}-{suffix}{ext}'


def image_urls_dict(instance):
    """
    Returns a dict of attachments with keys as base filename
    and values link through `kobocat` redirector.
    Only exposes `suffix` version of it. It will be created on the fly by the
    redirector

    :param instance: Instance
    :return: dict
    """
    urls = dict()
    for a in instance.attachments.all():
        urls[a.filename] = a.secure_url(suffix='medium')
    return urls


def report_exception(subject, info, exc_info=None):
    if exc_info:
        cls, err = exc_info[:2]
        info += t("Exception in request: %(class)s: %(error)s") \
            % {'class': cls.__name__, 'error': err}
        info += "".join(traceback.format_exception(*exc_info))

    if settings.DEBUG:
        print(subject, flush=True)
        print(info, flush=True)
    else:
        mail_admins(subject=subject, message=info)
        logging.error(info, exc_info=exc_info)


def django_file(path, field_name, content_type):
    # adapted from here: http://groups.google.com/group/django-users/browse_th\
    # read/thread/834f988876ff3c45/
    f = open(path, 'rb')
    return InMemoryUploadedFile(
        file=f,
        field_name=field_name,
        name=f.name,
        content_type=content_type,
        size=os.path.getsize(path),
        charset=None
    )


def export_def_from_filename(filename):
    # TODO fix circular import and move to top
    from kobo.apps.openrosa.apps.viewer.models.export import Export
    path, ext = os.path.splitext(filename)
    ext = ext[1:]
    # try get the def from extension
    mime_type = Export.EXPORT_MIMES[ext]
    return ext, mime_type


def get_client_ip(request):
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


def get_human_readable_client_user_agent(request):
    """
    Parse the user-agent into a human-readable <Browser> (<OS>) string
    """
    user_agent = request.META.get('HTTP_USER_AGENT', None)
    if not user_agent or user_agent == '':
        return 'No information available'
    parsed = ua_parse.Parse(user_agent)
    browser = parsed['user_agent']['family']
    user_os = parsed['os']['family']
    return f'{browser} ({user_os})'


def enketo_url(
    form_url,
    id_string,
    instance_xml=None,
    instance_id=None,
    return_url=None,
    instance_attachments=None,
    action=None,
):

    if instance_attachments is None:
        instance_attachments = {}

    url = f'{settings.ENKETO_URL}/{settings.OPENROSA_ENKETO_SURVEY_ENDPOINT}'

    values = {
        'form_id': id_string,
        'server_url': form_url
    }

    if instance_id is not None and instance_xml is not None:
        url = f'{settings.ENKETO_URL}/{settings.ENKETO_EDIT_INSTANCE_ENDPOINT}'
        values.update({
            'instance': instance_xml,
            'instance_id': instance_id,
            'return_url': return_url
        })
        for key, value in instance_attachments.items():
            values.update({
                'instance_attachments[' + key + ']': value
            })

    # The Enketo view-only endpoint differs to the edit by the addition of /view
    # as shown in the docs: https://apidocs.enketo.org/v2#/post-instance-view
    if action == 'view':
        url = f'{url}/view'

    req = requests.post(
        url, data=values, auth=(settings.ENKETO_API_KEY, ''), verify=False
    )

    if req.status_code in [200, 201]:
        try:
            response = req.json()
        except ValueError:
            pass
        else:
            if 'edit_url' in response:
                return response['edit_url']
            elif 'view_url' in response:
                return response['view_url']
            if settings.ENKETO_OFFLINE_SURVEYS and ('offline_url' in response):
                return response['offline_url']
            if 'url' in response:
                return response['url']
    else:
        try:
            response = req.json()
        except ValueError:
            pass
        else:
            if 'message' in response:
                raise EnketoError(response['message'])
    return False


def create_attachments_zipfile(attachments, output_file=None):
    if not output_file:
        output_file = NamedTemporaryFile()
    else:
        # Disable seeking in a way understood by Python's zipfile module. See
        # https://github.com/python/cpython/blob/ca2009d72a52a98bf43aafa9ad270a4fcfabfc89/Lib/zipfile.py#L1270-L1274
        # This is a workaround for https://github.com/kobotoolbox/kobocat/issues/475
        # and https://github.com/jschneier/django-storages/issues/566
        def no_seeking(*a, **kw):
            raise AttributeError(
                'Seeking disabled! See '
                'https://github.com/kobotoolbox/kobocat/issues/475'
            )
        try:
            output_file.seek = no_seeking
        except AttributeError as e:
            # The default, file-system storage won't allow changing the `seek`
            # attribute, which is fine because seeking on local files works
            # perfectly anyway
            if not isinstance(default_storage, FileSystemStorage):
                logging.warning(
                    f'{default_storage.__class__} may not be a local storage class, but '
                    f'disabling seeking failed: {e}'
                )

    with zipfile.ZipFile(
        output_file, 'w', zipfile.ZIP_STORED, allowZip64=True
    ) as zip_file:
        for attachment in attachments:
            if default_storage.exists(attachment.media_file.name):
                try:
                    with default_storage.open(
                        attachment.media_file.name, 'rb'
                    ) as source_file:
                        zip_file.writestr(
                            attachment.media_file.name, source_file.read()
                        )
                except Exception as e:
                    report_exception(
                        "Error adding file \"{}\" to archive.".format(
                            attachment.media_file.name
                        ),
                        e,
                    )

    return output_file


def _get_form_url(username):
    if settings.TESTING:
        http_host = 'http://{}'.format(settings.TEST_HTTP_HOST)
        username = settings.TEST_USERNAME
    else:
        # Always use a public url to prevent Enketo SSRF from blocking request
        http_host = settings.KOBOCAT_URL

    # Internal requests use the public url, KOBOCAT_URL already has the protocol
    return '{http_host}/{username}'.format(
        http_host=http_host,
        username=username
    )


def get_enketo_submission_url(request, instance, return_url, action=None):
    form_url = _get_form_url(instance.xform.user.username)
    instance_attachments = image_urls_dict(instance)
    url = enketo_url(
        form_url, instance.xform.id_string, instance_xml=instance.xml,
        instance_id=instance.uuid, return_url=return_url,
        instance_attachments=instance_attachments, action=action)
    return url
