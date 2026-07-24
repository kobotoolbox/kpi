import os
import uuid as uuid_module

from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.utils import timezone

from kobo.apps.openrosa.apps.logger.models import (
    DailyXFormSubmissionCounter,
    Instance,
    MonthlyXFormSubmissionCounter,
    SurveyType,
)
from kobo.apps.openrosa.apps.logger.models.attachment import Attachment
from kobo.apps.openrosa.apps.main.tests.test_base import TestBase
from kobo.apps.openrosa.apps.viewer.models.parsed_instance import ParsedInstance
from kobo.apps.openrosa.libs.utils.logger_tools import publish_xls_form

TUTORIAL_XLS_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    '../fixtures/test_forms/tutorial.xls',
)

SURVEY_NAMES_XLS_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    '../fixtures/test_forms/survey_names/survey_names.xls',
)


class TestCleanDuplicatedSubmissions(TestBase):
    """
    Tests for the `clean_duplicated_submissions` management command.

    Two groups of instances are used throughout:
    - Group A: 3 instances sharing the same UUID *and* the same xml_hash
      (exact content duplicates → the 2 extras are deleted, attachments
      re-linked to the oldest reference).
    - Group B: 3 instances sharing the same UUID but with *different*
      xml_hashes (divergent edits → UUIDs are renamed to DUPLICATE-…).

    Instances are created via bulk_create to bypass Instance.save(), which
    would set root_uuid and reject duplicates at the ORM level.
    """

    def setUp(self):
        super().setUp()
        self._publish_xls_file_and_set_xform(TUTORIAL_XLS_PATH)
        self.survey_type, _ = SurveyType.objects.get_or_create(
            slug=self.xform.id_string
        )

    # ------------------------------------------------------------------ helpers

    def _make_xml(self, instance_uuid, name='Test'):
        """
        Minimal valid XML submission for the tutorial form.
        """
        return (
            f'<?xml version="1.0" ?>'
            f'<{self.xform.id_string} id="{self.xform.id_string}">'
            f'<meta><instanceID>uuid:{instance_uuid}</instanceID></meta>'
            f'<name>{name}</name>'
            f'</{self.xform.id_string}>'
        )

    def _create_instance(self, xml, instance_uuid):
        """
        Insert an Instance row directly via bulk_create, bypassing save() so
        that root_uuid stays NULL (simulating the pre-LRM state).
        """
        instance = Instance(
            xml=xml,
            uuid=instance_uuid,
            xml_hash=Instance.get_hash(xml),
            root_uuid=None,
            user=self.user,
            xform=self.xform,
            survey_type=self.survey_type,
            json='{}',
            status='submitted_via_web',
            validation_status={},
        )
        results = Instance.objects.bulk_create([instance])
        return results[0]

    def _add_attachment(self, instance):
        fake_file = SimpleUploadedFile(
            'test.txt', b'content', content_type='text/plain'
        )
        return Attachment.objects.create(
            instance=instance,
            xform=self.xform,
            media_file=fake_file,
            mimetype='text/plain',
            media_file_size=7,
        )

    def _add_parsed_instance(self, instance):
        parsed, _ = ParsedInstance.objects.get_or_create(instance=instance)
        return parsed

    def _setup_counters(self, count):
        """
        Pre-populate Monthly/Daily counters for today.
        """
        today = timezone.now().date()
        MonthlyXFormSubmissionCounter.objects.update_or_create(
            year=today.year,
            month=today.month,
            user_id=self.user.pk,
            xform_id=self.xform.pk,
            defaults={'counter': count},
        )
        DailyXFormSubmissionCounter.objects.update_or_create(
            date=today,
            user_id=self.user.pk,
            xform_id=self.xform.pk,
            defaults={'counter': count},
        )

    def _make_group_a(self):
        """
        3 instances with the same UUID and identical content (same xml_hash).
        """
        uid = str(uuid_module.uuid4())
        xml = self._make_xml(uid, name='Same Content')
        self.a1 = self._create_instance(xml, uid)
        self.a2 = self._create_instance(xml, uid)
        self.a3 = self._create_instance(xml, uid)
        for inst in (self.a1, self.a2, self.a3):
            self._add_attachment(inst)
            self._add_parsed_instance(inst)

    def _make_group_b(self):
        """
        3 instances with the same UUID but different content (different xml_hash).
        """
        uid = str(uuid_module.uuid4())
        self.b1 = self._create_instance(self._make_xml(uid, 'Version 1'), uid)
        self.b2 = self._create_instance(self._make_xml(uid, 'Version 2'), uid)
        self.b3 = self._create_instance(self._make_xml(uid, 'Version 3'), uid)
        for inst in (self.b1, self.b2, self.b3):
            self._add_attachment(inst)
            self._add_parsed_instance(inst)

    # -------------------------------------------------------- _delete_duplicates

    def test_delete_duplicates_removes_extras_and_keeps_reference(self):
        """
        The two duplicates (A2, A3) must be deleted; the oldest (A1) survives.
        """
        self._make_group_a()
        call_command('clean_duplicated_submissions', xform=self.xform.id_string)

        surviving = list(
            Instance.objects.filter(uuid=self.a1.uuid).values_list('pk', flat=True)
        )
        self.assertEqual(len(surviving), 1)
        self.assertEqual(surviving[0], self.a1.pk)

    def test_delete_duplicates_relinks_all_attachments_to_reference(self):
        """
        Attachments from the deleted duplicates must be re-linked to A1.
        """
        self._make_group_a()
        call_command('clean_duplicated_submissions', xform=self.xform.id_string)

        self.assertEqual(Attachment.objects.filter(instance_id=self.a1.pk).count(), 3)
        self.assertEqual(
            Attachment.objects.filter(instance_id__in=[self.a2.pk, self.a3.pk]).count(),
            0,
        )

    def test_delete_duplicates_backfills_root_uuid_on_reference(self):
        """
        root_uuid must be set on the surviving reference after the duplicates
        are deleted (set after deletion to avoid a unique-constraint violation).
        """
        self._make_group_a()
        call_command('clean_duplicated_submissions', xform=self.xform.id_string)

        ref = Instance.objects.get(pk=self.a1.pk)
        self.assertIsNotNone(ref.root_uuid)
        self.assertEqual(ref.root_uuid, self.a1.uuid)

    def test_delete_duplicates_decrements_monthly_and_daily_counters(self):
        """
        Monthly and daily submission counters must be decremented once for
        each deleted instance (2 deletions → counter drops from 3 to 1).
        """
        self._make_group_a()
        self._setup_counters(count=3)
        today = timezone.now().date()

        call_command('clean_duplicated_submissions', xform=self.xform.id_string)

        monthly = MonthlyXFormSubmissionCounter.objects.get(
            year=today.year,
            month=today.month,
            user_id=self.user.pk,
            xform_id=self.xform.pk,
        )
        self.assertEqual(monthly.counter, 1)

        daily = DailyXFormSubmissionCounter.objects.get(
            date=today, xform_id=self.xform.pk
        )
        self.assertEqual(daily.counter, 1)

    # ------------------------------------------------------- _replace_duplicates

    def test_replace_duplicates_renames_all_uuids(self):
        """
        All instances in group B must have their UUIDs prefixed with DUPLICATE-
        and must no longer carry the original UUID.
        """
        self._make_group_b()
        original_uuid = self.b1.uuid

        call_command('clean_duplicated_submissions', xform=self.xform.id_string)

        updated = Instance.objects.filter(pk__in=[self.b1.pk, self.b2.pk, self.b3.pk])
        self.assertEqual(updated.count(), 3)
        for instance in updated:
            self.assertTrue(
                instance.uuid.startswith('DUPLICATE-'),
                msg=f'Expected DUPLICATE- prefix, got: {instance.uuid}',
            )
            self.assertNotEqual(instance.uuid, original_uuid)

    def test_replace_duplicates_recomputes_xml_hash_and_backfills_root_uuid(self):
        """
        After UUID renaming the xml_hash must match the updated XML, and
        root_uuid must be populated.
        """
        self._make_group_b()
        call_command('clean_duplicated_submissions', xform=self.xform.id_string)

        for instance in Instance.objects.filter(
            pk__in=[self.b1.pk, self.b2.pk, self.b3.pk]
        ):
            self.assertEqual(instance.xml_hash, Instance.get_hash(instance.xml))
            self.assertIsNotNone(instance.root_uuid)

    # --------------------------------------------------------- handle() filters

    def test_xform_filter_leaves_other_xforms_untouched(self):
        """
        --xform must restrict processing to the targeted form; duplicates in
        a second xform (with a different id_string) must remain intact.
        """
        self._make_group_a()

        # Publish a second form with a different id_string for the same user.
        # Using survey_names.xls avoids the unique_together constraint on
        # (user_id, id_string) while ensuring the --xform filter cannot match it.
        with open(SURVEY_NAMES_XLS_PATH, 'rb') as f:
            xls_file = ContentFile(f.read(), name='survey_names.xls')
        second_xform = publish_xls_form(xls_file, self.user)

        uid_other = str(uuid_module.uuid4())
        xml_other = (
            f'<?xml version="1.0" ?>'
            f'<{second_xform.id_string} id="{second_xform.id_string}">'
            f'<meta><instanceID>uuid:{uid_other}</instanceID></meta>'
            f'<name>Other</name>'
            f'</{second_xform.id_string}>'
        )
        survey_type_other, _ = SurveyType.objects.get_or_create(
            slug=second_xform.id_string
        )
        Instance.objects.bulk_create([
            Instance(
                xml=xml_other, uuid=uid_other,
                xml_hash=Instance.get_hash(xml_other), root_uuid=None,
                user=self.user, xform=second_xform, survey_type=survey_type_other,
                json='{}', status='submitted_via_web', validation_status={},
            ),
            Instance(
                xml=xml_other, uuid=uid_other,
                xml_hash=Instance.get_hash(xml_other), root_uuid=None,
                user=self.user, xform=second_xform, survey_type=survey_type_other,
                json='{}', status='submitted_via_web', validation_status={},
            ),
        ])

        call_command('clean_duplicated_submissions', xform=self.xform.id_string)

        # First xform: cleaned (only 1 remains)
        self.assertEqual(Instance.objects.filter(uuid=self.a1.uuid).count(), 1)
        # Second xform: untouched (both instances still present)
        self.assertEqual(Instance.objects.filter(uuid=uid_other).count(), 2)

    # ------------------------------------------------------------ edge cases

    def test_all_same_hash_never_produces_duplicate_prefix(self):
        """
        When all duplicates share the same xml_hash, _replace_duplicates is
        never called — no UUID should start with DUPLICATE-.
        """
        self._make_group_a()
        call_command('clean_duplicated_submissions', xform=self.xform.id_string)

        self.assertFalse(
            Instance.objects.filter(uuid__startswith='DUPLICATE-').exists()
        )
        self.assertEqual(Instance.objects.filter(uuid=self.a1.uuid).count(), 1)

    def test_replace_duplicates_tolerates_missing_parsed_instance(self):
        """
        If a duplicate has no ParsedInstance, _replace_duplicates must
        continue without raising RelatedObjectDoesNotExist.
        """
        uid = str(uuid_module.uuid4())
        b1 = self._create_instance(self._make_xml(uid, 'Version 1'), uid)
        b2 = self._create_instance(self._make_xml(uid, 'Version 2'), uid)
        # Deliberately no ParsedInstance created for b1 or b2

        # Should not raise
        call_command('clean_duplicated_submissions', xform=self.xform.id_string)

        updated = Instance.objects.filter(pk__in=[b1.pk, b2.pk])
        self.assertEqual(updated.count(), 2)
        for instance in updated:
            self.assertTrue(instance.uuid.startswith('DUPLICATE-'))
