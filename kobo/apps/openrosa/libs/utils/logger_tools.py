from __future__ import annotations

import contextlib
import hashlib
import logging
import os
import re
import sys
import traceback
from contextlib import contextmanager
from datetime import date, datetime, timezone
from typing import Generator, Optional, Union
from wsgiref.util import FileWrapper
from xml.dom import Node
from xml.etree import ElementTree as ET
from xml.parsers.expat import ExpatError
from zoneinfo import ZoneInfo

from dict2xml import dict2xml
from django.conf import settings
from django.core.exceptions import PermissionDenied, ValidationError
from django.core.files.base import File
from django.core.mail import mail_admins
from django.db import IntegrityError, connection, transaction
from django.db.models import Q
from django.http import (
    Http404,
    HttpResponse,
    HttpResponseNotFound,
    StreamingHttpResponse,
)
from django.shortcuts import get_object_or_404
from django.utils import timezone as dj_timezone
from django.utils.encoding import DjangoUnicodeDecodeError, smart_str
from django.utils.translation import gettext as t
from modilabs.utils.subprocess_timeout import ProcessTimedOut
from pyxform.errors import PyXFormError
from pyxform.xform2json import create_survey_element_from_xml
from rest_framework.exceptions import NotAuthenticated

from kobo.apps.openrosa.apps.logger.exceptions import (
    AccountInactiveError,
    ConflictingAttachmentBasenameError,
    ConflictingSubmissionUUIDError,
    DuplicateInstanceError,
    DuplicateUUIDError,
    ExceededUsageLimitError,
    FormInactiveError,
    InstanceEmptyError,
    InstanceIdMissingError,
    InstanceInvalidUserError,
    InstanceMultipleNodeError,
    LockedSubmissionError,
    TemporarilyUnavailableError,
)
from kobo.apps.openrosa.apps.logger.models import Attachment, Instance, XForm
from kobo.apps.openrosa.apps.logger.models.attachment import AttachmentDeleteStatus
from kobo.apps.openrosa.apps.logger.models.instance import (
    InstanceHistory,
    get_id_string_from_xml_str,
)
from kobo.apps.openrosa.apps.logger.models.xform import XLSFormError
from kobo.apps.openrosa.apps.logger.signals import (
    update_xform_daily_counter,
    update_xform_monthly_counter,
    update_xform_submission_count,
)
from kobo.apps.openrosa.apps.logger.utils.counters import update_storage_counters
from kobo.apps.openrosa.apps.logger.xform_instance_parser import (
    XFormInstanceParser,
    clean_and_parse_xml,
    get_abbreviated_xpath,
    get_deprecated_uuid_from_xml,
    get_root_uuid_from_xml,
    get_submission_date_from_xml,
    get_uuid_from_xml,
    get_xform_media_question_xpaths,
)
from kobo.apps.openrosa.apps.viewer.models.data_dictionary import DataDictionary
from kobo.apps.openrosa.apps.viewer.models.parsed_instance import ParsedInstance
from kobo.apps.openrosa.libs.utils import common_tags
from kobo.apps.openrosa.libs.utils.model_tools import queryset_iterator, set_uuid
from kobo.apps.openrosa.libs.utils.viewer_tools import get_mongo_userform_id
from kobo.apps.organizations.constants import UsageType
from kpi.deployment_backends.kc_access.storage import (
    default_kobocat_storage as default_storage,
)
from kpi.deployment_backends.kc_access.utils import kc_transaction_atomic
from kpi.utils.hash import calculate_hash
from kpi.utils.mongo_helper import MongoHelper
from kpi.utils.object_permission import get_database_user
from kpi.utils.usage_calculator import ServiceUsageCalculator

OPEN_ROSA_VERSION_HEADER = 'X-OpenRosa-Version'
HTTP_OPEN_ROSA_VERSION_HEADER = 'HTTP_X_OPENROSA_VERSION'
OPEN_ROSA_VERSION = '1.0'
DEFAULT_CONTENT_TYPE = 'text/xml; charset=utf-8'
DEFAULT_CONTENT_LENGTH = settings.OPENROSA_DEFAULT_CONTENT_LENGTH

uuid_regex = re.compile(r'<formhub>\s*<uuid>\s*([^<]+)\s*</uuid>\s*</formhub>',
                        re.DOTALL)

mongo_instances = settings.MONGO_DB.instances


def check_submission_permissions(
    request: 'rest_framework.request.Request', xform: XForm
):
    """
    Check that permission is required and the request user has permission.

    If the form does not require auth, anyone can submit, regardless of whether
    they are authenticated. Otherwise, if the form does require auth, the
    user must be the owner or have CAN_ADD_SUBMISSIONS.

    :returns: None.
    :raises: PermissionDenied based on the above criteria.
    """

    if not xform.require_auth:
        # Anonymous submissions are allowed!
        return

    if request and request.user.is_anonymous:
        raise NotAuthenticated

    if (
        request
        and xform.user != request.user
        and not request.user.has_perm('report_xform', xform)
    ):
        raise PermissionDenied(t('Forbidden'))


def check_edit_submission_permissions(
    request: 'rest_framework.request.Request', xform: XForm
):
    if request.user.is_anonymous:
        raise UnauthenticatedEditAttempt
    if not _has_edit_xform_permission(request, xform):
        raise PermissionDenied(t(
            'Forbidden attempt to edit a submission. To make a new submission, '
            'Remove `deprecatedID` from the submission XML and try again.'
        ))


def create_instance(
    username: str,
    xml_file: File,
    media_files: Generator[File],
    status: str = 'submitted_via_web',
    uuid: str = None,
    date_created_override: datetime = None,
    request: Optional['rest_framework.request.Request'] = None,
    check_usage_limits: bool = True,
) -> Instance:
    """
    Processes form submissions by creating or updating an Instance in an atomic
    transaction.

    The function parses the submitted XML and media files, identifies the
    corresponding xform, checks permissions, and ensures uniqueness using
    advisory locks to avoid race conditions from simultaneous submissions.
    It also enforces the presence of a valid submission UUID and manages
    both new and duplicate submissions appropriately.

    The root UUID is extracted from the XML (from <meta><rootUuid> if present,
    or <instanceID> otherwise) and stored in the `root_uuid` column of the
    Instance model. A unique constraint is enforced on `(root_uuid, xform)` to
    ensure consistent identification across a submission's lifecycle.

    Returns HTTP 202 (Accepted) for true duplicates (identical content),
    or raises a conflict (409) if the same UUID is submitted with different
    content.

    Parameters:
        username (str):  The username associated with the submission.
        xml_file (File): A file-like object containing the XML form submission.
        media_files (Generator[File]): Generator yielding media file objects.
        status (str, optional): Submission status (default 'submitted_via_web').
        uuid (str, optional): Unique identifier for the submission.
        date_created_override (datetime, optional): Override for the submission's
                                                    creation date.
        request (Optional[Request]): Request object used for permission checks.
        check_usage_limits (bool, optional): For testing purposes, bypasses
                                             checking whether asset owner
                                             is over allowed submission/storage
                                             limit.

    Returns:
        Instance: The updated or newly created submission instance

    Raises:
        InstanceIdMissingError: If no valid UUID is found in the XML submission.
        DuplicateInstanceError: If there is a submission with the same XML hash and user
                                without any new attachments.
        ConflictingSubmissionUUIDError: If the same UUID already exists or being
                                        processed.
        PermissionDenied: If the submission fails permission checks.
    """

    if username:
        username = username.lower()

    xml = smart_str(xml_file.read())
    xml_hash = Instance.get_hash(xml)
    xform = get_xform_from_submission(xml, username, uuid)
    check_submission_permissions(request, xform)
    if settings.STRIPE_ENABLED and check_usage_limits:
        calculator = ServiceUsageCalculator(xform.user)
        balances = calculator.get_usage_balances()
        for usage_type in [UsageType.STORAGE_BYTES, UsageType.SUBMISSION]:
            balance = balances[usage_type]
            if balance and balance['exceeded']:
                raise ExceededUsageLimitError()

    # get root uuid
    root_uuid, fallback_on_uuid = get_root_uuid_from_xml(xml)
    new_uuid = root_uuid if fallback_on_uuid else get_uuid_from_xml(xml)

    if not new_uuid:
        raise InstanceIdMissingError

    with get_instance_lock(root_uuid, xform.id) as lock_acquired:
        if not lock_acquired:
            raise LockedSubmissionError(
                f'Submission {root_uuid} is currently being processed. '
                f'Try again later.'
            )

        # Check for an existing instance
        existing_instance = Instance.objects.filter(
            xml_hash=xml_hash,
            xform__user_id=xform.user_id,
        ).first()

        if existing_instance:
            existing_instance.check_active(force=False)
            # ensure we have saved the extra attachments
            total_bytes, has_new_attachments = save_attachments(
                existing_instance, media_files
            )
            if not has_new_attachments:
                raise DuplicateInstanceError
            else:
                # Update Mongo via the related ParsedInstance
                existing_instance.parsed_instance.save(asynchronous=False)
                update_storage_counters(
                    xform.pk,
                    xform.user_id,
                    total_bytes,
                )
                return existing_instance
        else:
            # We have to save the `Instance` to the database before we can associate
            # any `Attachment`s with it, but we are inside a transaction and saving
            # attachments is slow! Usually creating an `Instance` updates the
            # submission count of the parent `XForm` automatically via a `post_save`
            # signal, but that takes a lock on `logger_xform` that persists until the
            # end of the transaction.  We must avoid doing that until all attachments
            # are saved, and we are as close as possible to the end of the transaction.
            # See https://github.com/kobotoolbox/kobocat/issues/490.
            #
            # `_get_instance(..., defer_counting=True)` skips incrementing the
            # submission counters and returns an `Instance` with a `defer_counting`
            # attribute set to `True` *if* a new instance was created. We are
            # responsible for manually calling all counter-update methods if the
            # returned `Instance` has `defer_counting = True`.

            instance = _get_instance(
                request,
                xml,
                new_uuid,
                status,
                xform,
                date_created_override,
                defer_counting=True,
            )

            total_bytes, _ = save_attachments(instance, media_files)

            pi, created = ParsedInstance.objects.get_or_create(instance=instance)

            if not created:
                pi.save(asynchronous=False)

            # Now that the slow tasks are complete, and we are (hopefully!) close to the
            # end of the transaction, update the counters
            update_storage_counters(
                instance.xform_id, instance.xform.user_id, total_bytes
            )

            if getattr(instance, 'defer_counting', False):
                # Remove the Python-only attribute
                del instance.defer_counting

                update_xform_daily_counter(
                    sender=Instance,
                    instance=instance,
                    created=True,
                    xform=instance.xform,
                )
                update_xform_monthly_counter(
                    sender=Instance,
                    instance=instance,
                    created=True,
                    xform=instance.xform,
                )
                update_xform_submission_count(
                    sender=Instance,
                    instance=instance,
                    created=True,
                    xform=instance.xform,
                )

            if settings.STRIPE_ENABLED:
                from kobo.apps.stripe.utils.limit_enforcement import (
                    check_exceeded_limit,
                )

                check_exceeded_limit(xform.user, UsageType.SUBMISSION)
                check_exceeded_limit(xform.user, UsageType.STORAGE_BYTES)

            return instance


def disposition_ext_and_date(name, extension, show_date=True):
    if name is None:
        return 'attachment;'
    if show_date:
        name = '%s_%s' % (name, date.today().strftime('%Y_%m_%d'))
    return 'attachment; filename=%s.%s' % (name, extension)


def dict2xform(submission: dict, xform_id_string: str) -> str:
    xml_head = (
        f'<?xml version="1.0" encoding="utf-8"?>\n'
        f'   <{xform_id_string} id="{xform_id_string}">\n'
    )
    xml_tail = f'\n</{xform_id_string}>\n'

    return xml_head + dict2xml(submission) + xml_tail


@contextlib.contextmanager
def get_instance_lock(submission_uuid: str, xform_id: int) -> bool:
    """
    Acquires a PostgreSQL advisory lock to prevent race conditions when
    processing form submissions. This ensures that submissions with the same
    unique identifiers (xform_id, submission_uuid) are handled
    sequentially, preventing duplicate records in the database.

    A unique integer lock key (int_lock) is generated by creating a SHAKE-128
    hash of the unique identifiers, truncating it to 7 bytes, and converting it
    to an integer.
    """
    int_lock = int.from_bytes(
        hashlib.shake_128(f'{xform_id}!!{submission_uuid}'.encode()).digest(7), 'little'
    )
    acquired = False

    try:
        with kc_transaction_atomic():
            cur = connection.cursor()
            cur.execute('SELECT pg_try_advisory_lock(%s::bigint);', (int_lock,))
            acquired = cur.fetchone()[0]
            yield acquired
    finally:
        # Release the lock if it was acquired
        cur.execute('SELECT pg_advisory_unlock(%s::bigint);', (int_lock,))
        cur.close()


def get_instance_or_404(**criteria):
    """
    Mimic `get_object_or_404` but handles duplicate records.

    `logger_instance` can contain records with the same `uuid`

    :param criteria: dict
    :return: Instance
    """
    instances = Instance.objects.filter(**criteria).order_by('id')
    if instances:
        instance = instances[0]
        xml_hash = instance.xml_hash
        for instance_ in instances[1:]:
            if instance_.xml_hash == xml_hash:
                continue
            raise DuplicateUUIDError(
                'Multiple instances with different content exist for UUID '
                '{}'.format(instance.uuid)
            )

        return instance
    else:
        raise Http404


def get_uuid_from_submission(xml):
    # parse UUID from uploaded XML
    split_xml = uuid_regex.split(xml)

    # check that xml has UUID
    return len(split_xml) > 1 and split_xml[1] or None


def get_xform_from_submission(xml, username, uuid=None):
    # check alternative form submission ids
    uuid = uuid or get_uuid_from_submission(xml)

    if not username and not uuid:
        raise InstanceInvalidUserError()

    if uuid:
        # try to find the form by its uuid which is the ideal condition
        try:
            xform = XForm.objects.get(uuid=uuid)
        except XForm.DoesNotExist:
            pass
        else:
            return xform

    id_string = get_id_string_from_xml_str(xml)

    return get_object_or_404(
        XForm, id_string__exact=id_string, user__username=username
    )


@contextmanager
def http_open_rosa_error_handler(func, request):
    class _ContextResult:
        def __init__(self):
            self.func_return = None
            self.error = None
            self.http_error_response = None

        @property
        def status_code(self):
            if self.http_error_response:
                return self.http_error_response.status_code
            return 200

    result = _ContextResult()
    try:
        result.func_return = func()
    except InstanceInvalidUserError:
        result.error = t('Username or ID required.')
        result.http_error_response = OpenRosaResponseBadRequest(result.error)
    except InstanceEmptyError:
        result.error = t('Received empty submission. No instance was created')
        result.http_error_response = OpenRosaResponseBadRequest(result.error)
    except InstanceIdMissingError:
        result.error = t('Instance ID is required')
        result.http_error_response = OpenRosaResponseBadRequest(result.error)
    except FormInactiveError:
        result.error = t('Form is not active')
        result.http_error_response = OpenRosaResponseNotAllowed(result.error)
    except TemporarilyUnavailableError:
        result.error = t('Temporarily unavailable')
        result.http_error_response = OpenRosaTemporarilyUnavailable(result.error)
    except ExceededUsageLimitError:
        result.error = t(
            'The owner of this survey has exceeded their submission limit.'
        )
        result.http_error_response = OpenRosaResponsePaymentRequired(result.error)
    except AccountInactiveError:
        result.error = t('Account is not active')
        result.http_error_response = OpenRosaResponseNotAllowed(result.error)
    except XForm.DoesNotExist:
        result.error = t('Form does not exist on this account')
        result.http_error_response = OpenRosaResponseNotFound(result.error)
    except ExpatError:
        result.error = t('Improperly formatted XML.')
        result.http_error_response = OpenRosaResponseBadRequest(result.error)
    except (ConflictingSubmissionUUIDError, ConflictingAttachmentBasenameError) as e:
        response = OpenRosaResponse(str(e))
        response.status_code = 409
        response['Location'] = request.build_absolute_uri(request.path)
        result.http_error_response = response
    except LockedSubmissionError as e:
        response = OpenRosaResponse(str(e))
        response.status_code = 423
        response['Location'] = request.build_absolute_uri(request.path)
        result.http_error_response = response
    except DuplicateInstanceError as e:
        response = OpenRosaResponse(str(e))
        response.status_code = 202
        response['Location'] = request.build_absolute_uri(request.path)
        result.http_error_response = response
    except PermissionDenied:
        result.error = t('Access denied')
        result.http_error_response = OpenRosaResponseForbidden(result.error)
    except InstanceMultipleNodeError as e:
        result.error = str(e)
        result.http_error_response = OpenRosaResponseBadRequest(e)
    except DjangoUnicodeDecodeError:
        result.error = t(
            'File likely corrupted during ' 'transmission, please try later.'
        )
        result.http_error_response = OpenRosaResponseBadRequest(result.error)
    yield result


def inject_instanceid(xml_str, uuid):
    if get_uuid_from_xml(xml_str) is None:
        xml = clean_and_parse_xml(xml_str)
        children = xml.childNodes
        if children.length == 0:
            raise ValueError(t('XML string must have a survey element.'))

        # check if we have a meta tag
        survey_node = children.item(0)
        meta_tags = [
            n
            for n in survey_node.childNodes
            if n.nodeType == Node.ELEMENT_NODE and n.tagName.lower() == 'meta'
        ]
        if len(meta_tags) == 0:
            meta_tag = xml.createElement('meta')
            xml.documentElement.appendChild(meta_tag)
        else:
            meta_tag = meta_tags[0]

        # check if we have an instanceID tag
        uuid_tags = [
            n
            for n in meta_tag.childNodes
            if n.nodeType == Node.ELEMENT_NODE and n.tagName == 'instanceID'
        ]
        if len(uuid_tags) == 0:
            uuid_tag = xml.createElement('instanceID')
            meta_tag.appendChild(uuid_tag)
        else:
            uuid_tag = uuid_tags[0]
        # insert meta and instanceID
        text_node = xml.createTextNode('uuid:%s' % uuid)
        uuid_tag.appendChild(text_node)
        return xml.toxml()
    return xml_str


def mongo_sync_status(remongo=False, update_all=False, user=None, xform=None):
    """
    Check the status of records in the PostgreSQL db versus MongoDB.
    At a minimum, return a report (string) of the results.

    Optionally, take action to correct the differences, based on these
    parameters, if present and defined:

    remongo    -> if True, update the records missing in mongodb
                  (default: False)
    update_all -> if True, update all the relevant records (default: False)
    user       -> if specified, apply only to the forms for the given user
                  (default: None)
    xform      -> if specified, apply only to the given form (default: None)

    """

    qs = XForm.objects.only('id_string', 'user').select_related('user')
    if user and not xform:
        qs = qs.filter(user=user)
    elif user and xform:
        qs = qs.filter(user=user, id_string=xform.id_string)
    else:
        qs = qs.all()

    total = qs.count()
    found = 0
    done = 0
    total_to_remongo = 0
    report_string = ''
    for xform in queryset_iterator(qs, 100):
        # get the count
        instance_count = Instance.objects.filter(xform=xform).count()
        userform_id = get_mongo_userform_id(xform)
        mongo_count = mongo_instances.count_documents(
            {common_tags.USERFORM_ID: userform_id},
            maxTimeMS=MongoHelper.get_max_time_ms()
        )

        if instance_count != mongo_count or update_all:
            line = (
                'user: %s, id_string: %s\nInstance count: %d\t'
                'Mongo count: %d\n---------------------------------'
                '-----\n'
                % (xform.user.username, xform.id_string, instance_count, mongo_count)
            )
            report_string += line
            found += 1
            total_to_remongo += (instance_count - mongo_count)

            # should we remongo
            if remongo or (remongo and update_all):
                if update_all:
                    sys.stdout.write(
                        'Updating all records for %s\n--------------------'
                        '---------------------------\n' % xform.id_string
                    )
                else:
                    sys.stdout.write(
                        'Updating missing records for %s\n----------------'
                        '-------------------------------\n' % xform.id_string
                    )
                _update_mongo_for_xform(xform, only_update_missing=not update_all)
        done += 1
        sys.stdout.write('%.2f %% done ...\r' % ((float(done) / float(total)) * 100))
    # only show stats if we are not updating mongo, the update function
    # will show progress
    if not remongo:
        line = (
            'Total # of forms out of sync: %d\n'
            'Total # of records to remongo: %d\n' % (found, total_to_remongo)
        )
        report_string += line
    return report_string


def publish_form(callback):
    try:
        return callback()
    except (PyXFormError, XLSFormError) as e:
        return {
            'type': 'alert-error',
            'text': str(e)
        }
    except IntegrityError as e:
        return {
            'type': 'alert-error',
            'text': str(e),
        }
    except ValidationError as e:
        # on clone invalid URL
        return {
            'type': 'alert-error',
            'text': t('Invalid URL format.'),
        }
    except AttributeError as e:
        # form.publish returned None, not sure why...
        return {
            'type': 'alert-error',
            'text': str(e)
        }
    except ProcessTimedOut as e:
        # catch timeout errors
        return {
            'type': 'alert-error',
            'text': t('Form validation timeout, please try again.'),
        }
    except Exception as e:
        # TODO: Something less horrible. This masks storage backend
        # `ImportError`s and who knows what else

        # ODK validation errors are vanilla errors and it masks a lot of regular
        # errors if we try to catch it so let's catch it, BUT reraise it
        # if we don't see typical ODK validation error messages in it.
        if 'ODK Validate Errors' not in str(e):
            raise

        # error in the XLS file; show an error to the user
        return {
            'type': 'alert-error',
            'text': str(e)
        }


def publish_xls_form(xls_file, user, id_string=None):
    """
    Creates or updates a DataDictionary with supplied xls_file,
    user and optional id_string - if updating
    """
    # get or create DataDictionary based on user and id string
    if id_string:
        dd = DataDictionary.objects.get(user=user, id_string=id_string)
        dd.xls = xls_file
        dd.save()
        return dd
    else:
        # Creation needs to be wrapped in a transaction because of unit tests.
        # It raises `TransactionManagementError` on IntegrityError in
        # `RestrictedAccessMiddleware` when accessing `request.user.profile`.
        # See https://stackoverflow.com/a/23326971
        try:
            with transaction.atomic():
                dd = DataDictionary.objects.create(user=user, xls=xls_file)
        except IntegrityError as e:
            raise e
        return dd


def publish_xml_form(xml_file, user):
    xml = smart_str(xml_file.read())
    survey = create_survey_element_from_xml(xml)
    form_json = survey.to_json()
    dd = DataDictionary(user=user, xml=xml, json=form_json)
    dd.mark_start_time_boolean()
    set_uuid(dd)
    dd.set_uuid_in_xml()
    dd.save()
    return dd


def report_exception(subject, info, exc_info=None):
    # TODO: replace with standard logging (i.e. `import logging`)
    if exc_info:
        cls, err = exc_info[:2]
        message = t('Exception in request:' ' %(class)s: %(error)s') % {
            'class': cls.__name__,
            'error': err,
        }
        message += ''.join(traceback.format_exception(*exc_info))
    else:
        message = '%s' % info

    if settings.DEBUG or settings.TESTING:
        sys.stdout.write('Subject: %s\n' % subject)
        sys.stdout.write('Message: %s\n' % message)
    else:
        mail_admins(subject=subject, message=message)


def response_with_mimetype_and_name(
        mimetype, name, extension=None, show_date=True, file_path=None,
        use_local_filesystem=False, full_mime=False):
    if extension is None:
        extension = mimetype
    if not full_mime:
        mimetype = 'application/%s' % mimetype
    if file_path:
        try:
            if not use_local_filesystem:
                wrapper = FileWrapper(default_storage.open(file_path))
                response = StreamingHttpResponse(wrapper, content_type=mimetype)
                response['Content-Length'] = default_storage.size(file_path)
            else:
                wrapper = FileWrapper(open(file_path))
                response = StreamingHttpResponse(wrapper, content_type=mimetype)
                response['Content-Length'] = os.path.getsize(file_path)
        except IOError:
            response = HttpResponseNotFound(t('The requested file could not be found.'))
    else:
        response = HttpResponse(content_type=mimetype)
    response['Content-Disposition'] = disposition_ext_and_date(
        name, extension, show_date)
    return response


def safe_create_instance(
    username: str,
    xml_file: File,
    media_files: Union[list, Generator[File]],
    uuid: Optional[str] = None,
    date_created_override: Optional[datetime] = None,
    request: Optional['rest_framework.request.Request'] = None,
):
    """Create an instance and catch exceptions.

    :returns: A list [error, instance] where error is None if there was no
        error.
    """
    with http_open_rosa_error_handler(
        lambda: create_instance(
            username,
            xml_file,
            media_files,
            uuid=uuid,
            date_created_override=date_created_override,
            request=request,
        ),
        request,
    ) as handler:
        return [handler.http_error_response, handler.func_return]


def save_attachments(
    instance: Instance,
    media_files: Generator[File],
) -> tuple[list[Attachment], list[Attachment]]:
    """
    Return a tuple of two lists.
    - The former is new attachments
    - The latter is the replaced/soft-deleted attachments

    `defer_counting=False` will set a Python-only attribute of the same name on
    any *new* `Attachment` instances created. This will prevent
    `update_xform_attachment_storage_bytes()` and friends from doing anything,
    which avoids locking any rows in `logger_xform` or `main_userprofile`.
    """
    new_attachments = []
    total_bytes = 0
    has_new_attachments = False

    for f in media_files:
        media_file_basename = os.path.basename(f.name)

        # The basename of a (non-deleted) attachment must be unique per instance.
        existing_attachment = Attachment.objects.filter(
            instance=instance,
            media_file_basename=media_file_basename,
        ).first()

        uploaded_file_hash = calculate_hash(f, 'sha1')

        if existing_attachment:
            # We only accept the exact same uploaded file. The submission should be
            # rejected if the file differs in any way.
            # Validation is done by comparing the SHA-1 hash.
            existing_attachment_hash = (
                existing_attachment.hash or existing_attachment.get_hash()
            )
            if uploaded_file_hash == existing_attachment_hash:
                # We already have this attachment!
                continue
            raise ConflictingAttachmentBasenameError

        # This is a new attachment; save it!
        new_attachment = Attachment(
            instance=instance,
            media_file=f,
            mimetype=f.content_type,
            hash=uploaded_file_hash,
            xform_id=instance.xform_id,
            user_id=instance.xform.user_id,
            media_file_basename=media_file_basename,
            media_file_size=f.size,
            date_created=dj_timezone.now(),
            date_modified=dj_timezone.now(),
        )
        total_bytes += f.size
        new_attachments.append(new_attachment)

    if new_attachments:
        has_new_attachments = True
        Attachment.objects.bulk_create(new_attachments)

    for soft_deleted_att in get_soft_deleted_attachments(instance):
        total_bytes -= soft_deleted_att.media_file_size

    return total_bytes, has_new_attachments


def get_soft_deleted_attachments(instance: Instance) -> list[Attachment]:
    """
    Soft delete replaced attachments when editing a submission
    """
    # Retrieve all media questions of Xform
    media_question_xpaths = get_xform_media_question_xpaths(instance.xform)

    # If XForm does not have any media fields, do not go further
    if not media_question_xpaths:
        return []

    # Parse instance XML to get the basename of each file of the updated
    # submission
    xml_parsed = ET.fromstring(instance.xml)
    basenames = []

    for media_question_xpath in media_question_xpaths:
        root_name, xpath_without_root = media_question_xpath.split('/', 1)
        try:
            assert root_name == xml_parsed.tag
        except AssertionError:
            logging.warning(
                'Instance XML root tag name does not match with its form'
            )

        # With repeat groups, several nodes can have the same XPath. We
        # need to retrieve all of them
        questions = xml_parsed.findall(xpath_without_root)
        for question in questions:
            try:
                basename = question.text
            except AttributeError:
                raise XPathNotFoundException

            # Only keep non-empty fields
            if basename:
                basenames.append(basename)

    # Update Attachment objects to hide them if they are not used anymore.
    # We do not want to delete them until the instance itself is deleted.

    # If the new attachment has the same basename as an existing one but
    # different content, update the existing one.

    # FIXME Temporary hack to leave background-audio files and audit files alone
    #  Bug comes from `get_xform_media_question_xpaths()`
    queryset = Attachment.objects.filter(instance=instance).exclude(
        Q(media_file_basename__endswith='.enc')
        | Q(media_file_basename='audit.csv')
        | Q(media_file_basename__regex=r'^\d{10,}\.(m4a|amr)$')
    ).order_by('-id')

    latest_attachments, remaining_attachments_ids = [], []
    basename_set = set(basenames)
    for attachment in queryset:
        if attachment.media_file_basename in basename_set:
            latest_attachments.append(attachment)
            basename_set.remove(attachment.media_file_basename)
        else:
            remaining_attachments_ids.append(attachment.id)
    remaining_attachments = queryset.filter(id__in=remaining_attachments_ids)
    soft_deleted_attachments = list(remaining_attachments)

    # The query below updates only the database records, not the in-memory
    # `Attachment` objects.
    # As a result, the `deleted_at` attribute of `Attachment` objects remains `None`
    # in memory after the update.
    # This behavior is necessary to allow the signal to handle file deletion from
    # storage.
    remaining_attachments.update(
        date_modified=dj_timezone.now(),
        deleted_at=dj_timezone.now(),
        delete_status=AttachmentDeleteStatus.SOFT_DELETED,
    )

    return soft_deleted_attachments


def _get_instance(
    request: 'rest_framework.request.Request',
    xml: str,
    new_uuid: str,
    status: str,
    xform: XForm,
    date_created_override: Optional[datetime] = None,
    defer_counting: bool = False,
) -> Instance:
    """
    `defer_counting=False` will set a Python-only attribute of the same name on
    the *new* `Instance` if one is created. This will prevent post-save signals
    (when `defer_counting` is True) from doing anything, which avoids locking
    any rows in `logger_xform`, `main_userprofile`, `logger_dailyxformsubmissioncounter`
    or `logger_monthlyxformsubmissioncounter`.
    """

    # check if it is an edit submission
    old_uuid = get_deprecated_uuid_from_xml(xml)
    if old_uuid and (instance := Instance.objects.filter(uuid=old_uuid).first()):
        # edits
        check_edit_submission_permissions(request, xform)
        InstanceHistory.objects.create(
            xml=instance.xml, xform_instance=instance, uuid=old_uuid
        )
        instance.xml = xml
        instance.uuid = new_uuid
    else:
        submitted_by = (
            get_database_user(request.user)
            if request and request.user.is_authenticated
            else None
        )

        if not date_created_override:
            date_created_override = get_submission_date_from_xml(xml)

        # Override date created if required
        if date_created_override and not dj_timezone.is_aware(date_created_override):
            # default to utc?
            date_created_override = dj_timezone.make_aware(
                date_created_override, timezone.utc
            )

        # Avoid `Instance.objects.create()` so that we can set a Python-only
        # attribute, `defer_counting`, before saving
        instance = Instance()
        instance.xml = xml
        instance.user = submitted_by
        instance.status = status
        instance.xform = xform
        instance.date_created = date_created_override
        instance.defer_counting = defer_counting

    try:
        instance.save()
    except IntegrityError as e:
        if 'root_uuid' in str(e):
            raise ConflictingSubmissionUUIDError
        raise

    return instance


def _has_edit_xform_permission(
    request: 'rest_framework.request.Request', xform: XForm
) -> bool:
    if isinstance(xform, XForm):
        if request.user.is_superuser:
            return True

        if request.user.has_perm('logger.change_xform', xform):
            return True

        # User's permissions have been already checked when calling KPI endpoint
        # If `has_partial_perms` is True, user is allowed to perform the action.
        return getattr(request.user, 'has_partial_perms', False)

    return False


def _update_mongo_for_xform(xform, only_update_missing=True):
    xform.refresh_from_db(fields=xform.get_deferred_fields())

    instance_ids = set(
        [i.id for i in Instance.objects.only('id').filter(xform=xform)])
    sys.stdout.write('Total no of instances: %d\n' % len(instance_ids))
    userform_id = get_mongo_userform_id(xform)

    if only_update_missing:
        sys.stdout.write('Only updating missing mongo instances\n')
        mongo_ids = set(
            [rec[common_tags.ID] for rec in mongo_instances.find(
                {common_tags.USERFORM_ID: userform_id},
                {common_tags.ID: 1},
                max_time_ms=MongoHelper.get_max_time_ms()
        )])
        sys.stdout.write('Total no of mongo instances: %d\n' % len(mongo_ids))
        # get the difference
        instance_ids = instance_ids.difference(mongo_ids)
    else:
        # clear mongo records
        MongoHelper.delete_many({common_tags.USERFORM_ID: userform_id})

    # get instances
    sys.stdout.write('Total no of instances to update: %d\n' % len(instance_ids))
    instances = Instance.objects.only('id', 'xml', 'json').in_bulk(
        [id_ for id_ in instance_ids]
    )
    total = len(instances)
    done = 0

    data_dict = xform.data_dictionary(use_cache=True)
    repeat_groups = [
        get_abbreviated_xpath(e)
        for e in data_dict.get_survey_elements_of_type('repeat')
    ]
    for id_, instance in instances.items():
        parser = XFormInstanceParser(
            instance.xml, data_dictionary=None, delay_parse=True
        )
        parser.parse(instance.xml, repeats=repeat_groups)
        as_dict = parser.get_flat_dict_with_attributes()
        try:
            (pi, created) = ParsedInstance.objects.get_or_create(
                instance=instance, defaults={'mongo_dict_override': as_dict}
            )
            if not created:
                pi.mongo_dict_override = as_dict
                save_success = pi.save(asynchronous=False)
                if not save_success:
                    print(
                        '\033[91m[ERROR] - Instance #{}/uuid:{} - Could not save '
                        'the parsed instance\033[0m'.format(id_, instance.uuid)
                    )
                else:
                    done += 1
            else:
                done += 1
        except InstanceEmptyError:
            print(
                '\033[91m[WARNING] - Skipping Instance #{}/uuid:{} because '
                'it is empty\033[0m'.format(id_, instance.uuid)
            )

        progress = '\r%.2f %% done...' % ((float(done) / float(total)) * 100)
        sys.stdout.write(progress)
        sys.stdout.flush()

    sys.stdout.write(
        '\nUpdated %s\n------------------------------------------\n' % xform.id_string
    )


class BaseOpenRosaResponse(HttpResponse):
    status_code = 201

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self[OPEN_ROSA_VERSION_HEADER] = OPEN_ROSA_VERSION
        dt = datetime.now(tz=ZoneInfo('UTC')).strftime('%a, %d %b %Y %H:%M:%S %Z')
        self['Date'] = dt
        self['X-OpenRosa-Accept-Content-Length'] = DEFAULT_CONTENT_LENGTH
        self['Content-Type'] = DEFAULT_CONTENT_TYPE


class OpenRosaResponse(BaseOpenRosaResponse):
    status_code = 201

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # wrap content around xml
        self.content = (
            b"<?xml version='1.0' encoding='UTF-8' ?>\n"
            b'<OpenRosaResponse xmlns="http://openrosa.org/http/response">\n'
            b'        <message nature="">'
        ) + self.content + (
            b'</message>\n'
            b'</OpenRosaResponse>'
        )


class OpenRosaResponseNotFound(OpenRosaResponse):
    status_code = 404


class OpenRosaResponseBadRequest(OpenRosaResponse):
    status_code = 400


class OpenRosaResponseNotAllowed(OpenRosaResponse):
    status_code = 405


class OpenRosaResponsePaymentRequired(OpenRosaResponse):
    status_code = 402


class OpenRosaResponseForbidden(OpenRosaResponse):
    status_code = 403


class OpenRosaTemporarilyUnavailable(OpenRosaResponse):
    status_code = 503


class UnauthenticatedEditAttempt(Exception):
    """
    Escape hatch from the `safe_create_instance()` antipattern, where these
    "logger tools" return responses directly instead of raising exceptions.
    To avoid a large refactoring, this class allows the view code to handle
    returning the proper response to the client:
    `check_edit_submission_permissions()` raises `UnauthenticatedEditAttempt`,
    which passes through unmolested to `XFormSubmissionApi.create()`, which
    then returns the appropriate 401 response.
    """
    pass


class XPathNotFoundException(Exception):
    pass
