import io
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from django.conf import settings
from django.core.cache import cache
from django.core.management import call_command
from django.test import SimpleTestCase, TestCase

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models import Instance, XForm
from kobo.apps.openrosa.apps.logger.models.instance import InstanceHistory

# The XML builders live with the tests of the rule this replays, so that the
# two cannot drift apart
from kobo.apps.openrosa.apps.logger.tests.test_form_versions import (
    FORM_UUID,
    VERSION_1,
    VERSION_2,
    VERSION_3,
    get_form_versions,
    submission_xml,
    xform_json,
    xform_xml,
)
from kobo.apps.openrosa.apps.main.models import UserProfile
from kobo.apps.openrosa.libs.utils import common_tags
from kobo.apps.openrosa.libs.utils.logger_tools import create_instance
from kobo.apps.support_tools.exceptions import ProjectAlreadyBeingRestoredError
from kobo.apps.support_tools.utils.helpers import (
    _get_deployed_version_at,
    rebuild_form_versions,
)
from kobo.apps.support_tools.utils.restorers.form_versions import (
    FormVersionsRestorer,
)
from kpi.models import AssetVersion
from kpi.models.asset import Asset

UTC = ZoneInfo('UTC')
JAN = datetime(2026, 1, 1, tzinfo=UTC)
FEB = datetime(2026, 2, 1, tzinfo=UTC)
MAR = datetime(2026, 3, 1, tzinfo=UTC)
UNKNOWN_VERSION = 'v' + '9' * 21

DEPLOYED_VERSIONS = [
    {'uid': VERSION_1, 'date_modified': JAN},
    {'uid': VERSION_2, 'date_modified': FEB},
    {'uid': VERSION_3, 'date_modified': MAR},
]


def days_after(date: datetime, days: int = 1) -> datetime:
    return date + timedelta(days=days)


class RebuildFormVersionsTestCase(SimpleTestCase):
    """
    Replay what `add_form_versions()` would have recorded, had it existed
    when the submission and its edits came in.
    """

    def test_a_submission_received_under_its_own_version_records_nothing(self):
        assert (
            rebuild_form_versions(
                submission_xml(VERSION_1), days_after(JAN), [], DEPLOYED_VERSIONS
            )
            is None
        )

    def test_a_submission_collected_offline_records_only_its_own_version(self):
        """
        Every answer was given against the older version, which is where its
        fields are looked up. The version deployed on arrival describes none
        of them.
        """

        assert (
            rebuild_form_versions(
                submission_xml(VERSION_1), days_after(FEB), [], DEPLOYED_VERSIONS
            )
            == VERSION_1
        )

    def test_a_submission_collected_offline_then_edited_records_both(self):
        """
        A bulk edit keeps the old `__version__`, but the answers it writes are
        the ones the deployed form asks for.
        """

        histories = [(submission_xml(VERSION_1), days_after(FEB, 2))]

        assert (
            rebuild_form_versions(
                submission_xml(VERSION_1),
                days_after(FEB),
                histories,
                DEPLOYED_VERSIONS,
            )
            == f'{VERSION_1} {VERSION_2}'
        )

    def test_an_old_submission_naming_its_version_under_another_key(self):
        xml = submission_xml(None).replace(
            '<meta>', f'<_version_>{VERSION_1}</_version_><meta>'
        )

        assert (
            rebuild_form_versions(xml, days_after(FEB), [], DEPLOYED_VERSIONS)
            == VERSION_1
        )

    def test_the_newest_version_named_by_any_key_wins(self):
        """
        Old submissions often carry several version keys with different ids,
        kobotoolbox/kpi#1465. formpack reads the newest deployed one, so this
        does too.
        """

        xml = submission_xml(VERSION_1).replace(
            '<meta>', f'<_version__001>{VERSION_2}</_version__001><meta>'
        )

        assert (
            rebuild_form_versions(xml, days_after(MAR), [], DEPLOYED_VERSIONS)
            == VERSION_2
        )

    def test_a_reversion_id_or_an_alias_resolves_to_its_version(self):
        deployed_versions = [
            {**DEPLOYED_VERSIONS[0], '_reversion_version': 42},
            {**DEPLOYED_VERSIONS[1], 'uid_aliases': ['anOldAlias']},
            DEPLOYED_VERSIONS[2],
        ]

        for legacy_id, expected in (('42', VERSION_1), ('anOldAlias', VERSION_2)):
            xml = submission_xml(None).replace(
                '<meta>', f'<_version_>{legacy_id}</_version_><meta>'
            )
            assert (
                rebuild_form_versions(xml, days_after(MAR), [], deployed_versions)
                == expected
            ), legacy_id

    def test_a_submission_edited_once_a_newer_version_was_deployed(self):
        """
        The history row holds the XML as it was before the edit, and was
        created when the edit came in.
        """

        histories = [(submission_xml(VERSION_1), days_after(FEB))]

        assert (
            rebuild_form_versions(
                submission_xml(VERSION_2),
                days_after(JAN),
                histories,
                DEPLOYED_VERSIONS,
            )
            == f'{VERSION_1} {VERSION_2}'
        )

    def test_successive_edits_accumulate_every_version(self):
        histories = [
            (submission_xml(VERSION_1), days_after(FEB)),
            (submission_xml(VERSION_2), days_after(MAR)),
        ]

        assert (
            rebuild_form_versions(
                submission_xml(VERSION_3),
                days_after(JAN),
                histories,
                DEPLOYED_VERSIONS,
            )
            == f'{VERSION_1} {VERSION_2} {VERSION_3}'
        )

    def test_versions_are_ordered_by_deployment_whatever_the_order_met(self):
        """
        Collected with the newest version, then edited with an older form
        still open in Enketo: the history reads oldest deployed first anyway.
        """

        histories = [(submission_xml(VERSION_3), days_after(MAR, 2))]

        assert (
            rebuild_form_versions(
                submission_xml(VERSION_1),
                days_after(MAR),
                histories,
                DEPLOYED_VERSIONS,
            )
            == f'{VERSION_1} {VERSION_3}'
        )

    def test_what_the_submission_already_records_is_kept(self):
        """
        A version is only ever added. A history the server already wrote may
        name a version nothing else here can account for anymore.
        """

        xml = submission_xml(VERSION_3, form_versions=f'{VERSION_1} {VERSION_3}')
        histories = [(submission_xml(VERSION_2), days_after(MAR))]

        assert (
            rebuild_form_versions(xml, days_after(FEB), histories, DEPLOYED_VERSIONS)
            == f'{VERSION_1} {VERSION_2} {VERSION_3}'
        )

    def test_a_submission_already_up_to_date_records_nothing(self):
        xml = submission_xml(VERSION_1, form_versions=f'{VERSION_1} {VERSION_2}')

        assert (
            rebuild_form_versions(xml, days_after(FEB), [], DEPLOYED_VERSIONS) is None
        )

    def test_a_recorded_version_the_asset_does_not_know_comes_first(self):
        xml = submission_xml(VERSION_2, form_versions=f'{UNKNOWN_VERSION} {VERSION_1}')
        histories = [(submission_xml(VERSION_1), days_after(FEB))]

        assert (
            rebuild_form_versions(xml, days_after(JAN), histories, DEPLOYED_VERSIONS)
            == f'{UNKNOWN_VERSION} {VERSION_1} {VERSION_2}'
        )

    def test_a_declared_version_the_asset_does_not_know_is_kept(self):
        """
        `__version__` alone is trusted as `add_form_versions()` trusts it,
        without checking it against the asset's versions.
        """

        assert (
            rebuild_form_versions(
                submission_xml(UNKNOWN_VERSION), days_after(FEB), [], DEPLOYED_VERSIONS
            )
            == UNKNOWN_VERSION
        )

    def test_a_submission_without_version_received_after_one_records_nothing(self):
        assert (
            rebuild_form_versions(
                submission_xml(None), days_after(FEB), [], DEPLOYED_VERSIONS
            )
            is None
        )


class GetDeployedVersionAtTestCase(SimpleTestCase):

    def test_returns_the_version_deployed_at_that_time(self):
        assert _get_deployed_version_at(DEPLOYED_VERSIONS, days_after(FEB)) == (
            VERSION_2
        )

    def test_a_version_is_deployed_from_its_exact_date(self):
        assert _get_deployed_version_at(DEPLOYED_VERSIONS, FEB) == VERSION_2

    def test_returns_the_latest_once_past_every_deployment(self):
        assert _get_deployed_version_at(DEPLOYED_VERSIONS, days_after(MAR, 100)) == (
            VERSION_3
        )

    def test_returns_none_before_the_first_deployment(self):
        assert _get_deployed_version_at(DEPLOYED_VERSIONS, JAN - timedelta(1)) is None


class FormVersionsRestorerTestCase(TestCase):
    """
    Write the rebuilt history into the submissions that miss it, in
    PostgreSQL and in Mongo, and nothing else.
    """

    def setUp(self):
        self.user = User.objects.create(username='bob')
        UserProfile.objects.get_or_create(user=self.user)

        self.asset = Asset.objects.create(
            owner=self.user,
            content={'survey': [{'type': 'text', 'name': 'q1', 'label': ['Q1']}]},
        )
        self.asset.deploy(backend='mock', active=True)
        self.version_1 = self.asset.latest_deployed_version_uid
        # Saving unchanged content makes no new version
        self.asset.content['survey'][0]['label'] = ['Q1, edited']
        self.asset.save()
        self.asset.deploy(backend='mock')
        self.version_2 = self.asset.latest_deployed_version_uid

        # Deployment dates the submissions below are placed against
        AssetVersion.objects.filter(uid=self.version_1).update(date_modified=JAN)
        AssetVersion.objects.filter(uid=self.version_2).update(date_modified=FEB)

        self.xform = XForm.objects.create(
            xml=xform_xml(),
            user=self.user,
            json=xform_json(self.version_2),
            uuid=FORM_UUID,
            require_auth=False,
            kpi_asset_uid=self.asset.uid,
        )

        # Resolving the project by its uid, which is all the command is given,
        # must land on the form built above rather than on the mock's own
        deployment_data = dict(self.asset._deployment_data)
        deployment_data['backend_response'] = {
            **deployment_data['backend_response'],
            'formid': self.xform.pk,
            'id_string': self.xform.id_string,
        }
        Asset.objects.filter(pk=self.asset.pk).update(_deployment_data=deployment_data)

        # The lock needs a real Redis. Only the keys of this test's own project
        # are removed, never the whole cache
        self.addCleanup(
            cache.delete_many,
            [
                FormVersionsRestorer(self.xform, dry_run=True).cursor_cache_key,
                FormVersionsRestorer(self.xform, dry_run=False).cursor_cache_key,
                FormVersionsRestorer(self.xform).lock_cache_key,
            ],
        )

        class FakeRequest:
            pass

        self.request = FakeRequest()
        self.request.user = self.user
        self.request.user.has_perm = lambda *args, **kwargs: True

    def test_an_offline_submission_gets_only_its_own_version(self):
        instance = self._submit(self.version_1, received_at=days_after(FEB))

        restorer = self._restore()

        assert restorer.updated == 1
        assert get_form_versions(self._xml(instance)) == self.version_1
        assert self._mongo_form_versions(instance) == self.version_1

    def test_an_edited_submission_gets_both_versions(self):
        instance = self._submit(self.version_2, received_at=days_after(JAN))
        self._add_history(instance, self.version_1, edited_at=days_after(FEB))

        self._restore()

        assert get_form_versions(self._xml(instance)) == (
            f'{self.version_1} {self.version_2}'
        )

    def test_a_submission_of_a_single_version_is_left_alone(self):
        instance = self._submit(self.version_1, received_at=days_after(JAN))
        xml = self._xml(instance)

        restorer = self._restore()

        assert restorer.updated == 0
        assert self._xml(instance) == xml
        assert self._mongo_form_versions(instance) is None

    def test_the_write_leaves_the_hash_and_the_dates_alone(self):
        """
        This is not an edit: nothing a client sent changes, so neither does
        what identifies it, nor when it was last modified.
        """

        instance = self._submit(self.version_1, received_at=days_after(FEB))
        before = Instance.objects.values('xml_hash', 'date_modified').get(
            pk=instance.pk
        )

        self._restore()

        after = Instance.objects.values('xml_hash', 'date_modified').get(pk=instance.pk)
        assert after == before

    def test_a_dry_run_writes_nothing(self):
        instance = self._submit(self.version_1, received_at=days_after(FEB))
        xml = self._xml(instance)

        restorer = self._restore(dry_run=True)

        assert restorer.updated == 1
        assert self._xml(instance) == xml
        assert self._mongo_form_versions(instance) is None

    def test_a_second_run_changes_nothing(self):
        instance = self._submit(self.version_1, received_at=days_after(FEB))
        self._restore()
        xml = self._xml(instance)

        restorer = self._restore()

        assert restorer.updated == 0
        assert self._xml(instance) == xml

    def test_a_form_deployed_once_is_not_walked(self):
        AssetVersion.objects.filter(uid=self.version_2).update(deployed=False)
        self._submit(self.version_1, received_at=days_after(FEB))

        restorer = self._restore()

        assert restorer.completed
        assert restorer.scanned == 0

    def test_an_unreadable_submission_is_skipped_not_fatal(self):
        broken = self._submit(self.version_1, received_at=days_after(FEB))
        Instance.objects.filter(pk=broken.pk).update(xml='<not-xml')
        instance = self._submit(
            self.version_1,
            received_at=days_after(FEB),
            instance_id='uuid:55d873b2-3a25-4370-8cd9-c41ed4156d08',
        )

        restorer = self._restore()

        assert restorer.completed
        assert restorer.updated == 1
        assert get_form_versions(self._xml(instance)) == self.version_1

    def test_a_second_run_on_the_same_project_is_refused(self):
        instance = self._submit(self.version_1, received_at=days_after(FEB))

        holder = FormVersionsRestorer(self.xform, dry_run=False)
        assert holder._acquire_lock()

        with self.assertRaises(ProjectAlreadyBeingRestoredError):
            self._restore()

        assert get_form_versions(self._xml(instance)) is None
        holder._release_lock()

    def test_the_cursor_resumes_where_an_interrupted_run_stopped(self):
        instance = self._submit(self.version_1, received_at=days_after(FEB))

        restorer = FormVersionsRestorer(self.xform, dry_run=False)
        # As if a run walking newest first had been interrupted just below
        # this submission
        cache.set(restorer.cursor_cache_key, instance.pk, timeout=None)

        restorer.run()

        assert get_form_versions(self._xml(instance)) is None
        # Reaching the end clears the cursor, so the next run starts over
        assert cache.get(restorer.cursor_cache_key) is None

    def test_the_command_writes_nothing_unless_it_is_asked_to(self):
        instance = self._submit(self.version_1, received_at=days_after(FEB))

        call_command(
            'restore_formversions_in_submissions',
            asset_uid=self.asset.uid,
            verbosity=0,
        )

        assert get_form_versions(self._xml(instance)) is None

        call_command(
            'restore_formversions_in_submissions',
            asset_uid=self.asset.uid,
            dry_run=False,
            verbosity=0,
        )

        assert get_form_versions(self._xml(instance)) == self.version_1

    def _add_history(self, instance: Instance, version_uid: str, edited_at: datetime):
        """
        Leave the trace an edit leaves: the XML as it was before the edit,
        created when the edit came in.
        """

        history = InstanceHistory.objects.create(
            xform_instance=instance,
            xml=submission_xml(version_uid),
            uuid=instance.uuid,
        )
        InstanceHistory.objects.filter(pk=history.pk).update(date_created=edited_at)

    def _mongo_form_versions(self, instance: Instance) -> str | None:
        document = settings.MONGO_DB.instances.find_one({'_id': instance.pk})

        return document.get(common_tags.META_FORM_VERSIONS)

    def _restore(self, dry_run: bool = False) -> FormVersionsRestorer:
        restorer = FormVersionsRestorer(self.xform, dry_run=dry_run)
        restorer.run()

        return restorer

    def _submit(
        self,
        version_uid: str,
        received_at: datetime,
        instance_id: str = 'uuid:55d873b2-3a25-4370-8cd9-c41ed4156d07',
    ) -> Instance:
        """
        Store a submission the way the server did before it recorded form
        versions: the XML as the client sent it, received at `received_at`.
        """

        xml = submission_xml(version_uid, instance_id=instance_id)
        instance = create_instance(
            self.user.username,
            io.BytesIO(xml.encode()),
            media_files=[],
            request=self.request,
            check_usage_limits=False,
        )
        Instance.objects.filter(pk=instance.pk).update(
            xml=xml, date_created=received_at
        )
        settings.MONGO_DB.instances.update_one(
            {'_id': instance.pk}, {'$unset': {common_tags.META_FORM_VERSIONS: ''}}
        )

        return instance

    def _xml(self, instance: Instance) -> str:
        return Instance.objects.values_list('xml', flat=True).get(pk=instance.pk)
