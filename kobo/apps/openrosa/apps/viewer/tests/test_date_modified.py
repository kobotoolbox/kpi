from django.conf import settings

from kobo.apps.openrosa.apps.logger.models import Instance
from kobo.apps.openrosa.apps.logger.utils.instance import (
    add_validation_status_to_instance,
    set_instance_validation_statuses,
)
from kobo.apps.openrosa.apps.main.tests.test_base import TestBase
from kobo.apps.openrosa.apps.viewer.models.parsed_instance import ParsedInstance
from kobo.apps.openrosa.libs.utils.common_tags import (
    DATE_MODIFIED,
    MONGO_STRFTIME,
    SUBMISSION_TIME,
)


class TestDateModified(TestBase):
    """
    `_date_modified` must reflect every change to the served document —
    edits, validation-status changes (single and bulk) and attachment
    updates — while `_submission_time` stays pinned to the creation time.
    """

    def setUp(self):
        super().setUp()
        self._publish_transportation_form()
        self._make_submissions()

    def _mongo_doc(self, instance_id):
        return settings.MONGO_DB.instances.find_one({'_id': instance_id})

    def test_to_dict_for_mongo_carries_date_modified(self):
        instance = Instance.objects.order_by('pk').first()
        document = instance.parsed_instance.to_dict_for_mongo()
        assert document[DATE_MODIFIED] == instance.date_modified.strftime(
            MONGO_STRFTIME
        )
        assert document[SUBMISSION_TIME] == instance.date_created.strftime(
            MONGO_STRFTIME
        )

    def test_edit_updates_date_modified_but_not_submission_time(self):
        instance = Instance.objects.order_by('pk').first()
        date_created = instance.date_created
        date_modified_before = instance.date_modified
        # `save()` without `update_fields` is what the edit path
        # (`logger_tools.create_instance()`) calls after replacing the XML
        instance.save()
        instance.refresh_from_db()
        assert instance.date_modified > date_modified_before
        instance.parsed_instance.update_mongo(asynchronous=False)
        document = self._mongo_doc(instance.pk)
        assert document[DATE_MODIFIED] == instance.date_modified.strftime(
            MONGO_STRFTIME
        )
        assert document[SUBMISSION_TIME] == date_created.strftime(MONGO_STRFTIME)

    def test_validation_status_updates_date_modified(self):
        instance = Instance.objects.order_by('pk').first()
        date_modified_before = instance.date_modified
        assert add_validation_status_to_instance(
            self.user.username, 'validation_status_approved', instance
        )
        instance.refresh_from_db()
        assert instance.date_modified > date_modified_before
        document = self._mongo_doc(instance.pk)
        assert document[DATE_MODIFIED] == instance.date_modified.strftime(
            MONGO_STRFTIME
        )

    def test_bulk_validation_statuses_update_date_modified(self):
        instance_ids = list(Instance.objects.values_list('pk', flat=True))
        date_modified_before = max(
            Instance.objects.values_list('date_modified', flat=True)
        )
        request_data = {
            'submission_ids': instance_ids,
            'validation_status.uid': 'validation_status_approved',
        }
        updated_count = set_instance_validation_statuses(
            self.xform, request_data, self.user.username
        )
        assert updated_count == len(instance_ids)
        for instance in Instance.objects.filter(pk__in=instance_ids):
            assert instance.date_modified > date_modified_before
            document = self._mongo_doc(instance.pk)
            assert document[DATE_MODIFIED] == instance.date_modified.strftime(
                MONGO_STRFTIME
            )

    def test_bulk_update_attachments_updates_date_modified(self):
        instance = Instance.objects.order_by('pk').first()
        date_modified_before = instance.date_modified
        ParsedInstance.bulk_update_attachments([instance.pk])
        instance.refresh_from_db()
        assert instance.date_modified > date_modified_before
        document = self._mongo_doc(instance.pk)
        assert document[DATE_MODIFIED] == instance.date_modified.strftime(
            MONGO_STRFTIME
        )
