import pytest
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.test import TestCase

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.main.models import MetaData
from kpi.deployment_backends.kc_access.storage import (
    default_kobocat_storage,
)
from kpi.exceptions import DeploymentDataException
from kpi.models.asset import Asset, AssetFile
from kpi.models.asset_version import AssetVersion
from kpi.utils.storage import is_filesystem_storage
from kpi.utils.submission import get_attachment_filenames_and_xpaths


class CreateDeployment(TestCase):
    def setUp(self):
        someuser = User.objects.create(username='someuser')
        self.asset = Asset(
            content={'survey': [{'type': 'text', 'name': 'q1', 'label': 'Q1.'}]},
            owner=someuser,
        )

    def test_invalid_backend_fails(self):
        self.asset.save()

        def _bad_deployment():
            self.asset.connect_deployment(backend='nonexistent')
        self.assertRaises(KeyError, _bad_deployment)

    def test_mock_deployment_inits(self):
        self.asset.save()
        _uid = self.asset.uid
        self.asset.connect_deployment(backend='mock')
        self.assertEqual(self.asset.deployment.backend, 'mock')


@pytest.mark.django_db
def test_initial_kuids():
    initial_kuid = 'aaaa1111'
    someuser = User.objects.create(username='someuser')
    asset = Asset.objects.create(
        content={
            'survey': [
                {
                    'type': 'text',
                    'name': 'q1',
                    'label': 'Q1.',
                    '$kuid': initial_kuid,
                }
            ]
        },
        owner=someuser,
    )
    assert asset.content['survey'][0]['$kuid'] == initial_kuid

    asset.deploy(backend='mock', active=False)
    asset.save()
    assert '$kuid' in asset.content['survey'][0]
    second_kuid = asset.content['survey'][0]['$kuid']
    assert asset.content['survey'][0]['$kuid'] == initial_kuid


class MockDeployment(TestCase):
    def setUp(self):
        someuser = User.objects.create(username='someuser')
        self.asset = Asset.objects.create(
            content={'survey': [{'type': 'text', 'name': 'q1', 'label': 'Q1.'}]},
            owner=someuser,
        )
        self.asset.deploy(backend='mock', active=False)
        self.asset.save()

    def test_deployment_starts_out_inactive(self):
        self.assertEqual(self.asset.deployment.active, False)

    def test_set_active(self):
        self.asset.deployment.set_active(True)
        self.asset.save()
        self.assertEqual(self.asset.deployment.active, True)

        self.asset.deployment.set_active(False)
        self.asset.save()
        self.assertEqual(self.asset.deployment.active, False)

    def test_redeploy(self):
        av_count_0 = AssetVersion.objects.count()
        _v1_uid = self.asset.latest_version.uid
        self.asset.deployment.set_active(True)
        av_count_1 = AssetVersion.objects.count()
        _v2_uid = self.asset.latest_version.uid

        # version should not have changed

        self.assertEqual(av_count_0, av_count_1)
        self.assertEqual(_v1_uid, _v2_uid)
        # self.assertEqual(self.asset.latest_deployed_version.uid, _v2_uid)

        self.asset.deployment.set_active(False)
        self.assertEqual(self.asset.deployment.active, False)

    def test_delete(self):
        self.assertTrue(self.asset.has_deployment)
        self.asset.deployment.delete()
        self.assertFalse(self.asset.has_deployment)

    def test_get_not_mutable_deployment_data(self):
        deployment_data = self.asset.deployment.get_data()
        original_version = deployment_data['version']
        deployment_data['version'] = 'undefined_version'
        # self.asset._deployment_data should have been touched

        # Check that original identifier still the same
        self.assertEqual(self.asset.deployment.version_id, original_version)

        # Check that identifier has not been altered in deployment data
        other_deployment_data = self.asset.deployment.get_data()
        self.assertEqual(other_deployment_data['version'], original_version)

    def test_save_to_db_with_quote(self):
        new_key = 'dummy'
        new_value = "I'm in love with Apostrophe"
        self.asset.deployment.save_to_db({new_key: new_value})
        self.asset.refresh_from_db()
        self.assertEqual(self.asset.deployment.get_data(new_key), new_value)

    def test_save_to_db_without_date_modified(self):
        last_modified = self.asset.date_modified
        self.asset.deployment.save_to_db({'key': 'value'}, update_date_modified=False)
        self.asset.refresh_from_db()
        self.assertEqual(self.asset.date_modified, last_modified)

    def test_save_to_db_with_date_modified(self):
        last_modified = self.asset.date_modified
        self.asset.deployment.save_to_db({'key': 'value'})
        self.asset.refresh_from_db()
        self.assertGreater(self.asset.date_modified, last_modified)

    def test_save_data(self):

        deployment_data = self.asset.deployment.get_data()
        self.asset._deployment_data['direct_access'] = True  # noqa
        # We should not be able to save asset when `_deployment_data` has been
        # altered directly
        with self.assertRaises(DeploymentDataException) as e:
            self.asset.save()

        self.asset.refresh_from_db()
        self.assertEqual(self.asset._deployment_data, deployment_data)

        # Using the deployment should work
        self.asset.deployment.store_data({'direct_access': True})
        self.assertTrue('_stored_data_key' in self.asset._deployment_data)
        self.asset.save()
        self.assertFalse('_stored_data_key' in self.asset._deployment_data)
        self.asset.refresh_from_db()
        self.assertFalse('_stored_data_key' in self.asset._deployment_data)
        self.assertNotEqual(self.asset._deployment_data, deployment_data)  # noqa
        self.assertTrue(self.asset._deployment_data['direct_access'])  # noqa

    def test_save_data_with_deferred_fields(self):
        # It should work with deferred fields too
        asset = Asset.objects.only('uid').get(id=self.asset.pk)
        asset._deployment_data = {'overwrite_all': True}  # noqa
        # Hidden field copy has not been set yet
        self.assertTrue(asset._Asset__deployment_data_copy is None)  # noqa
        # We should not be able to save asset when `_deployment_data` has been
        # altered directly
        with self.assertRaises(DeploymentDataException) as e:
            asset.save()

    def test_sync_media_files(self):

        asset_file = AssetFile(
            asset=self.asset,
            user=self.asset.owner,
            file_type=AssetFile.FORM_MEDIA,
        )
        asset_file.content = ContentFile(b'foo', name='foo.txt')
        asset_file.save()
        assert (
            MetaData.objects.filter(xform=self.asset.deployment.xform).count()
            == 0
        )
        meta_data = None
        try:
            self.asset.deployment.sync_media_files()
            assert (
                MetaData.objects.filter(
                    xform=self.asset.deployment.xform
                ).count()
                == 1
            )
            meta_data = MetaData.objects.filter(
                xform=self.asset.deployment.xform
            ).first()

            assert default_kobocat_storage.exists(str(meta_data.data_file))
            if is_filesystem_storage(default_storage):
                assert not default_storage.exists(str(meta_data.data_file))

            with default_kobocat_storage.open(
                str(meta_data.data_file), 'r'
            ) as f:
                assert f.read() == 'foo'
        finally:
            # Clean-up
            if meta_data:
                data_file_path = str(meta_data.data_file)
                meta_data.delete()
                if default_kobocat_storage.exists(data_file_path):
                    default_kobocat_storage.delete(data_file_path)


class QuestionXPathLookup(TestCase):
    """
    Which name an attachment is hung on its question by.
    """

    def setUp(self):
        someuser = User.objects.create(username='someuser')
        self.asset = Asset.objects.create(
            content={'survey': [{'type': 'text', 'name': 'q1', 'label': 'Q1.'}]},
            owner=someuser,
        )
        self.asset.deploy(backend='mock', active=True)
        self.asset.save()

        # What `get_attachment_filenames_and_xpaths()` builds out of the
        # submission: the names it carries at its media questions
        self.filenames_and_xpaths = {'holiday.jpg': 'q1'}

    def test_a_suffixed_path_resolves_through_the_name_the_client_sent(self):
        """
        Django appends a suffix to avoid a collision on the storage, so the
        stored path is not the name the submission carries. Around a million
        rows on production are in that state.
        """

        question_xpath = self.asset.deployment._get_question_xpath(
            {
                'filename': 'someuser/attachments/uuid/uuid/holiday_MtYT6pg.jpg',
                'media_file_basename': 'holiday.jpg',
            },
            self.filenames_and_xpaths,
        )

        assert question_xpath == 'q1'

    def test_a_name_ending_in_a_suffix_is_not_mistaken_for_its_neighbour(self):
        """
        `_without_suffix()` cannot tell a suffix Django added from a name that
        legitimately ends in one, and would hand this file to `holiday.jpg`.
        The exact match on the name the client sent is tried first, so the
        heuristic is only ever reached once it has failed.
        """

        filenames_and_xpaths = get_attachment_filenames_and_xpaths(
            {'q1': 'holiday.jpg', 'q2': 'holiday_MtYT6pg.jpg'}, ['q1', 'q2']
        )

        question_xpath = self.asset.deployment._get_question_xpath(
            {
                'filename': 'someuser/attachments/uuid/uuid/holiday_MtYT6pg.jpg',
                'media_file_basename': 'holiday_MtYT6pg.jpg',
            },
            filenames_and_xpaths,
        )

        assert question_xpath == 'q2'

    def test_an_unsanitized_name_resolves_without_a_round_trip(self):
        """
        The column holds the name before Django touched it, spaces included,
        while the sanitized keys turn those into underscores. Keying the raw
        form is what lets the two meet without both sides throwing the same
        detail away first.
        """

        filenames_and_xpaths = get_attachment_filenames_and_xpaths(
            {'q1': 'Screenshot 2024 at 18.31.jpg'}, ['q1']
        )

        question_xpath = self.asset.deployment._get_question_xpath(
            {
                'filename': (
                    'someuser/attachments/uuid/uuid/Screenshot_2024_at_18.31.jpg'
                ),
                'media_file_basename': 'Screenshot 2024 at 18.31.jpg',
            },
            filenames_and_xpaths,
        )

        assert question_xpath == 'q1'

    def test_two_names_sanitizing_alike_stay_on_their_own_questions(self):
        """
        The shape this change exists for. `get_valid_name()` turns both of
        these into `photo_A.jpg`, so a single key was left for two questions
        and the file of whichever was read first followed the other one.

        Both reading orders are tried, because keying the raw name is only half
        of it: the raw and sanitized families have to be merged with the raw
        one winning, or the question read last takes the shared key and one
        file goes with it.
        """

        for values in (
            {'q1': 'photo A.jpg', 'q2': 'photo_A.jpg'},
            {'q2': 'photo_A.jpg', 'q1': 'photo A.jpg'},
        ):
            filenames_and_xpaths = get_attachment_filenames_and_xpaths(
                values, ['q1', 'q2']
            )

            assert (
                self.asset.deployment._get_question_xpath(
                    {
                        'filename': 'someuser/attachments/uuid/uuid/photo_A.jpg',
                        'media_file_basename': 'photo A.jpg',
                    },
                    filenames_and_xpaths,
                )
                == 'q1'
            )

            # Its own name was taken on the storage by the file above, hence
            # the collision suffix on the path
            assert (
                self.asset.deployment._get_question_xpath(
                    {
                        'filename': (
                            'someuser/attachments/uuid/uuid/photo_A_XyZ1234.jpg'
                        ),
                        'media_file_basename': 'photo_A.jpg',
                    },
                    filenames_and_xpaths,
                )
                == 'q2'
            )

    def test_a_backfilled_row_carrying_a_suffix_still_resolves(self):
        """
        `populate_media_file_basename` copied the stored path's last segment
        into the column, collision suffix included, so those rows need the same
        `_without_suffix()` fallback as the ones holding nothing at all.
        """

        filenames_and_xpaths = get_attachment_filenames_and_xpaths(
            {'q1': 'holiday.jpg'}, ['q1']
        )

        question_xpath = self.asset.deployment._get_question_xpath(
            {
                'filename': 'someuser/attachments/uuid/uuid/holiday_MtYT6pg.jpg',
                'media_file_basename': 'holiday_MtYT6pg.jpg',
            },
            filenames_and_xpaths,
        )

        assert question_xpath == 'q1'

    def test_a_row_predating_the_column_still_resolves_on_its_path(self):
        """
        2,395,614 rows hold no `media_file_basename`, a set that cannot grow
        since `save_attachments()` always populates it.
        """

        question_xpath = self.asset.deployment._get_question_xpath(
            {
                'filename': 'someuser/attachments/uuid/uuid/holiday_MtYT6pg.jpg',
                'media_file_basename': None,
            },
            self.filenames_and_xpaths,
        )

        assert question_xpath == 'q1'

    def test_a_decomposed_name_resolves_against_the_real_keys(self):
        """
        `get_valid_name()` drops combining marks, so a decomposed name survives
        only in the forms `get_attachment_filenames_and_xpaths()` keys beside
        the sanitized ones. Build the keys with it rather than by hand, so
        dropping one of them shows up here.
        """

        decomposed = 'Guérisseur.jpg'
        filenames_and_xpaths = get_attachment_filenames_and_xpaths(
            {'q1': decomposed}, ['q1']
        )

        question_xpath = self.asset.deployment._get_question_xpath(
            {
                'filename': f'someuser/attachments/uuid/uuid/{decomposed}',
                'media_file_basename': decomposed,
            },
            filenames_and_xpaths,
        )

        assert question_xpath == 'q1'
