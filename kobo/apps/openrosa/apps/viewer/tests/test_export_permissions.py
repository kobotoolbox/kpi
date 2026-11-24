from ddt import data, ddt
from django.contrib.auth.models import AnonymousUser
from django.urls import reverse

from kobo.apps.openrosa.apps.logger.models import XForm
from kobo.apps.openrosa.apps.main.models import UserProfile
from kobo.apps.openrosa.apps.main.tests.test_base import TestBase
from kobo.apps.openrosa.apps.viewer.models.export import Export
from kobo.apps.openrosa.apps.viewer.views import (
    create_export,
    delete_export,
    export_download,
    export_list,
    export_progress,
)
from kobo.apps.openrosa.libs.utils.export_tools import generate_export
from kpi.constants import (
    PERM_CHANGE_ASSET,
    PERM_PARTIAL_SUBMISSIONS,
    PERM_VIEW_ASSET,
    PERM_VIEW_SUBMISSIONS,
)
from kpi.deployment_backends.kc_access.storage import (
    default_kobocat_storage as default_storage,
)
from kpi.utils.storage import is_filesystem_storage


@ddt
class TestExportPermissions(TestBase):

    def setUp(self):
        super().setUp()
        self._publish_transportation_form_and_submit_instance()
        self.asset = self.xform.asset
        self.export = generate_export(
            Export.CSV_EXPORT, 'csv', self.user.username, self.xform.id_string
        )
        self.alice = self._create_user('alice', 'alice')
        UserProfile.objects.get_or_create(user_id=self.alice.pk)
        self.alice_client = self._login('alice', 'alice')

    def test_anonymous_users_can_access_exports_of_public_data(self):
        self.asset.assign_perm(AnonymousUser(), PERM_VIEW_SUBMISSIONS)

        responses = self._get_read_responses(self.anon)

        assert responses['list'].status_code == 200
        assert responses['progress'].status_code == 200
        assert responses['download'].status_code == self._download_status_code()

    def test_anonymous_users_cannot_access_exports_of_public_form(self):
        self.asset.assign_perm(AnonymousUser(), PERM_VIEW_ASSET)

        responses = self._get_read_responses(self.anon)

        assert responses['list'].status_code == 403
        assert responses['progress'].status_code == 403
        assert responses['download'].status_code == 403

    def test_delete_export_only_deletes_exports_of_the_form(self):
        other_xform = self._publish_xls_file(self._fixture_path('gps', 'gps.xls'))
        other_xform.asset.assign_perm(self.alice, PERM_VIEW_SUBMISSIONS)
        url = reverse(
            delete_export,
            kwargs={
                'username': self.user.username,
                'id_string': other_xform.id_string,
                'export_type': Export.CSV_EXPORT,
            },
        )

        response = self.alice_client.post(url, {'export_id': self.export.pk})

        assert response.status_code == 404
        assert Export.objects.filter(pk=self.export.pk).exists()

    def test_export_views_allow_users_with_view_submissions(self):
        self.asset.assign_perm(self.alice, PERM_VIEW_SUBMISSIONS)

        responses = self._get_read_responses(self.alice_client)
        create_response = self.alice_client.post(self._get_url(create_export))

        assert responses['list'].status_code == 200
        assert responses['progress'].status_code == 200
        assert responses['download'].status_code == self._download_status_code()
        assert create_response.status_code == 302
        assert Export.objects.filter(xform=self.xform).count() == 2

        delete_response = self.alice_client.post(
            self._get_url(delete_export), {'export_id': self.export.pk}
        )

        assert delete_response.status_code == 302
        assert not Export.objects.filter(pk=self.export.pk).exists()

    def test_export_views_deny_users_of_public_form(self):
        self.asset.assign_perm(AnonymousUser(), PERM_VIEW_ASSET)
        self._assert_export_views_denied(self.alice_client)

    def test_export_views_deny_users_with_partial_permissions(self):
        self.asset.assign_perm(
            self.alice,
            PERM_PARTIAL_SUBMISSIONS,
            partial_perms={
                PERM_VIEW_SUBMISSIONS: [{'_submitted_by': self.alice.username}]
            },
        )
        self._assert_export_views_denied(self.alice_client)

    @data(PERM_VIEW_ASSET, PERM_CHANGE_ASSET)
    def test_export_views_deny_users_without_submission_permissions(self, perm):
        self.asset.assign_perm(self.alice, perm)
        self._assert_export_views_denied(self.alice_client)

    def test_export_views_ignore_stale_sharing_flags(self):
        XForm.objects.filter(pk=self.xform.pk).update(shared=True, shared_data=True)

        self._assert_export_views_denied(self.alice_client)
        responses = self._get_read_responses(self.anon)

        assert responses['list'].status_code == 403
        assert responses['progress'].status_code == 403
        assert responses['download'].status_code == 403

    def _assert_export_views_denied(self, client):
        responses = self._get_read_responses(client)
        create_response = client.post(self._get_url(create_export))
        delete_response = client.post(
            self._get_url(delete_export), {'export_id': self.export.pk}
        )

        assert responses['list'].status_code == 403
        assert responses['progress'].status_code == 403
        assert responses['download'].status_code == 403
        assert create_response.status_code == 403
        assert delete_response.status_code == 403
        assert list(
            Export.objects.filter(xform=self.xform).values_list('pk', flat=True)
        ) == [self.export.pk]

    def _download_status_code(self):
        return 200 if is_filesystem_storage(default_storage) else 302

    def _get_read_responses(self, client):
        return {
            'list': client.get(self._get_url(export_list)),
            'progress': client.get(
                self._get_url(export_progress), {'export_ids': [self.export.pk]}
            ),
            'download': client.get(
                self._get_url(export_download, filename=self.export.filename)
            ),
        }

    def _get_url(self, view, **kwargs):
        return reverse(
            view,
            kwargs={
                'username': self.user.username,
                'id_string': self.xform.id_string,
                'export_type': Export.CSV_EXPORT,
                **kwargs,
            },
        )
