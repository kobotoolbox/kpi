# coding: utf-8
import base64
import copy
import dateutil.parser
import json
import os
from io import StringIO

from django.contrib.auth.models import User
from django.urls import reverse
from django.utils import timezone
from rest_framework import status

from kobo.apps.project_views.models.project_view import ProjectView
from kpi.constants import (
    PERM_CHANGE_ASSET,
    PERM_CHANGE_METADATA_ASSET,
    PERM_MANAGE_ASSET,
    PERM_PARTIAL_SUBMISSIONS,
    PERM_VIEW_ASSET,
    PERM_VIEW_SUBMISSIONS,
)
from kpi.models import Asset, AssetFile, AssetVersion
from kpi.models.asset import AssetDeploymentStatus
from kpi.serializers.v2.asset import AssetListSerializer
from kpi.tests.base_test_case import (
    BaseAssetDetailTestCase,
    BaseAssetTestCase,
    BaseTestCase,
)
from kpi.tests.kpi_test_case import KpiTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE
from kpi.utils.hash import calculate_hash
from kpi.utils.object_permission import get_anonymous_user
from kpi.utils.project_views import (
    get_region_for_view,
)


class AssetListApiTests(BaseAssetTestCase):
    fixtures = ['test_data']

    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        self.client.login(username='someuser', password='someuser')
        self.list_url = reverse(self._get_endpoint('asset-list'))

    def test_login_as_other_users(self):
        self.login_as_other_user(username='admin', password='pass')
        self.login_as_other_user(username='anotheruser', password='anotheruser')
        self.client.logout()

    def test_create_asset(self):
        """
        Ensure we can create a new asset
        """
        self.create_asset()

    def test_delete_asset(self):
        self.client.logout()
        self.client.login(username='anotheruser', password='anotheruser')
        creation_response = self.create_asset()
        asset_url = creation_response.data['url']
        response = self.client.delete(asset_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK,
                         msg=response.data)

    def test_asset_list_matches_detail(self):
        detail_response = self.create_asset()
        list_response = self.client.get(self.list_url)
        self.assertEqual(list_response.status_code, status.HTTP_200_OK,
                         msg=list_response.data)
        expected_list_data = {
            field: detail_response.data[field]
            for field in AssetListSerializer.Meta.fields if field != 'children'
        }
        # list endpoint only exposes children count.
        expected_list_data['children'] = {
            'count': detail_response.data['children']['count']
        }

        list_result_detail = None
        for result in list_response.data['results']:
            if result['uid'] == expected_list_data['uid']:
                list_result_detail = result
                break
        self.assertIsNotNone(list_result_detail)
        self.assertDictEqual(expected_list_data, dict(list_result_detail))

    def test_assets_hash(self):
        another_user = User.objects.get(username="anotheruser")
        user_asset = Asset.objects.get(pk=1)
        user_asset.save()
        user_asset.assign_perm(another_user, "view_asset")

        self.client.logout()
        self.client.login(username="anotheruser", password="anotheruser")
        creation_response = self.create_asset()

        another_user_asset = another_user.assets.last()
        another_user_asset.save()

        versions_ids = [
            user_asset.version_id,
            another_user_asset.version_id
        ]
        versions_ids.sort()
        expected_hash = calculate_hash(''.join(versions_ids))
        hash_url = reverse("asset-hash")
        hash_response = self.client.get(hash_url)
        self.assertEqual(hash_response.data.get("hash"), expected_hash)

    def test_assets_search_query(self):
        someuser = User.objects.get(username='someuser')
        question = Asset.objects.create(
            owner=someuser,
            name='question',
            asset_type='question',
            content={'name': 'haiku', 'type': 'text', 'label': 'i like haiku'},
        )
        template = Asset.objects.create(
            owner=someuser,
            name='template',
            asset_type='template',
            content={
                'survey': [
                    {
                        'name': 'zeppelin',
                        'type': 'select_one',
                        'label': 'put on some zeppelin 🧀🧀🧀',
                        'select_from_list_name': 'choicelist',
                    }
                ],
                'choices': [
                    {
                        'name': 'cheese',
                        'label': 'eat cheddar cheese',
                        'list_name': 'choicelist',
                    },
                    {
                        'name': 'dance',
                        'label': 'watch me dance',
                        'list_name': 'choicelist',
                    },
                ],
            },
        )
        survey = Asset.objects.create(
            owner=someuser,
            name='survey',
            asset_type='survey',
            content={
                'survey': [
                    {
                        'name': 'egg',
                        'type': 'integer',
                        'label': 'hard boiled eggs',
                    }
                ],
            },
        )

        def uids_from_search_results(query):
            return [
                r['uid']
                for r in self.client.get(self.list_url, data={'q': query}).data[
                    'results'
                ]
            ]

        results = uids_from_search_results('eggs OR zeppelin')
        # default sort is newest first
        self.assertListEqual(results, [survey.uid, template.uid])

        results = uids_from_search_results(
            'asset_type:question OR asset_type:template'
        )
        self.assertListEqual(results, [template.uid, question.uid])

        results = uids_from_search_results('🧀🧀🧀')
        self.assertListEqual(results, [template.uid])

        results = uids_from_search_results('pk:alrighty')
        self.assertListEqual(results, [])

    def test_assets_ordering(self):

        someuser = User.objects.get(username='someuser')
        question = Asset.objects.create(
            owner=someuser,
            name='A question',
            asset_type='question',
        )
        collection = Asset.objects.create(
            owner=someuser,
            name='Ze French collection',
            asset_type='collection',
        )
        template = Asset.objects.create(
            owner=someuser,
            name='My template',
            asset_type='template',
            content={},
        )
        deployed_survey = Asset.objects.create(
            owner=someuser,
            name='Deployed survey',
            asset_type='survey',
        )
        deployed_survey.deploy(backend='mock', active=True)

        other_deployed_survey = Asset.objects.create(
            owner=someuser,
            name='Other deployed survey',
            asset_type='survey',
        )
        other_deployed_survey.deploy(backend='mock', active=True)

        archived_survey = Asset.objects.create(
            owner=someuser,
            name='Archived survey',
            asset_type='survey',
        )
        archived_survey.deploy(backend='mock', active=False)

        draft_survey = Asset.objects.create(
            owner=someuser,
            name='Draft survey',
            asset_type='survey',
        )

        another_collection = Asset.objects.create(
            owner=someuser,
            name='Someuser’s collection',
            asset_type='collection',
        )

        def uids_from_results(params: dict = None):
            return [
                r['uid']
                for r in self.client.get(self.list_url, data=params).data[
                    'results'
                ]
            ]

        # Default is by deployment_status (deployed, draft, archived), then
        # date_modified desc
        expected_default_order = [
            other_deployed_survey.uid,
            deployed_survey.uid,
            draft_survey.uid,
            archived_survey.uid,
            another_collection.uid,
            template.uid,
            collection.uid,
            question.uid,
        ]

        uids = uids_from_results()
        assert expected_default_order == uids

        # Sorted by name asc
        expected_order_by_name = [
            question.uid,
            archived_survey.uid,
            deployed_survey.uid,
            draft_survey.uid,
            template.uid,
            other_deployed_survey.uid,
            another_collection.uid,
            collection.uid,
        ]

        uids = uids_from_results({'ordering': 'name'})
        assert expected_order_by_name == uids

        # Sorted by name asc but collections first
        expected_order_by_name_collections_first = [
            another_collection.uid,
            collection.uid,
            question.uid,
            archived_survey.uid,
            deployed_survey.uid,
            draft_survey.uid,
            template.uid,
            other_deployed_survey.uid,
        ]
        uids = uids_from_results({
            'collections_first': 'true',
            'ordering': 'name',
        })
        assert expected_order_by_name_collections_first == uids


class AssetProjectViewListApiTests(BaseAssetTestCase):
    fixtures = ['test_data']

    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        self.client.login(username='someuser', password='someuser')
        self.asset_list_url = reverse(self._get_endpoint('asset-list'))
        self.region_views_url = reverse(self._get_endpoint('projectview-list'))
        asset_country_settings = [
            [
                {'value': 'ZAF', 'label': 'South Africa'},
            ],
            [
                {'value': 'CAN', 'label': 'Canada'},
            ],
        ]
        for i, asset in enumerate(Asset.objects.all()[:2]):
            asset.settings.update({'country': asset_country_settings[i]})
            asset.content = {
                'survey': [
                    {
                        'type': 'text',
                        'name': 'q1',
                        'label': 'q1',
                    },
                ],
            }
            asset.save()
            asset.deploy(backend='mock', active=True)

        regional_assignments = [
            {
                'pk': 1,
                'name': 'Overview',
                'countries': '*',
                'permissions': [
                    PERM_VIEW_ASSET,
                ],
                'users': ['someuser'],
            },
            {
                'pk': 2,
                'name': 'Test view 1',
                'countries': 'ZAF, NAM, ZWE, MOZ, BWA, LSO',
                'permissions': [
                    PERM_VIEW_ASSET,
                    PERM_VIEW_SUBMISSIONS,
                    PERM_CHANGE_METADATA_ASSET,
                ],
                'users': ['someuser', 'anotheruser'],
            },
            {
                'pk': 3,
                'name': 'Test view 2',
                'countries': 'USA, CAN',
                'permissions': [
                    PERM_VIEW_ASSET,
                ],
                'users': ['anotheruser'],
            },
        ]
        for region in regional_assignments:
            usernames = region.pop('users')
            users = [self._get_user_obj(u) for u in usernames]
            r = ProjectView.objects.create(**region)
            r.users.set(users)
            r.save()

    def _login_as_anotheruser(self) -> None:
        self.client.logout()
        self.client.login(username='anotheruser', password='anotheruser')

    @staticmethod
    def _get_user_obj(username: str) -> User:
        return User.objects.get(username=username)

    def test_regional_views_list(self):
        res = self.client.get(self.region_views_url)
        data = res.json()
        # someuser should only see view Overview and 1
        assert data['count'] == 2
        assert sorted(r['name'] for r in data['results']) == sorted(
            ['Overview', 'Test view 1']
        )

        self._login_as_anotheruser()
        res = self.client.get(self.region_views_url)
        data = res.json()
        # anotheruser should only see view 1 and 2
        assert data['count'] == 2
        assert sorted(r['name'] for r in data['results']) == sorted(
            ['Test view 1', 'Test view 2']
        )

    def test_project_views_for_someuser(self):
        res = self.client.get(self.region_views_url)
        data = res.json()
        results = data['results']

        view_0_url = results[0]['assets']
        regional_res = self.client.get(
            view_0_url, HTTP_ACCEPT='application/json'
        )
        assert regional_res.json()['count'] == 2

        view_1_url = results[1]['assets']
        regional_res = self.client.get(
            view_1_url, HTTP_ACCEPT='application/json'
        )
        regional_data = regional_res.json()
        assert regional_data['count'] == 1
        asset_countries = set(
            c['value']
            for c in regional_data['results'][0]['settings']['country']
        )
        region_for_view = set(get_region_for_view(results[1]['uid']))
        assert asset_countries & region_for_view

    def test_project_views_anotheruser_submission_count(self):
        self._login_as_anotheruser()
        for asset in Asset.objects.all():
            if asset.has_deployment:
                submissions = [
                    {
                        '__version__': asset.latest_deployed_version.uid,
                        'q1': 'a1',
                    },
                ]
                asset.deployment.mock_submissions(submissions)

        res = self.client.get(self.region_views_url)
        data = res.json()
        results = data['results']

        view_1_url = results[0]['assets']
        regional_res = self.client.get(
            view_1_url, HTTP_ACCEPT='application/json'
        )
        regional_data = regional_res.json()
        asset = regional_data['results'][0]
        assert asset['deployment__submission_count'] == 1

        # Ensure user can see submissions count from the asset detail endpoint too
        asset_detail_response = self.client.get(
            asset['url'], HTTP_ACCEPT='application/json'
        )
        assert asset_detail_response.data['deployment__submission_count'] == 1

    def test_project_views_for_anotheruser(self):
        self._login_as_anotheruser()
        res = self.client.get(self.region_views_url)
        data = res.json()
        results = data['results']

        expected_vals = [
            {'name': 'Test view 1', 'count': 1},
            {'name': 'Test view 2', 'count': 1},
        ]

        for i, item in enumerate(expected_vals):
            regional_res = self.client.get(
                results[i]['assets'], HTTP_ACCEPT='application/json'
            )
            regional_data = regional_res.json()
            assert regional_data['count'] == item['count']
            asset_countries = set(
                c['value']
                for c in regional_data['results'][0]['settings']['country']
            )
            region_for_view = set(get_region_for_view(results[i]['uid']))
            assert asset_countries & region_for_view

    def test_project_views_for_someuser_can_view_submissions(self):
        res = self.client.get(self.region_views_url)
        data = res.json()
        results = data['results']

        # someuser can see data for view 1
        regional_res = self.client.get(
            results[1]['assets'], HTTP_ACCEPT='application/json'
        )
        asset_data = regional_res.json()['results'][0]
        assert asset_data['uid']

        url = reverse(
            self._get_endpoint('submission-list'), args=(asset_data['uid'],)
        )
        data_res = self.client.get(url, HTTP_ACCEPT='application/json')
        assert data_res.status_code == status.HTTP_200_OK

    def test_project_views_for_anotheruser_can_view_asset_detail(self):
        self._login_as_anotheruser()
        user = User.objects.get(username='anotheruser')
        res = self.client.get(self.region_views_url)
        data = res.json()
        results = data['results']

        regional_res = self.client.get(
            results[0]['assets'], HTTP_ACCEPT='application/json'
        )
        asset_data = regional_res.json()['results'][0]
        # check that anotheruser isn't the asset's owner
        assert asset_data['owner__username'] != user.username
        asset_obj = Asset.objects.get(uid=asset_data['uid'])
        # check that `has_perm()` returns true even though anotheruser does not
        # have explicitly assigned `view_asset` permission (their permission
        # comes from their assignment to the project view)
        assert asset_obj.has_perm(user, PERM_VIEW_ASSET)
        asset_res = self.client.get(asset_data['url'], HTTP_ACCEPT='application/json')
        # ensure that anotheruser can still see asset detail since has
        # `view_asset` perm assigned to view
        assert asset_res.status_code == status.HTTP_200_OK

    def test_project_views_for_anotheruser_can_view_all_asset_permission_assignments(
        self,
    ):
        # get the first asset from the first project view
        self._login_as_anotheruser()
        anotheruser = User.objects.get(username='anotheruser')
        proj_view_list = self.client.get(self.region_views_url).data['results']
        first_proj_view = proj_view_list[0]
        asset_list = self.client.get(first_proj_view['assets']).data['results']
        first_asset_entry = asset_list[0]
        asset_obj = Asset.objects.get(uid=first_asset_entry['uid'])

        # make sure any access that would allow listing permission assignments
        # is coming exclusively from the project view
        assert asset_obj.owner != anotheruser
        assert not asset_obj.has_perm(anotheruser, PERM_MANAGE_ASSET)

        # add a non-owner, non-anon, non-`anotheruser` perm assignment
        new_user = User.objects.create(username='a_whole_new_user')
        asset_obj.assign_perm(new_user, PERM_VIEW_ASSET)

        # get the permission assignments from the asset detail endpoint while
        # authenticated as `anotheruser`
        proj_view_asset_perms = self.client.get(first_asset_entry['url']).data[
            'permissions'
        ]

        # compare those assignments to the complete list of permission
        # assignments seen by the asset owner
        self.client.force_login(asset_obj.owner)
        all_asset_perms = self.client.get(first_asset_entry['url']).data[
            'permissions'
        ]
        assert proj_view_asset_perms == all_asset_perms


    def test_project_views_for_anotheruser_can_preview_form(self):
        someuser = User.objects.get(username='someuser')
        anotheruser = User.objects.get(username='anotheruser')
        asset = Asset.objects.create(
            owner=someuser,
            content={
                'survey': [
                    {
                        'type': 'text',
                        'name': 'q1',
                        'label': 'q1',
                    },
                ],
            }
        )
        asset.save()
        asset.deploy(backend='mock', active=True)

        # anotheruser should not have access to `asset` yet
        assert asset.has_perm(anotheruser, PERM_VIEW_ASSET) is False
        detail_url = reverse(self._get_endpoint('asset-detail'), args=(asset.uid,))
        self.client.logout()
        self.client.login(username='anotheruser', password='anotheruser')
        response = self.client.get(detail_url)

        # anotheruser should not see the preview of `asset` yet, thus no access
        # to snapshots of `asset` either.
        assert response.status_code == status.HTTP_404_NOT_FOUND
        snapshot = asset.snapshot()
        snapshot_detail_url = reverse(
            self._get_endpoint('assetsnapshot-detail'),
            args=(snapshot.uid,),
        )
        snap_response = self.client.get(snapshot_detail_url)
        assert snap_response.status_code == status.HTTP_404_NOT_FOUND

        # Add Canada to `asset` countries.
        asset.settings['country'] = [{'value': 'CAN', 'label': 'Canada'}]
        asset.save()

        # anotheruser is assigned to one project view (pk=3) which gives them
        # 'view_asset' on all Canadian assets. Retrying previous requests should
        # be successful now.
        response = self.client.get(detail_url)
        assert response.status_code == status.HTTP_200_OK

        snap_response = self.client.get(snapshot_detail_url)
        assert snap_response.status_code == status.HTTP_200_OK

    def test_project_views_for_anotheruser_can_change_metadata(self):
        self._login_as_anotheruser()
        res = self.client.get(self.region_views_url)
        data = res.json()
        results = data['results']

        # anotheruser can change metadata for view 1
        regional_res = self.client.get(
            results[0]['assets'], HTTP_ACCEPT='application/json'
        )
        asset_detail_url = regional_res.json()['results'][0]['url']
        asset_detail_response = self.client.get(asset_detail_url)
        asset_data = asset_detail_response.data

        # Copy asset properties to test update
        settings = copy.deepcopy(asset_data['settings'])
        settings['country'].append(
            {'value': 'MEX', 'label': 'Mexico'}
        )
        summary = copy.deepcopy(asset_data['summary'])
        summary['languages'].append('Español (es)')

        content = copy.deepcopy(asset_data['content'])
        content['survey'].append(
            {
                'type': 'text',
                'name': 'q2',
                'label': 'q2',
            },
        )

        data = {
            'name': 'A new name',
            'settings': json.dumps(settings),
            'summary': json.dumps(summary),
            'content': json.dumps(content),
        }

        change_metadata_res = self.client.patch(
            asset_detail_url, data=data
        )
        assert change_metadata_res.status_code == status.HTTP_200_OK

        # Validate anotheruser can update only `name` and `settings`
        asset_detail_response = self.client.get(asset_detail_url)
        asset_detail_data = asset_detail_response.data
        # `name` and `settings` should have changed
        assert asset_detail_data['name'] == data['name']
        # Remove calculated field `country_codes`
        asset_detail_data['settings'].pop('country_codes')
        settings.pop('country_codes')
        assert asset_detail_data['settings'] == settings
        # `summary` and `content` should have not
        assert asset_detail_data['summary'] != summary
        assert asset_detail_data['content'] != content
        assert self._sorted_dict(
            asset_detail_data['summary']
        ) == self._sorted_dict(asset_data['summary'])

        assert self._sorted_dict(
            asset_detail_data['content']
        ) == self._sorted_dict(asset_data['content'])

        # anotheruser cannot change metadata for view 2
        regional_res = self.client.get(
            results[1]['assets'], HTTP_ACCEPT='application/json'
        )
        asset_data = regional_res.json()['results'][0]
        change_metadata_res = self.client.patch(
            asset_data['url'], data={'name': 'A new name'}
        )
        assert change_metadata_res.status_code == status.HTTP_404_NOT_FOUND

    def test_project_views_trivial_ordering(self):
        res = self.client.get(self.region_views_url)
        data = res.json()
        results = data['results']

        assets_url = results[0]['assets']
        regional_res_asc = self.client.get(
            f'{assets_url}?ordering=name', HTTP_ACCEPT='application/json'
        )
        regional_res_desc = self.client.get(
            f'{assets_url}?ordering=-name', HTTP_ACCEPT='application/json'
        )
        results_asc = regional_res_asc.json()['results']
        results_desc = regional_res_desc.json()['results']
        assert results_desc[0]['name'] == 'fixture asset with translations'
        assert results_asc[0]['name'] == 'fixture asset'

    def test_project_views_for_anotheruser_can_view_reports(self):
        someuser = User.objects.get(username='someuser')
        anotheruser = User.objects.get(username='anotheruser')
        asset = Asset.objects.create(
            owner=someuser,
            content={
                'survey': [
                    {
                        'type': 'text',
                        'name': 'q1',
                        'label': 'q1',
                    },
                ],
            },
            asset_type='survey'
        )
        asset.save()
        asset.deploy(backend='mock', active=True)

        # Ensure anotheruser cannot view the asset
        perms = asset.get_perms(anotheruser)
        assert PERM_VIEW_ASSET not in perms
        assert PERM_VIEW_SUBMISSIONS not in perms

        reports_url = reverse(
            self._get_endpoint('asset-reports'), args=(asset.uid,)
        )
        self.login_as_other_user(username='anotheruser', password='anotheruser')
        response = self.client.get(reports_url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

        # Change `asset` country to South Africa. anotheruser should receive
        # 'view_asset' and 'view_submissions' thanks to project view #2 "Test view 1"
        # assignment.
        asset.settings['country'] = [{'value': 'ZAF', 'label': 'South Africa'}]
        asset.save()

        # Retry
        perms = asset.get_perms(anotheruser)
        assert PERM_VIEW_ASSET in perms
        assert PERM_VIEW_SUBMISSIONS in perms

        response = self.client.get(reports_url)
        assert response.status_code == status.HTTP_200_OK

    def _sorted_dict(self, dict_):
        """
        Ensure that nested lists inside a dictionary are always sorted
        Useful to compare 2 identical dictionaries with different sort
        """
        for key, value in dict_.items():
            if isinstance(value, list):
                dict_[key] = sorted(value)
            elif isinstance(value, dict):
                dict_[key] = self._sorted_dict(dict_[key])

        return dict_


class AssetVersionApiTests(BaseTestCase):
    fixtures = ['test_data']

    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        self.client.login(username='someuser', password='someuser')
        self.asset = Asset.objects.get(pk=1)
        self.asset.save()
        self.version = self.asset.asset_versions.first()
        self.version_list_url = reverse(self._get_endpoint('asset-version-list'),
                                        args=(self.asset.uid,))
        self._version_detail_url = reverse(
            self._get_endpoint('asset-version-detail'),
            args=(self.asset.uid, self.version.uid)
        )

    def test_asset_version(self):
        self.assertEqual(Asset.objects.count(), 2)
        self.assertEqual(AssetVersion.objects.count(), 1)
        resp = self.client.get(self.version_list_url, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['count'], 1)
        _version_detail_url = resp.data['results'][0].get('url')
        resp2 = self.client.get(_version_detail_url, format='json')
        self.assertTrue('survey' in resp2.data['content'])
        self.assertEqual(len(resp2.data['content']['survey']), 2)

    def test_asset_version_content_hash(self):
        resp = self.client.get(self.version_list_url, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        first_version = resp.data['results'][0]
        asset = AssetVersion.objects.get(uid=first_version['uid']).asset
        self.assertEqual(first_version['content_hash'],
                         asset.latest_version.content_hash)
        resp2 = self.client.get(first_version['url'], format='json')
        self.assertEqual(resp2.data['content_hash'],
                         asset.latest_version.content_hash)

    def test_restricted_access_to_version(self):
        self.client.logout()
        self.client.login(username='anotheruser', password='anotheruser')
        resp = self.client.get(self.version_list_url, format='json')
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)
        _version_detail_url = reverse(self._get_endpoint('asset-version-detail'),
                                      args=(self.asset.uid, self.version.uid))
        resp2 = self.client.get(_version_detail_url)
        self.assertEqual(resp2.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(resp2.data['detail'], 'Not found.')

    def test_view_access_to_version(self):
        """
        Test user with submissions permissions can view versions list
        """
        self.client.logout()
        self.client.login(username='anotheruser', password='anotheruser')
        user = User.objects.get(username='anotheruser')
        self.asset.assign_perm(user, PERM_VIEW_ASSET)
        # test list endpoint
        resp = self.client.get(self.version_list_url, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['count'], 1)
        # test detailed endpoint
        resp2 = self.client.get(self._version_detail_url)
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        self.assertEqual(resp2.data.get('uid'), self.version.uid)
        # anonymous user
        self.client.logout()
        resp3 = self.client.get(self.version_list_url, format='json')
        self.assertEqual(resp3.status_code, status.HTTP_404_NOT_FOUND)
        resp4 = self.client.get(self._version_detail_url)
        self.assertEqual(resp4.status_code, status.HTTP_404_NOT_FOUND)

    def test_versions_readonly(self):
        # patch request
        response1 = self.client.patch(self._version_detail_url, data={'content': ''})
        self.assertEqual(response1.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        # delete request
        response2 = self.client.delete(self._version_detail_url)
        self.assertEqual(response2.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_versions_public_access(self):
        user = User.objects.get(username='anotheruser')
        # public access anonymous user
        anonymous_user = get_anonymous_user()
        self.asset.assign_perm(anonymous_user, PERM_VIEW_ASSET)
        response1 = self.client.get(self.version_list_url)
        self.assertEqual(response1.status_code, status.HTTP_200_OK)
        response2 = self.client.get(self._version_detail_url)
        self.assertEqual(response2.status_code, status.HTTP_200_OK)
        # public access regular user
        self.asset.remove_perm(user, PERM_VIEW_ASSET)
        self.client.login(username='anotheruser', password='anotheruser')
        response3 = self.client.get(self.version_list_url)
        self.assertEqual(response3.status_code, status.HTTP_200_OK)
        response4 = self.client.get(self._version_detail_url)
        self.assertEqual(response4.status_code, status.HTTP_200_OK)


class AssetDetailApiTests(BaseAssetDetailTestCase):

    def test_asset_exists(self):
        resp = self.client.get(self.asset_url, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_can_update_asset_settings(self):
        data = {
            'settings': json.dumps({
                'mysetting': 'value'
            }),
        }
        resp = self.client.patch(self.asset_url, data, format='json')
        expected = {
            'country': [],
            'country_codes': [],
            'description': '',
            'mysetting': 'value',
            'organization': '',
            'sector': {},
        }
        self.assertEqual(resp.data['settings'], expected)

    def test_asset_has_deployment_data(self):
        response = self.client.get(self.asset_url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data.get('deployment__active'), False)
        self.assertEqual(response.data.get('has_deployment'), False)

    def test_can_clone_asset(self):
        response = self.client.post(reverse(self._get_endpoint('asset-list')),
                                    format='json',
                                    data={
                                       'clone_from': self.r.data.get('uid'),
                                       'name': 'clones_name',
                                    })
        self.assertEqual(response.status_code, 201)
        new_asset = Asset.objects.get(uid=response.data.get('uid'))
        self.assertEqual(new_asset.content, self.EMPTY_SURVEY)
        self.assertEqual(new_asset.name, 'clones_name')

    def test_can_clone_version_of_asset(self):
        v1_uid = self.asset.asset_versions.first().uid
        self.asset.content = {'survey': [{'type': 'note', 'label': 'v2'}]}
        self.asset.save()
        self.assertEqual(self.asset.asset_versions.count(), 2)
        v2_uid = self.asset.asset_versions.first().uid
        self.assertNotEqual(v1_uid, v2_uid)

        self.asset.content = {'survey': [{'type': 'note', 'label': 'v3'}]}
        self.asset.save()
        self.assertEqual(self.asset.asset_versions.count(), 3)
        response = self.client.post(reverse(self._get_endpoint('asset-list')),
                                    format='json',
                                    data={
                                       'clone_from_version_id': v2_uid,
                                       'clone_from': self.r.data.get('uid'),
                                       'name': 'clones_name',
                                    })

        self.assertEqual(response.status_code, 201)
        new_asset = Asset.objects.get(uid=response.data.get('uid'))
        self.assertEqual(new_asset.content['survey'][0]['label'], ['v2'])
        self.assertEqual(new_asset.content['translations'], [None])

    def test_deployed_version_pagination(self):
        PAGE_LENGTH = 100
        version = self.asset.latest_version
        preexisting_count = self.asset.deployed_versions.count()
        version.deployed = True
        for i in range(PAGE_LENGTH + 11):
            version.uid = ''
            version.pk = None
            version.save()
        self.assertEqual(
            preexisting_count + PAGE_LENGTH + 11,
            self.asset.deployed_versions.count()
        )
        response = self.client.get(self.asset_url, format='json')
        self.assertEqual(
            response.data['deployed_versions']['count'],
            self.asset.deployed_versions.count()
        )
        self.assertEqual(
            len(response.data['deployed_versions']['results']),
            PAGE_LENGTH
        )

    def check_asset_writable_json_field(self, field_name, **kwargs):
        expected_default = kwargs.get('expected_default', {})
        test_data = kwargs.get(
            'test_data',
            {'test_field': 'test value for {}'.format(field_name)}
        )
        # Check the default value
        response = self.client.get(self.asset_url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data[field_name], expected_default)
        # Update
        response = self.client.patch(
            self.asset_url, format='json',
            data={field_name: json.dumps(test_data)}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Verify
        response = self.client.get(self.asset_url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data[field_name], test_data)

    def test_report_custom_field(self):
        self.check_asset_writable_json_field('report_custom')

    def test_report_styles_field(self):
        test_data = copy.deepcopy(self.asset.report_styles)
        test_data['default'] = {'report_type': 'vertical'}
        self.check_asset_writable_json_field(
            'report_styles',
            expected_default=self.asset.report_styles,
            test_data=test_data
        )

    def test_report_submissions(self):
        # Prepare the mock data
        report_url = reverse(
            self._get_endpoint('asset-reports'), kwargs={'uid': self.asset_uid}
        )
        anotheruser = User.objects.get(username='anotheruser')
        self.asset.content = {
            'survey': [
                {
                    'type': 'select_one',
                    'label': 'q1',
                    'select_from_list_name': 'iu0sl99'
                },
            ],
            'choices': [
                {'name': 'a1', 'label': ['a1'], 'list_name': 'iu0sl99'},
                {'name': 'a3', 'label': ['a3'], 'list_name': 'iu0sl99'},
            ]
        }
        self.asset.save()
        self.asset.deploy(backend='mock', active=True)
        submissions = [
            {
                '__version__': self.asset.latest_deployed_version.uid,
                'q1': 'a1',
                '_submitted_by': 'anotheruser',
            },
            {
                '__version__': self.asset.latest_deployed_version.uid,
                'q1': 'a3',
                '_submitted_by': '',
            },
        ]

        self.asset.deployment.mock_submissions(submissions)
        partial_perms = {
            PERM_VIEW_SUBMISSIONS: [{'_submitted_by': anotheruser.username}]
        }
        # Verify endpoint works with the asset owner
        response = self.client.get(report_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Verify the endpoint returns data
        self.assertEqual(response.data['count'], 1)
        # Verify the endpoint request fails when the user is logged out
        self.client.logout()
        response = self.client.get(report_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        # Verify a user with no permissions for the asset or submission
        # cannot access the report
        self.client.login(username='anotheruser', password='anotheruser')
        response = self.client.get(report_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        # Test that a user with partial permissions is able to access data
        self.asset.assign_perm(anotheruser, PERM_PARTIAL_SUBMISSIONS,
                               partial_perms=partial_perms)
        response = self.client.get(report_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Test that a user with the permissions to view submissions can
        # access the data
        self.asset.remove_perm(anotheruser, PERM_PARTIAL_SUBMISSIONS)
        self.asset.assign_perm(anotheruser, PERM_VIEW_SUBMISSIONS)
        response = self.client.get(report_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify an admin user has access to the data
        self.client.logout()
        self.client.login(username='admin', password='pass')
        response = self.client.get(report_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_map_styles_field(self):
        self.check_asset_writable_json_field('map_styles')

    def test_map_custom_field(self):
        self.check_asset_writable_json_field('map_custom')

    def test_asset_version_id_and_content_hash(self):
        response = self.client.get(self.asset_url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self.asset.version_id, self.asset.latest_version.uid)
        self.assertEqual(response.data['version_id'],
                         self.asset.version_id)
        self.assertEqual(response.data['version__content_hash'],
                         self.asset.latest_version.content_hash)

    def test_submission_count(self):
        anotheruser = User.objects.get(username='anotheruser')
        self.asset.deploy(backend='mock', active=True)
        submissions = [
            {
                "__version__": self.asset.latest_deployed_version.uid,
                "q1": "a1",
                "q2": "a2",
                "_id": 1,
                "_submitted_by": ""
            },
            {
                "__version__": self.asset.latest_deployed_version.uid,
                "q1": "a3",
                "q2": "a4",
                "_id": 2,
                "_submitted_by": anotheruser.username
            }
        ]

        self.asset.deployment.mock_submissions(submissions)
        partial_perms = {
            PERM_VIEW_SUBMISSIONS: [{
                '_submitted_by': anotheruser.username
            }]
        }
        self.asset.assign_perm(anotheruser, PERM_PARTIAL_SUBMISSIONS,
                               partial_perms=partial_perms)

        response = self.client.get(self.asset_url, format='json')
        self.assertEqual(response.data['deployment__submission_count'], 2)
        self.client.logout()
        self.client.login(username='anotheruser', password='anotheruser')
        response = self.client.get(self.asset_url, format='json')
        # No submission count is provided any longer to users with only
        # row-level permissions
        self.assertEqual(response.data['deployment__submission_count'], None)

    def test_assignable_permissions(self):
        self.assertEqual(self.asset.asset_type, 'survey')
        response = self.client.get(self.asset_url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        expected_response = [
            {'label': 'Add submissions',
             'url': 'http://testserver/api/v2/permissions/add_submissions/'},
            {'label': 'Delete submissions',
             'url': 'http://testserver/api/v2/permissions/delete_submissions/'},
            {'label': 'Edit form',
             'url': 'http://testserver/api/v2/permissions/change_asset/'},
            {'label': 'Edit submissions',
             'url': 'http://testserver/api/v2/permissions/change_submissions/'},
            {'label': 'Manage project',
             'url': 'http://testserver/api/v2/permissions/manage_asset/'},
            {'label':
                {
                    'default': 'Act on submissions only from specific users',
                    'view_submissions': 'View submissions only from specific users',
                    'change_submissions': 'Edit submissions only from specific users',
                    'delete_submissions': 'Delete submissions only from specific users',
                    'validate_submissions': 'Validate submissions only from specific users'
                },
             'url': 'http://testserver/api/v2/permissions/partial_submissions/'},
            {'label': 'Validate submissions',
             'url': 'http://testserver/api/v2/permissions/validate_submissions/'},
            {'label': 'View form',
             'url': 'http://testserver/api/v2/permissions/view_asset/'},
            {'label': 'View submissions',
             'url': 'http://testserver/api/v2/permissions/view_submissions/'},
        ]

        assignable_permissions = sorted(
            response.data['assignable_permissions'],
            key=lambda assignable_perm_: (
                assignable_perm_['label']
                if isinstance(assignable_perm_['label'], str)
                else 'Partial permissions'
            ),
        )

        for index, assignable_perm in enumerate(assignable_permissions):
            self.assertEqual(assignable_perm['url'],
                             expected_response[index]['url'])
            self.assertEqual(assignable_perm['label'],
                             expected_response[index]['label'])

        new_question_response = self.create_asset(asset_type='question')
        question_asset_url = new_question_response.data['url']
        response = self.client.get(question_asset_url, format='json')
        response.encoding = 'utf-8'
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        expected_response = [
            {'label': 'Edit question',
             'url': 'http://testserver/api/v2/permissions/change_asset/'},
            {'label': 'Manage question',
             'url': 'http://testserver/api/v2/permissions/manage_asset/'},
            {'label': 'View question',
             'url': 'http://testserver/api/v2/permissions/view_asset/'},
        ]

        assignable_permissions = sorted(
            response.data['assignable_permissions'],
            key=lambda assignable_perm_: assignable_perm_['label']
        )

        for index, assignable_perm in enumerate(assignable_permissions):
            self.assertEqual(assignable_perm['url'], expected_response[index]['url'])
            self.assertEqual(assignable_perm['label'], expected_response[index]['label'])

    def test_cannot_update_data_sharing_with_invalid_payload(self):

        if not self.URL_NAMESPACE:
            # By pass test in v1. Data sharing is not available with v1
            return

        self.assertFalse(self.asset.data_sharing.get('enabled'))
        self.asset.content = {
            'survey': [
                {
                    'name': 'favourite_restaurant',
                    'type': 'text',
                    'label': 'What is your favourite restaurant?',
                },
                {
                    'name': 'city_name',
                    'type': 'text',
                    'label': 'Where is it located?',
                }
            ],
        }
        self.asset.save()
        self.asset.deploy(backend='mock', active=True)
        self.asset.save()
        payload = {
            'data_sharing': True
        }
        # First, try with invalid JSON
        response = self.client.patch(self.asset_url,
                                     data=payload,
                                     format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(
            'Unable to parse JSON' in repr(response.data['data_sharing'])
        )

        # 2. Omit `enabled` property and provide `fields` as str
        payload = {
            'data_sharing': {
                'fields': 'foo',
            }
        }
        response = self.client.patch(self.asset_url,
                                     data=payload,
                                     format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        errors = {
            'enabled': 'The property is required',
            'fields': 'The property must be an array',
        }
        for key, error in errors.items():
            self.assertTrue(response.data['data_sharing'][key].startswith(error))

        # 3. Wrong fields
        payload = {
            'data_sharing': {
                'enabled': True,
                'fields': ['foo'],
            }
        }
        response = self.client.patch(self.asset_url,
                                     data=payload,
                                     format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(len(list(response.data['data_sharing'])), 1)
        self.assertTrue(
            response.data['data_sharing']['fields'].startswith(
                'Some fields are invalid'
            )
        )

    def test_can_update_data_sharing(self):

        if not self.URL_NAMESPACE:
            # By pass test in v1. Data sharing is not available with v1
            return

        self.assertFalse(self.asset.data_sharing.get('enabled'))
        self.asset.content = {
            'survey': [
                {
                    'name': 'favourite_restaurant',
                    'type': 'text',
                    'label': 'What is your favourite restaurant?',
                },
                {
                    'name': 'city_name',
                    'type': 'text',
                    'label': 'Where is it located?',
                }
            ],
        }
        self.asset.save()
        self.asset.deploy(backend='mock', active=True)
        self.asset.save()
        payload = {
            'data_sharing': {
                'enabled': True,
            },
        }
        response = self.client.patch(self.asset_url,
                                     data=payload,
                                     format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.asset.refresh_from_db()
        data_sharing = self.asset.data_sharing
        self.assertEqual(data_sharing, response.data['data_sharing'])
        # Even 'fields' are not provided in payload, they should
        # exist after `PATCH`
        self.assertTrue('fields' in data_sharing)


class AssetsXmlExportApiTests(KpiTestCase):

    # @TODO Migrate to v2
    pass


class ObjectRelationshipsTests(BaseTestCase):

    # @TODO Migrate to v2
    pass


class AssetSettingsFieldTest(KpiTestCase):
    fixtures = ['test_data']

    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def test_query_settings(self):
        content = {
            'settings': [
                {'id_string': 'titled_asset'}
            ],
            'survey': [
                {
                    'label': 'Q1 Label.',
                    'type': 'decimal'
                }
            ]
        }
        self.login('someuser', 'someuser')
        asset = self.create_asset('', json.dumps(content), format='json')
        self.assert_object_in_object_list(asset)
        # Note: This is not an API method, but an ORM one.
        self.assertFalse(Asset.objects.filter(settings__id_string='titled_asset'))


class AssetExportTaskTest(BaseTestCase):

    # @TODO Migrate to v2
    pass


class AssetFileTest(BaseTestCase):
    fixtures = ['test_data']

    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        self.client.login(username='someuser', password='someuser')
        self.current_username = 'someuser'
        self.asset = Asset.objects.filter(owner__username='someuser').first()
        self.list_url = reverse(self._get_endpoint('asset-file-list'), args=[self.asset.uid])
        # TODO: change the fixture so every asset's owner has all expected
        # permissions?  For now, call `save()` to recalculate permissions and
        # verify the result
        self.asset.save()
        self.assertListEqual(
            sorted(self.asset.get_perms(self.asset.owner)),
            sorted(
                list(
                    self.asset.get_assignable_permissions(with_partial=False)
                    + Asset.CALCULATED_PERMISSIONS
                )
            ),
        )

    def get_asset_file_content(self, url):
        response = self.client.get(url)
        return b''.join(response.streaming_content)

    @property
    def asset_file_payload(self):
        geojson_ = StringIO(json.dumps(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [125.6, 10.1]
                },
                "properties": {
                    "name": "Dinagat Islands"
                }
            }
        ))
        geojson_.name = 'dingagat_island.geojson'
        return {
            'file_type': AssetFile.MAP_LAYER,
            'description': 'Dinagat Islands',
            'content': geojson_,
            'metadata': json.dumps({'source': 'http://geojson.org/'}),
        }

    def switch_user(self, *args, **kwargs):
        self.client.logout()
        self.client.login(*args, **kwargs)
        self.current_username = kwargs['username']

    def create_asset_file(self,
                          payload=None,
                          status_code=status.HTTP_201_CREATED):
        payload = self.asset_file_payload if payload is None else payload

        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(json.loads(response.content)['count'], 0)
        response = self.client.post(self.list_url, payload)
        self.assertEqual(response.status_code, status_code)
        return response

    def verify_asset_file(self, response, payload=None, form_media=False):
        posted_payload = self.asset_file_payload if payload is None else payload
        response_dict = json.loads(response.content)
        self.assertEqual(
            response_dict['asset'],
            self.absolute_reverse(self._get_endpoint('asset-detail'), args=[self.asset.uid])
        )
        self.assertEqual(
            response_dict['user'],
            self.absolute_reverse(self._get_endpoint('user-detail'),
                                  args=[self.current_username])
        )
        self.assertEqual(
            response_dict['user__username'],
            self.current_username,
        )

        # Some metadata properties are added when file is created.
        # Let's compare without them
        response_metadata = dict(response_dict['metadata'])

        if not form_media:
            # `filename` is only mandatory with form media files
            response_metadata.pop('filename', None)

        response_metadata.pop('mimetype', None)
        response_metadata.pop('hash', None)

        self.assertEqual(
            json.dumps(response_metadata),
            posted_payload['metadata']
        )
        for field in 'file_type', 'description':
            self.assertEqual(response_dict[field], posted_payload[field])

        # Content uploaded as binary
        try:
            posted_payload['content'].seek(0)
        except KeyError:
            pass
        else:
            expected_content = posted_payload['content'].read().encode()
            self.assertEqual(
                self.get_asset_file_content(response_dict['content']),
                expected_content
            )
            return response_dict['uid']

        # Content uploaded as base64
        try:
            base64_encoded = posted_payload['base64Encoded']
        except KeyError:
            pass
        else:
            media_content = base64_encoded[base64_encoded.index('base64') + 7:]
            expected_content = base64.decodebytes(media_content.encode())
            self.assertEqual(
                self.get_asset_file_content(response_dict['content']),
                expected_content
            )
            return response_dict['uid']

        # Content uploaded as a URL
        metadata = json.loads(posted_payload['metadata'])
        payload_url = metadata['redirect_url']
        # if none of the other upload methods have been chosen,
        # `redirect_url` should be present in the response because user
        # must have provided a redirect url. Otherwise, a validation error
        # should have been raised about invalid payload.
        response_url = response_dict['metadata']['redirect_url']
        assert response_url == payload_url and response_url != ''
        return response_dict['uid']

    def test_owner_can_create_file(self):
        self.verify_asset_file(self.create_asset_file())

    def test_owner_can_delete_file(self):
        af_uid = self.verify_asset_file(self.create_asset_file())
        detail_url = reverse(self._get_endpoint('asset-file-detail'),
                             args=(self.asset.uid, af_uid))
        response = self.client.delete(detail_url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        # TODO: test that the file itself is removed

    def test_editor_can_create_file(self):
        anotheruser = User.objects.get(username='anotheruser')
        self.assertListEqual(self.asset.get_perms(anotheruser), [])
        self.asset.assign_perm(anotheruser, PERM_CHANGE_ASSET)
        self.assertTrue(self.asset.has_perm(anotheruser, PERM_CHANGE_ASSET))
        self.switch_user(username='anotheruser', password='anotheruser')
        self.verify_asset_file(self.create_asset_file())

    def test_editor_can_delete_file(self):
        anotheruser = User.objects.get(username='anotheruser')
        self.assertListEqual(self.asset.get_perms(anotheruser), [])
        self.asset.assign_perm(anotheruser, PERM_CHANGE_ASSET)
        self.assertTrue(self.asset.has_perm(anotheruser, PERM_CHANGE_ASSET))
        self.switch_user(username='anotheruser', password='anotheruser')
        af_uid = self.verify_asset_file(self.create_asset_file())
        detail_url = reverse(self._get_endpoint('asset-file-detail'),
                             args=(self.asset.uid, af_uid))
        response = self.client.delete(detail_url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_viewer_can_access_file(self):
        af_uid = self.verify_asset_file(self.create_asset_file())
        detail_url = reverse(self._get_endpoint('asset-file-detail'),
                             args=(self.asset.uid, af_uid))
        anotheruser = User.objects.get(username='anotheruser')
        self.assertListEqual(self.asset.get_perms(anotheruser), [])
        self.asset.assign_perm(anotheruser, PERM_VIEW_ASSET)
        self.assertTrue(self.asset.has_perm(anotheruser, PERM_VIEW_ASSET))
        self.switch_user(username='anotheruser', password='anotheruser')
        response = self.client.get(detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_viewer_cannot_create_file(self):
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(json.loads(response.content)['count'], 0)

        self.switch_user(username='anotheruser', password='anotheruser')
        anotheruser = User.objects.get(username='anotheruser')
        self.assertListEqual(self.asset.get_perms(anotheruser), [])
        self.asset.assign_perm(anotheruser, PERM_VIEW_ASSET)
        self.assertTrue(self.asset.has_perm(anotheruser, PERM_VIEW_ASSET))
        response = self.client.post(self.list_url, self.asset_file_payload)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.switch_user(username='someuser', password='someuser')
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(json.loads(response.content)['count'], 0)

    def test_viewer_cannot_delete_file(self):
        af_uid = self.verify_asset_file(self.create_asset_file())
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(json.loads(response.content)['count'], 1)
        detail_url = reverse(self._get_endpoint('asset-file-detail'),
                             args=(self.asset.uid, af_uid))

        self.switch_user(username='anotheruser', password='anotheruser')
        anotheruser = User.objects.get(username='anotheruser')
        self.assertListEqual(self.asset.get_perms(anotheruser), [])
        self.asset.assign_perm(anotheruser, PERM_VIEW_ASSET)
        self.assertTrue(self.asset.has_perm(anotheruser, PERM_VIEW_ASSET))
        response = self.client.delete(detail_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.switch_user(username='someuser', password='someuser')
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(json.loads(response.content)['count'], 1)

    def test_unprivileged_user_cannot_access_file(self):
        af_uid = self.verify_asset_file(self.create_asset_file())
        detail_url = reverse(self._get_endpoint('asset-file-detail'),
                             args=(self.asset.uid, af_uid))
        anotheruser = User.objects.get(username='anotheruser')
        self.assertListEqual(self.asset.get_perms(anotheruser), [])
        self.switch_user(username='anotheruser', password='anotheruser')
        response = self.client.get(detail_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_anon_cannot_access_file(self):
        af_uid = self.verify_asset_file(self.create_asset_file())
        detail_url = reverse(self._get_endpoint('asset-file-detail'),
                             args=(self.asset.uid, af_uid))

        self.client.logout()
        response = self.client.get(detail_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_files_are_filtered_by_parent_asset(self):
        af1_uid = self.verify_asset_file(self.create_asset_file())
        af1 = AssetFile.objects.get(uid=af1_uid)
        af1.asset = self.asset.clone()
        af1.asset.owner = self.asset.owner
        af1.asset.save()
        af1.save()
        af2_uid = self.verify_asset_file(self.create_asset_file())
        af2 = AssetFile.objects.get(uid=af2_uid)

        for af in af1, af2:
            response = self.client.get(
                reverse(self._get_endpoint('asset-file-list'), args=[af.asset.uid]))
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            asset_files = json.loads(response.content)['results']
            self.assertEqual(len(asset_files), 1)
            self.assertEqual(asset_files[0]['uid'], af.uid)

    def test_create_files_with_two_methods_at_same_time(self):
        payload = {
            'file_type': AssetFile.FORM_MEDIA,
            'description': 'A beautiful bird',
            'base64Encoded': 'data:image/png;base64,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',  # noqa
            'metadata': json.dumps({
                'redirect_url': 'https://png.pngtree.com/png-clipart/20190810/ourmid/pngtree-glide-wild-eagle-png-image_1657715.jpg'  # noqa
            }),
        }
        response = self.create_asset_file(
            payload=payload,
            status_code=status.HTTP_400_BAD_REQUEST
        )
        assert 'You cannot upload media file' in response.content.decode()

    def test_create_files_with_no_methods(self):
        payload = {
            'file_type': AssetFile.FORM_MEDIA,
            'description': 'An empty upload',
        }
        response = self.create_asset_file(
            payload=payload,
            status_code=status.HTTP_400_BAD_REQUEST
        )
        content = response.content.decode()
        assert 'No files have been submitted' in content

    def test_upload_form_media_bad_base64(self):
        payload = {
            'file_type': AssetFile.FORM_MEDIA,
            'description': 'A beautiful bird',
            'metadata': json.dumps({'filename': 'eagle.png'}),
            'base64Encoded': 'data:image/png;ase64,iVBORw0KGgoAAAAN',
        }
        response = self.create_asset_file(
            payload=payload,
            status_code=status.HTTP_400_BAD_REQUEST
        )
        json_response = response.json()
        expected_response = {
            'base64Encoded': ['Invalid content']
        }
        assert json_response == expected_response

    def test_upload_form_media_bad_remote_url(self):
        payload = {
            'file_type': AssetFile.FORM_MEDIA,
            'description': 'A beautiful bird',
            'metadata': json.dumps({
                'redirect_url': 'http//png.pngtree.com/png-clipart/20190810/ourmid/pngtree-glide-wild-eagle-png-image_1657715.jpg'  # noqa
            }),
        }
        response = self.create_asset_file(
            payload=payload,
            status_code=status.HTTP_400_BAD_REQUEST
        )
        json_response = response.json()
        expected_response = {
            'metadata': ['`redirect_url` is invalid']
        }
        assert json_response == expected_response

    def test_upload_form_media_bad_mime_type(self):
        # We are using remote URL, but it goes through the same validators as
        # `base64Encoded` or `content`
        payload = {
            'file_type': AssetFile.FORM_MEDIA,
            'description': 'A beautiful bird',
            'metadata': json.dumps({
                'redirect_url': 'http://example.org/eagle.doc'
            }),
        }
        response = self.create_asset_file(
            payload=payload,
            status_code=status.HTTP_400_BAD_REQUEST
        )
        json_response = response.json()
        expected_response = {
            'metadata': ['Only `image`, `audio`, `video`, `text/csv`, '
                         '`application/xml`, `application/zip` '
                         'MIME types are allowed']
        }
        assert json_response == expected_response

    def test_upload_form_media_base64_encoded(self):
        payload = {
            'file_type': AssetFile.FORM_MEDIA,
            'description': 'A beautiful bird',
            'base64Encoded': 'data:image/png;base64,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',  # noqa
            'metadata': json.dumps({
                'filename': 'eagle.png'
            }),
        }
        self.verify_asset_file(self.create_asset_file(payload=payload),
                               payload=payload, form_media=True)

    def test_upload_form_media_remote_url(self):
        payload = {
            'file_type': AssetFile.FORM_MEDIA,
            'description': 'A beautiful bird',
            'metadata': json.dumps({
                'redirect_url': 'https://png.pngtree.com/png-clipart/20190810/ourmid/pngtree-glide-wild-eagle-png-image_1657715.jpg'  # noqa
            }),
        }
        self.verify_asset_file(self.create_asset_file(payload=payload),
                               payload=payload)

    def test_form_media_do_not_show_up_with_date_deleted_not_null(self):
        payload = {
            'file_type': AssetFile.FORM_MEDIA,
            'description': 'A beautiful bird',
            'base64Encoded': 'data:image/png;base64,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',  # noqa
            'metadata': json.dumps({
                'filename': 'eagle.png'
            }),
        }
        asset_file_uid = self.verify_asset_file(
            self.create_asset_file(payload=payload),
            payload=payload,
            form_media=True
        )

        detail_url = reverse(self._get_endpoint('asset-file-detail'),
                             args=(self.asset.uid, asset_file_uid))
        list_url = reverse(self._get_endpoint('asset-file-list'),
                           args=(self.asset.uid,))
        response = self.client.get(list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        asset_files_count = response.data['count']
        del_response = self.client.delete(detail_url)
        self.assertEqual(del_response.status_code, status.HTTP_204_NO_CONTENT)
        list_response = self.client.get(list_url)
        self.assertEqual(list_response.data['count'], asset_files_count - 1)
        detail_response = self.client.get(detail_url)
        self.assertEqual(detail_response.status_code, status.HTTP_404_NOT_FOUND)

    def test_upload_form_media_with_slashes(self):
        payload = {
            'file_type': AssetFile.FORM_MEDIA,
            'description': 'A beautiful bird',
            'base64Encoded': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKYAAACYCAYAAABu+JKqAAADJWlDQ1BJQ0MgUHJvZmlsZQAAeAGFlE1IFGEYx/+zjQSxBtGXCMXQwSRUJgtSAtP1K1O2ZdVMCWKdfXedHGenmd0tRSKE6Jh1jC5WRIeITuGhQ6c6RASZdYmgo0UQBV4itv87k7tjVL4wM795nv/7fL3DAFWPUo5jRTRgys67yd6Ydnp0TNv8GlWoRhRcKcNzOhKJAZ+plc/1a/UtFGlZapSx1vs2fKt2mRBQNCp3ZAM+LHk84OOSL+SdPDVnJBsTqTTZITe4Q8lO8i3y1myIx0OcFp4BVLVTkzMcl3EiO8gtRSMrYz4g63batMnvpT3tGVPUsN/INzkL2rjy/UDbHmDTi4ptzAMe3AN211Vs9TXAzhFg8VDF9j3pz0fZ9crLHGr2wynRGGv6UCp9rwM23wB+Xi+VftwulX7eYQ7W8dQyCm7R17Iw5SUQ1BvsZvzkGv2Lg558VQuwwDmObAH6rwA3PwL7HwLbHwOJamCoFZHLbDe48uIi5wJ05pxp18xO5LVmXT+idfBohdZnG00NWsqyNN/laa7whFsU6SZMWQXO2V/beI8Ke3iQT/YXuSS87t+szKVTXZwlmtjWp7To6iY3kO9nzJ4+cj2v9xm3Zzhg5YCZ7xsKOHLKtuI8F6mJ1Njj8ZNkxldUJx+T85A85xUHZUzffi51IkGupT05meuXml3c2z4zMcQzkqxYMxOd8d/8xi0kZd591Nx1LP+bZ22RZxiFBQETNu82NCTRixga4cBFDhl6TCpMWqVf0GrCw+RflRYS5V0WFb1Y4Z4Vf895FLhbxj+FWBxzDeUImv5O/6Iv6wv6Xf3zfG2hvuKZc8+axqtrXxlXZpbVyLhBjTK+rCmIb7DaDnotZGmd4hX05JX1jeHqMvZ8bdmjyRzianw11KUIZWrEOOPJrmX3RbLFN+HnW8v2r+lR+3z2SU0l17K6eGYp+nw2XA1r/7OrYNKyq/DkjZAuPGuh7lUPqn1qi9oKTT2mtqttahffjqoD5R3DnJWJC6zbZfUp9mBjmt7KSVdmi+Dfwi+G/6VeYQvXNDT5D024uYxpCd8R3DZwh5T/w1+zAw3eoYKLCAAAAAlwSFlzAAAXEgAAFxIBZ5/SUgAAIABJREFUeAHsvWmPnUl25xe57yuTTCaTLCa3KrLWrupV3epuWaN2d0tqNTQzliVjbBNjGBjYHgN+588wrwwYxgCDgQ3DgAF7YEgjzdjSqN1aWtVb7SuLZHFLJpNk7vu++Pf7x71V/RH8Yh7y5r33eeKJOHHOP845ceLEc0v598e/58D/DznQ8s/+xX/37cPjw786Lv7jOOL/MZ95P+bP8XFLaWnp4EubJ8oh51s553s54ho3tbYc8X5YWr25hf+cbKF4C5+Pj47K4eFh6jzgllqnDbVyvSXteFNLa2tps7JQcVxaW1tKW3sbr/ZyzOfPjpBh4xzcTynubUl5/lA/tDeKt7Ras+Vq2Y52r9s/vlNPKwWOafPowP4e0vJROYLe/cODcrDPt71D+slrn9cebcKD3GMbMoh721q5h+/ed3R4XA6o62CvlH3K7+3ul8MdXsfUxzV5sQcvDg7gB0TYC7vcDt3t9LOzszOvrq6u0t7RTnda82prgzft8JT+eq69vQWaae9gP+167gCBHFJ/C33yVQ9lVz+ntVbohRdt1oPMWmm8FT4c8fmAe6GQPlQeHOxDc+gsyA+69/bKPuck2hpt69B+H/qZflDnztZOofsc4sMPNBZ6oNeOFnhMW/IOUmg/0qm8UzDe0dL2z376Z2/89+00b8O1RK7UjrXYg2Ml67to8FW/CgcrPj7kEwRyNoCoBfgrULjvuFVC6AtFFB5nbTgAOICxkqIwvV/mChJBzVfuCczLPjcL2jCcelvocP7ZkXSa2znvvYgMAdZ6OMvphoCoT2EIhiq4So8UCMojgHhYR2I5hK49BbIP4w8EKNf2C0LahyyAyd9j2HUEwFpgAqQFcH4/FJgCBPkJ0L0d7j3aK8eCiOt7XoNu20gfoO8YmrzHAaVwQ7e84F9bG+35OXKgD3y3Hm6PMB3wMtdBIRAqj6khfKwyqYoFqkNrrZ+bIirbzKAKWKAL5XJI3wWO76HLenmF3QjTawegsbYpaK1Dfni/vKh1Km370EL5Y5lE0yoQz7cxGhyM4sgjdKcBzrQJPAbrAcyXUU3hS4HYSOe4uQ0gqbkEpgKxYQ/leERnWw5lHAziCPAET6rmGvfKu9Y2CgtICPKazJX1jsAjKuJqaYGGg4xiPlOHo1ktnGsIsK1D7eH9AlLWep3P0GDzfkRunEe7MyA+EzL9bEGwMpdSqdfB4jfrrgyGDpUBtCjsgz14wvvhroBCgyIkBSVbWxkwEaijTV5Zq1qVCqJFLAs9gvPwCI2Gtm1qswMv0LD8CmAa40ZeRqCCjPbUTtKlFlVzCqojtTWtHQkKKrFdGZFeeZ+AyEnagMbmIWBijeS4NCMAx6t9iBDlAjx1YArMCkKBWFtQW+Y2W5fXlKu8Tc9phnZpQxzBeCtO3ccOOs7IduXU3ooFQGm0tTigW0oHeICSBpkVM2JDGXu0b+/sUDE3c8LRGYBKFKU0GaVNJlTNoA5L57nuOTtqJ9WOwIZbwqZUTHdDIDRQQHMLkRILkdxl9VIRQdgxQdGKqq/mBeIAsxq5MluhV7Nm5WpH/4F0yvGiXrXjIXS1AQbbot/I5wjy6ReA95wHkKAuhShIGyMdBgiaaC81xd5+TLEaMwAFqJpO+wF7U08EK98kgx5Fu6JaBbAaRAxGE3NbAA9w5Zd4EFwO8kic7w4cSES48kXrAV2+HAQZUDZpnRSiAnmXuqhH+vxc+RTSKGI7yi1MZuzaZxuAttRLG7YLN6xP80oPAs7IQv7wUhtKJ9SFX/YUhqe/fuTWYCcDj7JyV+0ns21ZPngoK3kdK8z3uCZokcCF71URwVtlCSY82jc2dritqtf4dDEfghQC5K6ggkjGRKWEm+h3gMCATgelwvo87+GIPo6zQc0wQiZ4qSl4tUE0mJ3g5Wg9hulpg8EQwKjlHMFcj6qXaOq0+wGF0lEL71EeGlvbOhiVmF6Y0tYJPQcY9k6Gj21wVIFXGvZVj97Ov/iYjng1G0AUgLsAMRqM9jzvuX2uHQM860/TvjNwpD/mTb8Ucy8Aci8+qi6B8pKGaBWBxfWU8bx0IfY2eGSZ+oI3DUbaTmssWwt1OwpCMfyxR/Vua5A/0cacrRrP6xaX9/joDPLqmjXPczd0xCpRj5z3Fb9QrFJMZSUopSFUyldoERNaKAeJfvMhPFKeHp4TSyoLRJLBFo1AJcq4hbKtKDrr+/ywDUCJVW5v74gr5rX2je2dFNNsdBx2lM6uzoZWqI2oxZwotMMNq/tclUMCJ+yw40MB0xPeK0EtMCOdSze9r0GK9aQQJ6xQLe0796sh9cGOo11gDvXF97PYkSPVSmiD+8MAaZM4YQ/629vQZ9DTzkByVGIMI0R4ynm+U0z6NZfWdaxpAqPxmQQffqUAcPJzvMc1yu3pbggmJkJqunY53jyor/pkCIuKdFGkWf95H2AqKF+QEyAoRMEXU0gf7LbSA76wgT5R/xFgiH8NDYecO6TfdvMIJmnRBJPgE8xVANRNNZW/FSS2mYN75FQrg9x/0h6Nxv36fvks3zGvmfzQT2UWeVTqUo1885z+eWtrB1iTXrQSA9U+tEGXA1C3T876WauoTPSLQxsV0FKDLgSSunBVxANl2vMCCw3+tu9gykVTewfs6ZRIGNOBD9CBBqKagwBFztgwjcW0U5lADFm1wTCVzsoK2RIiaF+pcLpxLhdo3JFMZ+iBgG6j/UMIakFIgjITD+9T1aajMFxGBlnwg9NVEJo62+fetgOY0MmIg3bB2dGmt5lRrmCPnVFSMqJCEDLQI8ChwupH6t/RDmUPAKlAq+acz2pTfUPcA1s8FLz2FRCqAY9wIXLOzgMCjY1grvyzHdoEmJaVhrYIxsGmu2FNHmoU3R3r88X9+0ye6EkLQOBM5EMJ6rG4QLZ9+ejdgqIxGDjvwVhNfQcOeu53AChXzTtUcc17eeebp5RVc4Lou9dtQyug+C3o5CXzC/2l1OE5QAXf6WJk6GC3nweO/PSOdmm7thPi4RJ0oCk7IDLzmDTASQ4mP1TUApN5p+0IvZNeH/ClgxBFW5t+HxU6shyxAMrKjyDC8A5yolkYUtlW/QY7FMDYD3pTuW5D3lk7S4ej3iWP/rUFpHXESJMTGB0nASR4ZFDeuRRmhQG0nDqpoxVNDxLbDmF7ByLUhMHlhJ2gRx4KAo8IvOx/ZpLUZPsATJAl3KMvZoiI7/HfAgB41GDQEcxyth7tKOAQgoCr2rPSdIS/KDjVzh5xVbjfwQg1CFZh0gne7Y8ykTutuCOHgDMzcOi3TS7n8Hr4QMkW2qyAgQ6B46CmoO3E70ydtCPv1Eo0sM9AUevCVlhupfUlnxBryrShET2vVq60UyddiIvAOz1QEdayWiEso6JqUJ9+aK008wdqfcvSWgcdFap6P63+EdO8CV5l5I3SaB882g8IaRjWyTBysqMvSWEH3CECjonntCbymAbzz3qg1tEhTGVq8AFQrVw4eb9G3r/6EIJbu6pY1DxiJJGBMIQRqDmJKfdGXqHv89Gq4GNio3UAAh1ANtDBrBUzAGnc4+DxXgaU/t2hvjJlAKbMiiYCVPEX1X6po/qRCXtQXzRd/lg/L4XGKwKm6gPCP0do9WhAzu9Tz2EmPYgM2tI1AQgwdWUFTRhEXTQXPiBKuELdGTDwDAUg/zStWqxW+iNAndAdoRgMyQk8LRYstqN5ZdB4zfsCYOpM922r+aIeUNdi/x1oanzlIDGNeuwPTTlSqiaGOom1/4pN98KinAnw/epIz0RVoIeGSkeVMahDnprlFngZK0CdlIh1jLk2/CgX6LhKLA0prNAkHMM8hNNOj3wpbQByxMTBWa4CQ9emM44aLgZuBpatQ5OeGReNCMTWOpxyzoISn3ASZQW1roDjoKXDEIKEUQ1MT2etUIbQin8cYQxIztZyVn0IbeAhZnIPrdaKtm/DFBy3O5KpB1oP6LSmRhOncFvCJOqUyQJSxAgURvQ+7/EfbdLPgCtlpJF/ssqJRdOXVAjSJy8Sl0QjpTpinYLiEN9yl6C6XdmHvkwgMVf61QpZP1iXxQEcFUC5RBToRwYePGlxdo7it7++Ei+m1QxwhCfP1NJpRLOaE8iMcyqL0Acv+BirZrseQCgXFWPcJhlpvXaSMgJdcUcmVuSHXOCv9OezjoDXaB+1jzTyOaD1ClUe6KahMBzUagblp/KIG8FcpionCgtqyuxCdyeDQmUHYVyAT/qYdqxd1NuwRFoRDLJNHbWAkHM63PoR/M9BXTFhccwhRtN0RFxT++7UX+bXjtFhuFE7YaW2z3uu855rENOJ5jvuDBD08Vqo51hnG4gCI0CqMNHU+IG7rKo4YzZG1ooN7+4CIAjJOmO2qTYakYHQjLP67kpOwMJ9ahlBqIyjHQUdn2tgGSKtmy4IuOpDa/LrzDsalsKCVm2q/7i3q4lnkEOfIaf4fjC7hb7EpWiAUiDKXOmTD5m0aduJ86mJ9/YBtu1yXR+1nUHcwSv3IODKV4pEw/Ae2Xm1ccgDrsl9AWMfBXjzPqRGn+AttFmFYvCzE381dipSk9G25zVg1OhF/3N4jVqgvUqm8iwuBH1TyQTgytX6vCfE5eZaF6eUxZG44cxBFMznfWvfwaEzHBQzYpscfhambTBDbaaP0MKECNVUR7CgkkI6pe/ZAiUC1pFQgQ1D6bigidmw/hD5+X3G7uJnhGBui2ZnNCogKjnCPNLr+CR+kEnOdg3JZCTyXRMhHfpNcldmazpoiir4o3D0sWCuzIlG0O9BAvo/crc2bz3SSEuCjAriTzYEIS/oSOqhWMpZVpdAUMafApS7BOQz4VHrAtCAw3bVxFbhoPKdvmbyI8houloir9tvWaDmxk3Q95cuG7UDHOor662grueqSU8XUsayui+coW5a5f6s0NGe93k03hqfq6VwINF6ztnllPG9nmkAWHrkkb6s7pUvgQ7vVBx85htiEW7cqVyNqNgxyD00vEc4zzkMJ1EqTHzoTx0o0CmQOehndVAjO0wIwzsdkSiBZaecpOzBtDYqFwQM7NAvtuy/fqi9gFwxxGFXHFU2xCf+GGuUeDWEAqBy/lKGa64SNAmTLYKiEijYoI8bo9FgAv2uh/XWZqhbQVRTYZtOABRIVioo1xRiAE0fNY3215BONAKDL74OJ6WDL7QhY23fr7RLn/zcKsPTJxlND2hbFyKD0nKMJwcQqj4muQ4a/MOMPBnHQfUOaPskD1qhVcTqdtl0XIqoOOmSr4ILy1a6eHEPMvjVQxnVSSn9oqx0NTV8LJ88Th32y6OWkRDvNQpS+dyQTcpU8FPE/+E1FPKvWgllpBvkoBOcWpDkA0i/oMN9SgxWVjDADg8M3VEOHrXud+KqAGj63KZAZWzjkOceIMoxiEnkuwQomJgG3v0cjQATE6czCKqWinakbW5qQwCqZA8btiKZq+QzUvkuIz1lk677+h5N6meuV7NOCTqU0Z8KUioAcmQm+E3nrVxAJlKgnaU2qsh5G7G+mGreHcGCNtWFAsrRhn0yycJlRIXIzV6gLdie0Y+gqdM25LFgoKKUsbwfvcO5oqbbGXIrX5zMOak1/CVLmjNl1+/r5CuESmQE6hKgS3MmiUiksGjrbA8N0tHR3QmNmjodGElt8JH7ZWImR8ioCdSAWB5al3TzWV6li5IvYAWCZOSo9Niuatz5QdwSO82hXKgeHsgbz3A/5xLzBFQOwB2iE7Az98m/5rq+JFqXw9sjkQy+yaNDgOp8wwFvLkQrbo+KKzHxyDSoxFxwb0gJc6jFXnFGYmzMMEqQzChIH+wH//QtozEcNQG3QKv3qwn96CuVByQVBNQcgu1kbrA9PssgP6qVgA2dkQbBwgsMZdBYH5VaplYOGNKoZKtNuMjgyTnqiqblfI3JaW6o08mdZMUftkLJUGtX7SwaZZ0TBA+q4Q/tYAp9926b1Bxn3Vu2NGa7runbDxc4jlh90iIZ+qkWgNu5/1j3KYxpRWvvY3H4Iji5T82cAQENapWqaC3shAo+AwT7aJz5SKCKnEwouGzfaFcLwxc7xXfq4Vw9b0+g3y9WGSL4QD0pAwkOOuOx8iLWIwWj0KkD6pCFgNeN2d3eQwPaJhxptCGzWnH7qLHKL/yiLc4nzosyqlqaU9Igfbw5aMJTFR8H2UVe8yIN8srMSDSHT8CDkaE2UEbHmno7rOlBC0RE3CsWIkQ+RAPmChXTmC/Vf0DsKequwU/rsm1apY46Muk41XtwKtejdb2LujP7RhVJZ7vaScY3SEooJffJKG+WyXFwAs5oYvpkv5xQAKuUkaIcvslgh78fGwTYhfAnfh/8sd92C7+p0b30L30QsFxLWlrAIV8rw71uqzLfMlBXecUJOSkdalmh6Xp2AuBoErWIK1gs1kWg7dRT3QN5bR+pjBtrDVZu3ZyitURBRBwnBY++oKszojD+P2XDKVAl2PwsLaGRa0LAhYXwhavxJTH7jLWyy/kdVw3VdNbPK4fmep/vDhpo/WwQiFzKtHH9CPAdwM+s+tBYfFtBby3hDTy0kXRC4ijM/0okH1z5cGJjhQFcIG7zdFlAQaNr0iIzQKdoZRaMheDM5jmRmR512dHM2Gn2SJUC4QKhzl65l/qkXxBF0FwP8mjftVTNRAK11GUOYdQ/9avt9DF1ouWPs1rrTLwMwdqHVKXQ+VCZKAcqCCVLq6DG8bBtCvm//rFTVKyGV2PIPIVhe5DEwMVkMaFy9UxQ2cdDNYNr1PCsCT1bTt3WmwbUvAoWc+6Ac2KnNKiCb6VtG38ezdhBtELlkNU4+ODR3dMT98AlZM+IP1tSAPajad492zyc5KrKXRwQn7ocSACaaNX24TvOmrXVW+QBvFDT7XNd90fFrf9+KECdqMpP+5x6JEJeO8jqYDF01DziGjjouM/hZlw8rpd8sZDikPcc0Zh2SoG1QngYw82q8uoJVPOiP68zq/k60vR0Ck7OJUbIOe4JQHgnXpyGlKdsryCjNR1iiDpgdNimhTKxaABCiUfNc0FGSW41J75Lrg3WOm3Lo/EmP1LeDyYXxy+iEVmfi43C9k/GHrOEiDFIH5RDtKh9QDDO2q2v1skAoJGEyQhLVWcfwQo86gxdacLBKKM562BQYFgY3RCXHAWbfxg+AZ0pda420WTp6e4qvX29ZWhoqPQO9Jf+wX4A2Vm6+3vKwOBg/LJWgr80kwFkKtzTp0/K7MyjsrW6E+C2QZtNCGAJV1vWsNTnwID70AsvpVftbFn74TkVkPFfaHVQN1ey/OwM2qVal2cFoy6QfqbMz/xCM2Tj9lMq5YNKwm8pVmmyHW7AxwznFGXlccpwT6qwl1od/jBuGycVWmV2Q7HGBLc5MihhvVm+dBRQuRW5apE4HAFVgetyE4t9sgDiGJbSIIEQbR1+lsn0DKIELWeUGh+OWFXRktqZgBmApKsp4zkrU6MAuDCVrzko4CihmvREwagSuDv/uS+0QJvQoCU0gAy3v2gJ6DSetse69O4Oa9Oc05/sYH1aOjrJKA/b7A91mwWjj6W1MZ7lhOJIv7VBtxOXNAw97ckjrfW4JLhDWKmjs7tcePZCeeHFV8orX3i1jIyMAKi20tPTG+bbprHQHrTixsZGmX/6mNBdSxkAtGbF60ptXdjIuTff+GmZffSgrG+sZ1bvkqoS15okmE+/4kvrp0cbKDf5I912R9kqH954d407S7/5XuOq0Y7pq66wFq7KoA5+ZUJ71Ke2UVPKD/MvPaLwpIXXMfhIFhR1qAT1T5XPoX6zg79Bi/dFYwZxEkeHlWcyY9SEETAKAHOScIcaTxMPUAUQpMBQGsc8KLN2VSUqoBVN4XkZ3MIMrNmg+st7csCwGocEwpSzLDfTKcDiZwivALU093GjzBZIXm7WU++jOOedZMgctZAlvJZqZYihIUaxxhIZcZmQBaExmbK7v0vp1tKHdrr63Pny3HNXyvjJM6Wrd6B0akpJDnFJb5uy3YC0r28QH8v9E8elv68Hfu2UhaVFQLRetnY2mBRslNWVFbTaXLl548MyNzdfXPo9ffps+cKrr5Zf/8a3y9T5S6Wrs6csct/21hYx0N2ytLae9Wxpsr8dHV1lfX2TQbALWPZLd0dvOTF6CjPeXVZWlsrMzIPy0Xsfl+7eztLT11/W1leZ1cND2Rc+qtkFIPxTXrAHLsiiDKK0wYCo8vlcKSkn3QEH2ueuVv3O7fAXOaD3a+YQWNAFsX757h9BR+qgWlMXjMKAErlAi1lE4b+jIu0oT8KRDmbnM9G0AtO1cqjWRAtYTVWm9NwmMoRSKzNGiYgpR0BmpKv0rMT4mZww90Vz3wIhdJERYYjHTnA/tIUIh7LECwzKgIswxU4FxF6MmbUAn2nfyVddDhRkjsiq5eLzSrB0hyNVIDKeUmkD/oQJDqLdaF9caj7vUefu9i4mv6OcmZwsUxculgvnz5fxU6fKiRMnoBITfOAgaEtO5Z6TEMxcJ3za3dovO5sbYXp3Zy8atq2MnZgsL7/0ZZJeWsqjx0/L3bt3S09vT3n+2nP0Y7/85Kc/KTP375cvffmryXLaJgf2ACAeIzxsZNkHmBuAUnoVUnt7F5plv6xsLEJJa9kCnN2Y+tWVjbgGXZj+U6dPlsWFhfKVr329vPnGL8vT+ceAs5N+ksPfzYydPiZiwtomkgs/W2FEWA8flatsiz/KVUNnXpO/fjCakVUu3sVQ7uN6vUnpaHkElyJQwLVEfGZX7BQq52zHSy481NLei4SgQawlDEjH0wb35DbujL7V9usbyYTEFNOGSK6NtVKBWtHUJM1UZsh8bgOgOtA0HULaKNNCWfES1V75gbaFGJbjMlQlivL6WxmVUOS7xGuN9SAlPXUCpoQjeOdqhCbfwlD+/Co4vcdq7BmGmg8MQM0rt+7Tllp+ZxctRz0TZ8+X5194ubxw7SWAOFr2Nra4Tl+oY2sV7QRgsrTIfZo2xnHp6+8vOxvbZWdvh/53MLgPylbLDgO6pbz/9rto0b5yemIcQAKOrb3yZPZpwim7aNOuzqFy6cpLZe7JIts19suJwaEy2D9Y7tz4pMw8nClrm+sMBEw8GnKLJWJXfU4xSHoA487Wdunt6cPvHK6uBq6Aft/ckwVoPi6vvPIlBtbl8otf/KR89PH7WAX4jxIxQ9/UP7kRMcI3OBi+CIz4w/KMOmp4iUtc3mXiqAb1lYUP6qn/uEvGqzgoJ+9bs6DvfcgU/jUkGy2ta0Mh/9c2G+8CMmXBiQJr1hWBQ7ca3iN7fuKU4m1Wt00BV2JV+VHXlHUEGWRXPddALPSoHQGnLoCZyVltEeAhyM5DGK+spWvSacNrVBsA6W84aipQ6Ue0rxclDgbnk51zRk6pMKSafmtJCQrp05ivaEcVRAY95Y9h3B5uxc7WbukfGisvv/pCuXDxMgB6puzv4u9t7pTHW4+TD9iN9pRXO5u7ZWN9PSQk4KuQYdba0jYuDbsXGTf7hwISH5Rg+s7OOj5ja+nsbi/z808DBlfCTo+PY+J3y/amZu4A3jIwNjfRlDulm89/++EHaML1DOBu2ugfHi6bAL+FWfZRV2tZXlyivoXSjXbs7O0rm0924XFrGT99ioFuCts+7faUkeEx/M7D8tUvf708+9zl8m///N+W9dU13JAu+CeIlI95OJWHNRYLq/iXWLPCCFjwk3nX36+LDMjL+yMcNQy85ZplqumvsnXhIOXQhwJcH1PgVW2tRhIvlAgmqI8ZPlXke3DH3c0AvvJuHsnHjM8BoA5oONotIrfh2qiFpZ++SB7EAo7QCviCemeeEMVJXYQmEX6GH5UI7mwF2I5ba6kdtkscmB1KWaKqdD450ugPnzhst8E8Z4F0nRMMBlPDAEHSptzrY3n9KWa0br11i0RP91D59ve+W7729W9iNo7L49knZf7RLNtke8vm+kbpig/ZXtZxV9Qwu2xBhVM0Lr1MiHB1HJzDQyOYyS0+mx2DCdrfLoPOoPuHY8IlfPTESOkE4FJ9cMhEirra8WUPSL9bXVtGaLulCwYv4HN2d3dT9xb0MRtHe26gNY1/trV3M6dqKV1MfAzrrOM2bK3ul1Pjk6W3vzt1C9Atyp8+PVHWcAF2mLD1djFx6h8pf/QHf1T+z3/1f5S1rbXwNkCMwdH0AgL7BnCQVPy/yrOqTBKmE4iCM8uU3CigVBjcC8cblpDPnK9RCIvU63Ime4oQ3HGsnBIFAzbigQybLiMoyjyE7I3UpQ8a2kQtR+KYal01V+w8/oHgjD8JKZbzGh85qATC6R6VYuZsyHo0x/ShlfzNJrG+cyaNCk4KQWy9N23zR0ZlRi6zLAFa0X0W9c6A37Y09V5zJFpDk8GO0KzfQ7B1CiBH6h7bInZ3DvHxXirf+PXfJKWqu9x871YmGEcyjMI7HdvQfFi6WvvKJP7lIWb+6fxc6ejpLH3dgIIBsLu9XcZGMLtDgzGxnusAeN1daDgmG+tbTFYwfZ2dZPszQNZXV5NhZPlNtGNXVw++OBpiDxDjcx7s4bPu4ifSn0MmT62AvAMN6Yx6Cz8zWdywLXuHoHMLs98z0FdOnhwvWwSzt7c2MwjWdnYD7PnFOQZCF91BDvzrMgxPmz/4wQ/Kn/zJH5ftne3ShSbvgDbdg3aWO6NB4ZX8arpQMryCQt66usR6uD6nikpQ8T/hJIHJRFIgJk7N55h3ZMNZBBAhBowqtZqahyzzWeAIbVujrHKlfg9B7illV2dGVDV6fnQKAq/rE2YU2ITlG8RHvQsIehKAWBPX6vXaEWtVk6ppqmYL5FLM4l5PXE+AU5f1yIimr5FBIShxCbKEaHOWS5uWR0ciKMM7xtSMDYbB1CxpHmoANckuJs5Jy2/81vfKa1/8Wtlc2SlLcytle307ndZfti8Gs2WOPvXK4kI0lhpQnzAZMrQ3yOy7o7OLScdaNIguxTagQNfQJfpM227J6EZbtbeRYOFkDyHskY+xmQbsAAAgAElEQVRpiEYB7qyvhDuC1wFqwsT2zib+LtqT2fXG+hpuxW4ZGR2NKZxfXo6/aYKE2127e9Hs21sB1jbvQyP4urxL9wB+p+Df2twu2wyKI8JdI6PDZWl5sYydGiv3796tioL+drJZD0KqFYQuJVYPZOV5viRQ7oybLzFutFF9euHEAXDacJkM7WQyDH2fmWn6HYBRRllr4r1mKxV4FV/KVdkHJ8rCg7fgDF7iRry+trT6o7axyYkpTl+PaK00RMv0enN9r3cLN5tylNA2LfJZYNARham+U6uAAG/4jChXbBRa/FTKhzDercNkZL8LOIFa96xUf0Wz7TJYNohxzc+aZ/MlbdaVg2M0tz7sIXRvbe6hyUbLH/2jf0x+aXd5eP9R2QckA2i3YUAnw7rQeM5qO9BgmuXu3v4Etk9NnI5PaGcOMcNHaCsHhBoPTJUhNNchoN3eJnyDSd5EWwoO6+sg4H0IKGRGJ9qpj7r3mPUfMOMmxahs722VdUxuB0/a2GXyZBuduBur+IJun+7s74tJduObIaQ+4pn9mHfNfTemfn11A7Dvll7q3WKi1tPVXRbwP7O9Qx7R9iL+7dAwAwmejBKo31haonx3mZ6eJs0MS5I1/GqyK1yQuODJBAa5AriqzwAd59SMdFARI0flglXki/6tgy97xBlpmeQGDOIWWeiWUdaZeoApQPK96kpxIcZyC38atzZ80zQWYGZWnqzwlKhmvGpYRixmvVYkeCSI7zSYdWmJ5lVNLMDyXzQG8JVwtRF/pas61dTn50y9IZL2HI12O7kzDlNZAED5w6c6AARr7udyDWVACyUzQJh9uz3Vz/vbB+Ucs+0/+IP/pAz2nCqHW0/K6VPdUpAJxw4AMwdT59tVjB1APgDYBpl09KAVFbJBbQeiDzzowN/sJbvHee3oiQHM6DbgWClDhm0wqe3tnWiVPXzH1fS3v38gZr0HDebGtz7M/So+rH0TkAeH22V5dRmfsofRiOBg8snRk8QuV3AJtgiiz5ex4dEyYEyyqw/fchMwwDN42svkZ49Jk1pvaXmpdEPvxMRZ4qNPMf/txFAXMOEmdbQwgdpgYHSVqXPnGIBt5dO7d8oGk7W94138XVV28IYszYPkOzKsAU74zkcD47oZziNaGJHuPzrIEi/KJhNbQan2B8DIGfYGpA56K3Af2D4ui+dhfgWrVzhvnlRyTSlruWOWcr0vclUpwReYSWlM+di58Slouy7a6Rd4UduJ5KCGzwKQBpojpTFKYvYljCMhFRpI9gn30mYI8j79CGmmFr9YdYCmz+N9rjI0z9X1aidhEllBmpQ3iRasgIZaMnKdyVmrm772tw7KCy+8im/1DwHEUFlfxmdDQNniSrk9zLYa3fc9mN6HhnJ2O0hAfQ/fUqGvIfC1lWU0lgJrQfjdaN+BmNVVznfjC/aivYypSqe+3SpaaQ8/dAtzLOC7KGNw3dHYKbAx1ZpszV4/4aYOmC6P5YMZ7ntozy3MsopALdKLJlT7OTY1l7oJG2hoZ+bJ9uE+TWk77SjAHkJUG2hQ/b01ZvjGZnU1jD9293VXbdzXVR4+nGFwOEm0HSQBEa4K6dN6b1ZdVCZiAPBoKaQpmlEZ81nZSqMB8viX3Gc9dsc++a5mlXjlLggiL8FJHd4b0NG3FPY+4UBDWacHB9bGqdfXY8ovjE+hta87Iw0hEi66rdybrS/nbF3CqYx3fQQZ7LWmCXbypj7LkqHlPEGxqG7uTMPcE7AJPDilEKwr/iMC95rmoBlIr8uGmnOB6MENOajbAPjOUfnar327/N4P/hCzTRxyHR8QEHfQgWXAppaUgduAT8Z19/eW4eEhGOz9h0x0uqMhlhZZnaGMGnbqPNomqy4s83H/EGvXnYILf290ZLT09+Dn4dd1oa16CWYPAPTnr14hNLQGuJfQeO0AZhVwM5vHd3QyYyaNmsjJkislxi0jTP7sACi1oP6XPNWkG/B2vdxZteDvxF1Y39iMDJAKgGZCNTiShJX5ubmyurySWfoiYabxiYlosRX8zu6errJCRGALDdxhfdCByALw6gcCSECm9hOgSjD+PXyAFI7Kb2UU4AoyXp+ZdOviPhdlQr8YoQ0FW5UcNTbaVOdZm+37QVlbb9zFlOf00dHr68trP4opt/naqERbMeYx9Kg9mwcnqEQgKXgK8ZlK0UQVMn4GWNhr/QuvtcDcml3DSDfMmMYlWLobWpDP0lkfMwKhAtOhzfn0AF5p0qzPlC8q5wLMYaTtMfP+/u/8Xvne93+/bKzu4VctIyjihGwJ2SUUM8zsWNo2Ca24bGeAfZDJgQNJ/68fX04Nt7wwRyY15negt7zy8gvx/9Y30URloFy5fKH0QvyDe3cx3UcEyqfKAKGjNfzDLYDocuaJsZMAbbecO3eGxIqH5SlAOTpimXKesBRgGibWuLK6kkmLGm8bLRfNA+j0UfcJWcnSHWiy2wMDAywtYkaZKKkt13YJ7APELl0CeYiMBvBBnTSdHhsrj+7dIfS1Vj69dQtLcLp8fONWee3LX2AyA6ixJs9eulLeeOMX9IskFAVIK4gvfAeOAWT1B+E114/UpqBInisssWGW0yGDSiC1892JoGAWJ3zlADfIJopJhYQ2drHF/Ua2J88x9Omff6QDSVczXm+nbuWuxAwXNQ9qV7W3J89S8OgHAVDRz/+ADtB42DU52SS8QVk0pfMeHyYlYa0yHKAa41RJx6zz/tlkDOI0V8BR9IX4OkHKmfRY7Wv9Gd0IUnDreO+uH5Rv/QffKd/7rd8tcw/nCEivopkg1A43MnHUEnsArgNaTH5wUtCN5umgvnaWHBfw0fTTRkdH8CPx75ggnRk/xUSFGCATjalJ1ssprxa9CkBN8DCV7+nsNCGi7pjwN9/6OWa+u0ycOYM/WZ/icfb0eLl86Zkyv7RSbt66W+7e/gTQ98MH/a893ABm60x6OrhvF9Nr8H2L8866pVeXo412QRYhHrQc7bv5zpBWN4Mpj/vzPmzh5sJR+crLz5eZJ4/Lg+nZMvd4pgyNnkho7Pz5i+XWzY/KQDerUoScVp3NAybNukc0JVq/3QmQMg5v+cAX5cUSWFwqrY7q4Bj+a+ZFgAAUhv4XrB6MA3Ai4JCRdygvQk9IPnXHEpvB1MjD4MbgK6mVfhbhUTzAxxgXtQVbnrdwhoEtadKjhtWOyNzLaEgJ8Xvz8D79qNynf4I2U63r13XQ6WgoAKgjIJH+936rkBl7mLXEvHS4Pdk8GmXsqP+kpRXfbmttp3zpS18tv/v9H5bHDx8DsCWtcvxQw0DLrMYMYq6lYRtfcx8CT4yNEkskrMPnLYC3g4ZxDfrKxfMhxlUaY5aGx/vRrnVWvVnm7z8tCwusDqHBTEFbXVotTxeWEqIZQMO++MJVNNXd8umdm4RyRiOdzo7usglwBgaGymuvvoI22y6f3PyEoPcmfGpnIJxgVr/DTHox5tUZ7xaxTGfJRhHyVBDO9eIydKCljAD04nLsAM5lTDYaALeDEBIJI2Okxj17erCcHe4tHccny+2704S/5sud20fl/MULDCSUA8B67tKz5efvvMmKEEF6eK6bYIKF9MTViky1lgJWRaB2c2KpnPiHLJ30ukxpXqf7qQKkhqyUm3IWG95T/UffVTi8B8EW5gv/xYztKndjph7VWjsEwNPklYkpxsd1mZLCjQbrjVwRDFTqTQq6iZsAFuITz9Jfsz4p4uVXy9swf9MZ6AsIfa8mXVMujRXk2c8NeJuTroxCifCwLnwY/+1gmr74la+Xf/D7f0DiwxZLhcxqMas7CGlpeT7vJtSqfZZIcuhB4xi+6eVdP24PQGyS+aObcWJ0CFOOX0nI6QuvvFIuAtIVsn30Hd9+881y+fwzpYdxO49JHsBXm330MPW6nqzL8BRtO4amdU/PIhOhFQD/YHqmzLC65EYrzd3tT26ENVeevZSw1Byzb9Pc5JvLij5y0EnLHOZ/HeAat5xfNFOJGT38sMwmqz9JycN0b+Db6scuzT3GaqyUZ8+dKge8e26EgTWBfykdG0QRTEhZePKE9tnGRp92CE7qmxolcEHAOYUz86QIRrACEJlg4eR/zK0j3mvIIKtuCE3TLi7il1KH3xEN5byHeyM25YpV9X5vT4Eqz9RLWYHsfMIQYWLZFjwuNY557rlzU4DyuswNOAGVjq1V2J5480NGAudDP6fslA/fzITJ8yhMwZpnBjGR6iCcIvMVTs2NpCZMky6BpsGHBRg0V1u6GUsiGTp5T+vWKYp9gXRDTZrB7//ef1S+853vlblZguJk2zgJ8VlFyYjCr+tk4rE4t0i62HqWGxXAuTMT5eLURcpuALwlaGCdmXuclZ86eaK8+urLCfEssPKzjp+q4AwFLc89ia86j5ncxFc042f01InQOHxiGNqOyus//VlZBug7AGg1ZQrf1/ApN/HpussLz18pH3zwAYPHlaDO8vzzz5dPb9+J0DXXG2umyQFy4pIjLGk605b5K2hGZeBK097eLoMD2gCrKXGrK4tEIjbK+TMnSQT5qNz46MME1Tfxq/WNjbz1EgVQAUxOTiSE1EOEoEXeLMzHX1SmNVxU5WZbsjphH+6LC0X/YsK42FRKIkCcRKtyPq6B3wWadaht4n7x1gCQGEnlIJaqMW0qJ2StWqL8Z0qIOnDZXl9ZWPlR2/lrk1NUcN17DaqmEu5NI83GbCggkxIbrLMwcxTjg1K+CxPbhc/U3d7DaOyi026C4BX/BUDCLX3SZAvZcRqIyVIrkDHjKGLmRJ8sS4WOCDvGf3tzgIn74e/8oLx49bUyfWem7DKBMCS0jQbIEKWMKzAP7z2MiXYW24O5unjhGeKFI5kA6TsSlCuXnp0iURiNOTZSnsV3fHj3fvnx//MXmEYmMsQ13/jZT1mfXsQ/+6R8/NHHjKcO/LNdALdVHj+eL+sAb/bBDFpuiVhhH/HKzfL46XKZA9T7+LmwN4PtyZOn+JYnypP5pbK4uJLUOzXmufNnydV8rBue5cI2Vo3kvcF3gaPZdKavhlojzunMvBNtr2w2ybncAZSnWdkZPzlavvyVL5YNNOkNTPiT+eUMEmWvr+yyaC85pccMkFkG6/iJIehYDCCScYBcgx2xBP8SU2RBIE8iQXXWhAsjJa6O6FNWceib+lhuJ8kCNGehDfFGcWU2zuloXU4mzzfWUwtKVfzJXMI7Aav/qnYWAy2vry4BzAsvnJ/inut2OuaXws76rMAO5g9MC1We8JoghrgEWdFIrlDIOEe3THTlQO1oNoqY1utw9NbJknWqxiWO0QKVzgQlzFazx7rBgWq+BeVB+d3vfrf803/yT8r7735CUJvEBkBp+4ZadjCBhmH02QxU92B2NedTmOJTCHB5aT4C16SdQNP1sB6uadSRH2EGfOeTmwTod1jd6S/nL18EOOfKbTSRT3A7dWqcnM2zTI5O4uNV06qfOgbYJzm/wYRoBU25yf17zKI3CJY7+3elZwPAzhvrxBKocYzFPnn8mMFayiiDQq3e65Ij95jB/uTxE1aDVhlY69Wq0LctowPwNPuYAOwucU2D0yfxmRfwJb3vH/8X19mSMYhG3cpqEkYKLbtf5tDCbQBoeHSMDKVe3JF2tO0yScYrxEKdhDApDSARiRYb+jTDSIO+A12UhoNDeXE6dIuRNgL9kbOKie9BN9cjY8pXX5O6ONdEa7AFZgSx9XuPGVqCt/kMUlsGI9WUn792booWryfrg8JW5isNCiA/54SEAR1eqnKX1HScnTx1s5ohEDIefgXg3Bq67BRVheCocL4YYLehz8y1hZGYjxFsZfksipaGZVYfIZMffP/7aLI3mHGOI5CVBLy38Bd30QoOKlcNFufnyYvsKScB4wDxyqkpfEY0hBniI0MD0NiOXzlSXn75ZbTNWDkATE/INBo7eTKxxnX80g1CQDOzj0mcGC4L7KtRUILuBPHIs8+cS6hsEeHOArAVgNALsOXREP6cLgB6JkFuY4bDw2hqfD0zh9wj7uQhT3CmT4Z6epiIeM8m4HMFqQfwmAWvyd5noqMbIsDkmQNP6biL9cTIMJ/VYORlQqOpZq+99sXyzNRUtJtuwAL93gLYA+R+Tpw9Vx4/mqF8jenOs1LUiXWT91EG/lVRKCPqF4wm8NYkXnvXkBPv8rq58tNUZl6X/9YnrVYmVoIX61Zb8p0/kXlT7uLK4saoo51tCu9obXn1R3Uzmn4BDeYQQTbgO0fV1ACE76bFGdqQYXk2OI06s4tvyueqLasfYUzLIJGPejHQbqhAglThag654AjzpO6AGeJ5cobA1l+1H7S5j7Z89tmrZRGzeP/T6bK0eggIxtE2GzFruwTFB9oHSeLFt2LY93QT/EaDnrl0AXNKcgOfm0/OPUCTKaguVnA+fvvtsoRGmbpwvjxCaGfOnSElbra8jT/o8uPJkT581E7CPZ+W5bXNMv1wpoyNnUL7rpR5JlUCrH/0sKyTXreHIPcOWAokbnrA9X36bBKGT3ObBBQLDJhHgL2fVLYu/LzOTQZx+N1Szpx5hslZX+KczvzHx1mmJEieB4ahYYydbuE7wko2AZoDSpIIJn+bvNFdTPr66np545dvo6UPmIVPRR5mRclatzjfunmzDI+NJ7x1iK86iO/ZR+Kxq0MCRwnoXlF9ZLx/xMoRdTlTjny8hjCiRQEtUqLk50cUC18plvubV8RPPae1gHwFyr1VI+djytdojCHDCu7m/W3nmJWjla4LzKDaK1bqG3V5LoQ1VLQ+hdpS4Dm5UVM6IqxZZniffgMn03DqEYTUaUedaVIj5bwO0emAo8obvY//ZsL7lfJuP/gHv/dDhtVxmbn3qNz49H45NTGZZUS1iyOtE4HtEIR2fVtN2dHRUp45dzYB5WVm2ZsbazBU93KP1ZGTZfbO3fIUMDoh+NnPfkbm98do6nYEOJIg9xe/+sXMzm8Dyl4mIxcR+BpazImKiSSXr1zG1B6VmacL5TGg22eiJKg0TZtMxpzQdZHvqcmcZ+ZuWQ955V5sZ9zyUL6Z+W5SiIP9MaZcF2llRT/SJz2TFcQkUs2lFus0IZlJ6gZ+5iZ9F9ya+lXqO4kFcC3+mXOTaNH5yGwIzWoKm27WCKEsl1wHyQ9wUK2hoXWFtEiolJjtpgn2qXM1L0HpKRal0ZAJNCcpO1ea14QMsqKuuADKzX/KnAEaTFCF8m/OyHM719SWecCCWhNs8O11JrU/apu4ND4FaK4HgBAQEkIIjUpUABsYoRHZ2wwDZWLWbH0HnHaszrxtztmed0KsYIWhlRhGBJ/zOBTrzzU6gtBsQ+oDYv2e1Mh3fLZJAtejg6Pl4/dvsPoyU55/+ZUyee4ZnHgAgbZ00Lgp30cNnjt7hkyiPjRFG+ZuEO0wUJ4hSL6pz0ac0idgzGGC15ik9JOneOfW7ZhQd0E+ePSw3AKwtzh359596JbJaG6EN4KPdvnKpUxytjGti8ur+Oj4awBCza2GW8J0qsk04cYvN8iO72Qyto2205WoOZYk/nKPPpVhG4Psgk5wbhAxcFek50zEWCcEZGJJH+bdQ3A5oWMMsuq0Ak/1N3fDP58yN0a0wA1qQ4MDxF0XALsJzlVpGDP1CR5j8GQYgPaS5PHo8WxDa1M5/M+uTz7GagGgqi0dUFVpiA+BbA5pXd8GE4jRwRHzTUllaey6hvzkX1VIkRGfs9wcZxaAspEvORaUjy8rKGU44aKN1Q1MuaNRVCsIRnRNDHWsQhItV7+SkcUyn7MwM7Q1327HrLMyRlAUPETzTwh7d41hMfLQdHZO9WsbPniJP5TgHx/tWALy0ZycoE39HZMMDjD/p8cm8GE1PQTJmYiYg7iMj/T40SNAgJZjHVvhX7l0kSaOiCfOA8ZzjcnQHKa9K7NYgXPt2pXy9W98o9xDQ77zy1/GBOv/PUWgL770Sjl9diIa8cHdB5lIjY+Pse7NWjPAHmHp7wiNuAuoWpnlHsMLN7OZgW5gXo115cplnuXDTHrjgHDP7UzMzHEcwMSvowWJH2SC6Fp4O6+naDaTMIxmGEo6eZbVGWb8+o/P4M+a/mby8QqaTlPdS0KG+RsHLH8an+2k7S22Y5hEPHaSFauNpfiWZxmgH3zwEfUvEnkYL4MjA6lnEUvi0d3fxUSonwQRNtVhZQSEERZlzRfctCrTyIry0ZWcpwBKB3mJVw5Pud1GOdbvmu0qe+UbvzOAVN4Clz8NOechFOIAPNh+kmMAtvd78HMq7gDUpDKR8YwasKHxBImhj8SsBCPX9C1N+UIs0SaCUoCmZYPzVFFVtiOG0ZCGiVsiiF2YG7UtAelNQzfGC66gNE6nwA0lmc1j9vYI+3XmCLmopT/88MNy5epVQHYN8zTIUuQ8mmkckLaWEwjnxefxRwmbdALsucUnJPv2lvP4kV945aVyClNtKGYWbeEk63lWQz65d6+s4wYovB002xjr3k9pfwmALGMujbntMimaeTxH3ztZ+kMbIZCTDJLBAWKZAFGaTQDZwDzOL6yW6UcCjhxJJiEdpJ65h+jECPFPtJjmXf64XXecpUtn6fu4K1/84mt8nsMVGYBXu/QHtwCtqeAdIDu7Pn9zkzp2GKwnMxgdvLoHHRCklnJpVDfh3NlJJkNfIIS1WB49mU8bp8+cpe8l2vvweJ86T5eVWzfiBimLgBJ5awFrCEiRVpBE84kF5HaIZWJ4AQ3lW4EUTcfZ5ORyLvMTtQuHGAgeqCrAbNSpnY2pD/ZSNKBtfKpr5RWIarBKiuDS/1GbJbqP+eCjZ3NerZoJj3RT2OB2fInaj3SoAs976sjZZ+LhKke0Jv5Euo0WZaCmIzH/tCngISTCPnX2VLl65bnyzpvvxQ3o6SUvEu3gpEhBLGGSRzGzmvFhTJgPtJplln3A1oollg17ewA4ExGXKe/du0PY6XS5gba8zYTAScwcwNmnnvMXpqLRpmdmyuTpc2iXjbgr96YfxsTpx31CULyFeKMmrwtts7CyXs6QMNHPRGIC4KiR/+71n2OKD1l52WC2PopAmAQxGN0+4axbIE2cOR3t9RRAKmiz2F1mfP/998sZkpX1j0eGhpmQPUQ7szbuzklWu1zB6OIpz6uA9SKb6lxCNUt+fW2bydVSXICBwbpPaGZmNnw6d36qvPnmu+QOtGLiB4nRojmhY3JwkkB+V7nHen9yIBuKqAmw+P4RUV3tibZRlIJTjRZwipJIMdaxzmrUfmLIMlpCQeykhjOCmNPiwghQnYljzlEULrR4X8DkvRxtY5eGp6DruqsQARtAMQzkDNtXnep7i4YaYNom/wSnANHsqHH5wKsSEF8SoqrP4fIde7EJXiegLpFpHMLtqPVYC3VBeur0si7DF156KVozGTj4dvtmltMR8ykNUZl76GYtJyhqo9mHM2gWci+P2jOBGCZY3k9eYg9a6zThn7uffsIa8i00CatGaKkW2nDFBRIAYkcmEksLbG2ASW5ZEBhbzNDBYvzLVQDbwgJC0vkIui+QTraGlr197wGzajKYAKnZPRNnxtFcgJ7MdZOODQdt82Q0jx40NXGq8HKLGOimvigPVNhl7XtkqI+VqGHcAP1VtPC+ZraT9X4yi7htbZ1lx+F+yhFWot+uRI0Q/tJHPTNxioFKyh3mf4MogjSeQavXXNNFBgWpgIDeIL5bNUaIg5rIbDgrkxt4LiSMPeta+U1lpKyczCYljjo9qvy8AdcsGpGTgEg0IIa4Q8ZuBWR+DVKQe5fg04IGjCa0CEo0rO4e8o8bQLhoa2PzR0niENhVW1KDgXEqEHCCJgenAxrocmlQggSSZfxv+Cfl7RT3uuSo76q50kHfwczp/NcOg1+rVSNbB70PwdDm+TCJ+s6ePUsohZHNbPcKqWhOYG7evI2WOCj3792te2Roo5P4oMC+8+ndzL5P4etpf539uo791a++SqjpfrlLEP0TXj4dw0D6V9io9iw5lLc+vVWeEAt0Xd0QjRObIfxY8zfdJjEJ0Hyy2QAa2bhgKyDqJYEYcvEd2WyGi7NAKOsJa9J7OyOpX3dngIC3We2LaG5n6yADQe0zM14r/+iP/hBTOlH+/C/+uvz5X/4YK0GSMJMpxT517ixP7/gokzX3CekSwHBo20ka38svXc0CwcTZ06z9sz0Ef3fbhzBg5icJeT18OIurQaAf3/Wtd97LRMcnd5h/6mRqhCVYs7Oe8mAG+7TAIBAU8THho2DyyN/P/shhscd1ygYN4gQcxDJyymiLe/Ez2eV703fkBFaxgtZK1cbxKXkinO16zrqbR4W+ioIz/tBRANEsIkAAjKbc82Dos/doOcppuiVU4tSYAtetsya4ygDNdrLDec9M3Jatlzfu5N11UTSytrwBaDfp21Yb/u6lS5cSEtkngD5C7O3E6ABCO1PuwvincwsAnq23zGLd0agZdZfh8/ieT58+RfO53t1WLl84x9LhHfzMTs6zbRft+O1vfz0a4KMb9wjlPCmXLk+Vj9E0g8Q3VwDRHuZ3C5/TLRBmjauB6RgZRz2ZGbtd1nX0u/fv8SiZ8zymZYaY4ib96SizaDFHfwt+X28ve7tZgdpHQ+3Bqw4mcG5XaGXV6Vvf/ma58ty18oPf/2H58f/7d+Wf/jf/LSl5p6F7ozyamWbS0wXYWFvvHojm7cfXPsJimIxihvuZM6dIkyN+S3B/CS2uX7oNMJdJZpkE2Hdu3UW7Mstn4nZqYozyE+Xew2loYL18kVDaxQtxLXyWkdaxgkuJePgXWfIWqf4KcIIFBEgPudjQgJTWHGuafTcZxyrEQyIuVKQSiylXYyp7vtuaCkk8CHvDZNJRhwAYOHlpbIoy1xMc56JAcXG/mnBvoyrONSdE3JsKfE+tfrcQ4NKEqyX3MFGab1W2jcUZrkVSr6oh2SQAW3BnUMAkP0vaCBrrLL6YG8LGWXE5QQqb2w5O48udGCVexyw1M3J8sTjGolYAACAASURBVHXS11zKu8qMe42Zr6EbB4IW0+whTd+H778HcDfK73zvO9Eof/uTn6PJ2Ek4diJry/p5MwTXtxH6zvY+CRB9CXo7ZjYBiLsQm8ufQ4ChH224tEAyRPtumb5/hyVEkkno9wg+nGayE1D7MAgnfCPkgDopc/fmDub6uUtnyw9/8J2k1snDi5cvlueuvFj+5m/+CvO8Uk6RyOGkTgD6M4TGTf2VjV2Ad4kcz37itJ1kzZvf6a9juN/dJU236pqddBe3IqElZu0+4UMZGOaroR40MytjdIuEkdGErIxpJmyjkgksAIywQtOpdPiAnFVO3IXWUFbKO/JX9vDZyVusZGMS1tSkAR3lAxRvoE5vVmvWWHezIr83wGq4aJ1wkXNxN5vnVyaQhLosQMk9FKbiPLw1G8hrRdav5NMWDnwO1rzjI8CIOLS8e3i/s7x0rFHUW+qvnnnCFn0TrbRP5aeZBOhXXnjmTDaKqZX6AKZJfgfsy740dRZzpDYimI12Y9CXjz+8kZifMdbqxB8nB/Jv/2YWn22BvNCjcm6ShwbgO/aiaRfxJTPbBQDG9HxUzLB9RattqyXhoFt3BzF39tfHtyxj5pdwES5fHmXCwzLm8RLPPBonmWOD9ehBtl0Ms/rDrktmzS1MLHwCyChJHP3ENYfGWD5lM9vFK5OEm9aYkOjD04fj4fJb3/1G+b//3Wvlzs0PCXctM6AG0XbduBWk7TFoHpLwcZoEDN2hXSzQGv7sNgOoj2C5LsQkbg+edeliQrOC1rxz714ZZTm0Bw25xHZg9xVdJDIR/xyt65ZhE6OnCEk9xYUxAyy7VOGRycwKJG4c/Vbz4WxFwYixOsMWuPWcMBYIyXfgvZ6vckfq/GvAPe5ixUh+Z7QB0Hq/ABACTH7xejzazr0wOQUor+fXA2jZ594AJYh1XNUGqCON15lTvkGO5ly/wlddKWgG0D0vOJoAjx/JbamSNtJ33uuMHzA6INJrsmoIKF/AHI2TTOuz4A8RhKNJDexS4JOns1lWM9VMEDoB8nzup9wYGlYf0ZUgV3+++73fghZntWS9U4crIUv6kQDI7Q5rhISclJnm5erzfGa4mHMmBc7ADXF0IeA1ZtoGlzfQvM6Cz0yeph88emagk8nOGJMsHooAoFcb6+en8E1H8Xd7ugYIRQ2X7oGeaLz9A0AxzP6eQjCeSdkT0uFW9gZYh38Gs/7v8Kt0fQg14Vas4I+aqbVKnPX0+IlyFlfG5yMZOLcvllnCeszPzROdoM/w4uLUVFaozNg3Dmr2viC9y0O9XnrxeUC9msHpyo+a/zF5oLvI7xj3I78UEi0hmACkSpLvsZaANwqU881Zu5pRftawIBoWlyX7eICLM2+KBgN5pn9AqyKq4E5lfLU5X8pPtYhJf32FtfK28y+cm+Lu66GHIklDgiKx7qEp9iarDAEIy9Fhq3kIgUJ19HjOESb1Hp/5rZ6jrGrHxqnb7wlFMQj0cTQzXnO0DqIhTiPQSZ79c4aXWw8EhbNntYWPSnbDvyg/gSm+ZW4jTbvt9CSOvWZcjSyITrET8uH0NADbJ4D+EoJ9JjPyLiYVB8TyTMhdZXnPVZ1+zPei2zO4X9O0zkzYPTjLaCdnuG3EbhdwE/SLDWjP4j5oBndZy9/YOMTvXaEu1tiJD/YPn4j37gzXjW9Mu8nu6SaE1E1YaiW+9+SZ82V6dqlMPyX5twyVC1cuJLO+j9DSo5mH8dG9f45Bd+25y7g2Y+UxeaHTM48AAIkc8Mh8UoP3prI9Ruu7J8gIwDD+8jKad4wB0U8c18QWJerDEFxJcqXMWf/YCRJPAO8jJoRJR0Q2hnhULDG3igU5iwWVjJ8Em2beCW8Uk4MX2UdpcdmyFZQVQVFwQiKoruesGxBUMCr34KCGJtne8/rS4vKP2s6RjwkV120zt1Ew5CBtQanQxVx8RT6oFaPOId7OyCTQTAHAq3pJ+aq+rTO+Cp3gNNqYFgS9bQEsR2L1Z7lo69x/Gc1xFb9rBBO6iWNvQJxCBNF72C4xyMRjn1AO68VoJh9+UJ9O5nYF0sDmF5kQ8HADgtk+L3Jxca7MsEJ0EoCeOHWSWOYDJiUD+KPPUV8Lz8PsS4bP5NnJAH+eSdUOT2pz5G+63IeWMCy1yoRHP8719A0Aa19cBHB/OoElAHIK322Y5wudZY8OCbrMs31pffoGu8sAgPCBpw7C3Q2fJlfK3/z4LSZNuBVDU6UPkD4F6BdxUT5+7y1CWreZcXdDRwGIs+VZQNvX10720DOY5Atoxr0yS5a8M395rJBc4VLeK4v432jUUUJln9y8mWvgC6syHyBd5HE4xn97qX8XXpr4cQtt6kMj7I1RDyHo5yy8cK+NBFcBIIBEnpno0KcAlImPPInDGXqMtFTSPrOaAUA9R+Vpw6JNV08wZ0WRRGGsVt0lGSVa0ULJGr6BxAo6bo5iB3whjpm3YBSsOSKlCjaZpD8qGANW65S71GWGj+R4qC0NHcmAID/leIIuzHrmzBmeot2ZtC+ddhRyaFpm24RhnYOtNVY2zjLy+9nxeAqAMXNFgy7ymJdzkxeyvdanAz9hhWb20X0AtpYNZ3/6x39mTKO8+tKLPF3jStaMBZexx+XlNTKNfOiVmhaTJr3Q6Ikd8h93mViYnOHM0dCHOwadtW8x+Yj/TDfya2j4R33MkFfQnP2UcZtGTycrPONDAJQngaDVu7ACT1kEePB4oXz5W+fKFhp6ZW2x3Pn4o9KyuVoWCZjvEt9r7S9owRm0oLsBWukDCcoMRlecXiR8pkW4jbXoIWR0+fIl9h19yqSnswydO1c+/fRe4qkqDp/YsbnZFd4KKH3Qbga5isFs/v2bTKDYu/SI/reySY2mcnhd0GnNVCbeW022yAikajn+6ooJNq2kDy5zadh1ZevwyYCxupZRlqIJPqLCY7o9k9rAQHZZUodHezdPF3PPRbSgOAniuKgG5HyCpMYlo945zbvtKiCTetV6WQhIhxxZaNQGECUKvc5/JhXWDaESZdEGXkOE5lf17pM0dnhs31Y3/h1awTbVMvqIVEPYh6A6P4X1ZBbTUzpx4J9h9M+i0ZZ5PArbcokTzhM8X2ZV5uEjzOHBOrG6XjahdZXz41fyY0eLT2bKe6uYZAA0QdjFbbDTdz/Bn2P2TZsr68xwAcYWM9xRzHAfmteHIDCfjdY85sltCmgV/7Qb82y2DktKaG7CO1DVzs9T93Tj3/W3lFH8zsvPjJSWndUyy6DyKcaDPHvoN373N/Mgr+mHBPPhy/L8QwbRo/L4/r0yNog7gqh81Iuhpl5CR+OnxuArM3Xk4BOIF99eSZLyyMmRrJVvkJkv/x4Tm8wTQQDRhzc+zqzbVDfUQBmkrKtUWpI5lk2HsT4+icT99GbDP3q6WEHFoz8iW5UF8iK8EGAFSQgaciM7cSJYVS+Rs5+wMPqTePQBqRBTHznIM+t2ggw1ySOPwuF6mtG7tB5fdfbD/MEnNFiVyKbSaLygyGohAp8LRzuL7DSqqtQPpQ1JcaLMrJ78wsZQczylYzbCOd5CnW+aRkdR6uBNMv1R0NRDHe6hdiut67/Okq3H5/vsbtsLtRgpdwisvZeH4y/odz5Nx9yOqsa0rn7Wrx89mcY3nCuTEyM4/OehkeD+/la2PrhRq5c+oQbxIcm6QXBqTFPonswtl12Qsu0yIppqB1dhi5m0qzJOntSUTjAiFHi1s7pNu0/KeaIHv/UfvlrGTuN/7rEWjgkfP3ONRYIXML2T3H9QHs7Ml3sPFpDzABrmVLn7YJNwDnxvwV2h74Z7DDndQUt2JNvpUXZ6buPDmh96CP1TFy+Uay9cxU8mrQ2JmgTdxczeByFcffZK+ZgFhOmHj+GdWfvLyBO2wV1T8lwO1ZUyJW6cqIc/LHDx4iTaegU+o8kps0m4B8nSP2RH/WpKxaqvK/9bQJTbl+sWXmpGlpkfcFV9prLxeVLeU60h79KgAuX+CMuC1q2m8Z1XVpX8mva4maNmF1GjnagdoZ7gzxlpHRXxHazPMjRBXfz1M9oZAcE1RooTGU4APtHY1IwWNIE3znGuc8LrjcbcBGe2tuvNMv7kCNqBa+Yk6hL0uN7NLaPECHtJVdsgy2kJjWhupdtnny49ZdLh8p8xwxGATLhlfJTJzsXy1S9dLcPdx+WNN3+euJ0d3wVgZ5gEdTIyDcw/xKy6cU4zabv20XCS2n1brY0vkVQveuumMX1i174drLv83IlcHxzsZGIxVP71//XnxEPRaHOY/c6/4/GFQwj/bPm1bzxfvvTt58q1l87iG5Is3HoOHrBLcoAg/8J9ymEpAKWRhi1Mbycs3SBVDXPF4BZUPAgM9+bxI/Y6ESKTxkeEiQZZgXI3pplWw2TouwvUzXVOkFYZgHvU2YdW92nIPjTXpxTffTBL7IsH0BKOWoGPJ8neX6GtMeLD69MzpZVIAfYzgJFf1eVS3pwHlDGC/klcR7Aqc7rj9YAO4oOO5nmxwBkKBtBqNGUPML1XUAKHgNLnGqh1PZLBrgJRKHlRb9WckKdT2xAW91JxbVLzrcoVXJLB7bTDJ0ZlwjaMGu87pGVny5npp2QlMD6mxEKfbZjjaR7hMM68EwyfOmGZIZi9tUGWD+ESN1fhR5RDGN2DFlnbeBhBuh7ewf6VXWbIrtq4AtPOsuE3v/XNcvZET/nonZ+VS+fOo31Gyuu//MvSPXyyTF1+riw9fpRJgNpvjH1AS+wX14/Eq2CZj4HEKNNKQGIy3ptpWWpR4I3/xRWSKHq7R8utT+bKa68cl//8D//r8ouf3y6/fOMtVqjulnUe9Pr+8jvlvTffLgf/A6tH0NA/dKr8+m9+r3z1W98u86tkKlHNvdlPYmbNbvJZmd3s9vQBBzvMsE+ydOleqn18ZRN/s3jBpOXas5fL7Vt3mIEPk6fZWj54733CUyeTPnfxwhQ84OEH8yYMM4Fj5m0SiRNGteUCSSOXL17Gr2YCxfo8OS+AtafcK9P0rT4XyfuS4sY1NaPgUtDRpLTXTrw3z5dAqanA/OXlfWQeWFme4r4S2NdScr/Z+Jp/j5h2CmTxhpIBKGB1occjD27llgYonXVDCQ1EIv7xM+9mk/tZwDk+bEgQWU0EaCOcbFYsWY4iR5odzE9Gpz47ylnAG+AzkepipJgfaPrY02UeF53RCCiYvpqt3Q8Ypx9MQ5tJC4RfuN/QkbFX15OfYNJ1R7qYEZsUsQbA/pf/+X8vFyZG8dk6mPBcKz/68S+4dli++Z1fx/yulPvMRH0Wpst886wCqRldMfFxfyZ0+GMCmi5Nm4kQ8cGhP6ESRmhWN1y+JBe0p3Ow/G//61+Xv/+DjvJf/le/Xf5g5Svl9Z+/Uf6SdfC7twBahzT3Bvxbqw/Kv/lX/xLGL9Mm6XXrO2WECd/0zOMyP/uIp9StA14TVNg+wcunDLsT1PWNEyT57tk2/XcgqUnXSNg4wUa5yTNd5Qa5BCaVaP5N5vBx22ZduXEu+4TgeSfWYIetz1tEH/wFjXfffrP0MjFzpu9T7/b051Em0WK0EyAg8xriU8shV8ClW6a18DE22TajXqK4dwQbyNyyglowR8GpEXELhJCvuHwAMeVUdpRLPjB18MCDySmc+espHDRrvmmSkeAMO4v6jIjMtClkOSvQb8noCegAnnmavPQd9AX5A4EV/ZKrv5mAOuf9nHr4LMGuBbvsCIQT7jGhwlQwg8FujdhlIiITXC9eJZnDicqjJ0v4cM8w+pfqNUazYZCONteTCfwiVE3j0tIavtfd8vGt+2UR0/XGL99hX/ctAL+cnYy2//gJuygJs7gFwh+FMiNGl8U4rRpMP9yeaB/smgx1//rwCEFnJwTwq6u7pbz17jvlnfc+5LlBV8s//I+/Vb75618q505e4kH+ywGXjB3gcdUD+NJzgNCnaPjwhUVS8B7en+b5SysImtxQMqL6ezuSrOxTO8wxdXfkA0JHc8RSk7mj4kEOpu9N8MjrFVwYU9hcIzfTSdfEhQ8XCXQ/1Iz610YGzL43Lnv9P/tPy9/+9V9jcVj9Q65uutsweQWXKQAUaL7kBu+iLv0H4H5tgjbajzNINpbU0I9PtlP5uEfM9qtyalwHoJ3MC+ojiczx5XoDoGjQ12/fvE8ckwce0MfrzVlWDfcgAgSt2hWQElZJEXQ0RMUBGZUF5XyPSm6ALmYeguqmeTtEx/DtOAVweU95fBLNOCdPwvyzmCxn5zc/uZ1VGzXZKMFjn/J74dwk4GX5Dr/OJ+6u8oiYe9NP+CUHfm8H0+rzGw2BdGSZEnCRbrbLyg9sJJBOyIQVFJN2pbWPx7+Mshbtz2Q5KzW5NqsVWATDPyYjmBnuZMGkZhMhFIDLgTKz/oYlHQEE+l9anp4epYdkW7pYhVkvf/qnPyG/8l559trl8oMffqf89u/+Dq7Kyfh8165dKj/87d8sXyLgf3XqhfLshRfLSy+/XN5+600GCr4yGtikkwMmQ24xHsL8u0/JJBUdCweOT5BzD5IZ5oaP3nn3AwbgPMujblc2ptpXrl69Vu5jZfxJvwGC7AusENnPfvILWuCTP0Tg4xPNZX3MIBnFNzXWukLIyrV4ehgwRvnQR3NuM2tGXp5DRdHl6os68wlu4Uc7eaNiQ6tnREU+5rMyB6B+rpMxMUOdvJoBduunnddv3rjnnp+JKeJV15s+VDPqD1kQBgEINj+RAqEejpgAzw8czb/GvKA1AHXbhRdU257TC3BI2rBa1MGulrF7ZqkPGktES7rt9MXnX+CpacYpWSlhFQh4Z/XGBwHYlpk666xBT888QVg8oxwA+5ho69OsaXLbcdKTIAz9FE+SQj/a6eSJQZY6BwBbK9oODQ0DXf82iG5AfQdgmjThuripei4NRvtTedwLrplOd0iSrnvHt1jx8bnq6xt1J2hPXweDhScK4z7cvP1p+ZN//aPyVz/7SekZaSl//4/+HiD9bsz+nVvzZbD7VJk6ew4gDbJfZ5z1+icExG8gSLQveZNHuDFmMqkIXnj+GsuLPfS1j3V29hlgws2U+vkv2emJW3KBbcq6PcsMWpNFPvjoJn0gpon/7XKlWUj+CIJI8+FdyVrCPbhz61ZyCLSOLi0OkeH/eOFJ+GIGfSwbA844qtovWlTwIENdHAWisxPAAkh/YMrJi5sDKzADtM8ByHmVWsUB92qJ6EutW33L/e0dr3/y0ac/ajvBg1vZiVg1JqPRBfYMfoHkSAjgUJ8IBx6FuAAWkARadFbNVJFGeUaUWlFMcjL+ELWmE5AJMAU7V6jvgHjhWZbw5vCveO52+RI+j6Pb5/gskcDQxcj18X7uv+4DWFv8cJNPzZ0l5jY7yxMriARcuHQRLbLL9liC1mgIN8UZe9T/3USwmsZ2tid08vTaF69dQPBHCPIsMcwzaBm2PhCUXgXQS4SMtgEbXMT3JKkZUDqy3cRlPFVt7RJlAs30TG3lvYK4r2cAc+RSKxoWjcxVqiH1DcCvLW2xE/Pt8uOf/Ky08zzLnhGSiJlw//N/+S8Id82VW/fvltOs7Jh6+NFH7wcEbpzTX3dPuRr8BBlSk5PMmnFjnL1ron0O5jaTo0fGP0nyMCSl36ltc3D6UAgjFQn18b2XBYmOVjQhfmQXVmh5hewoBsExvmV2d+L69JM8sohLoEgRYeRtck80mvfqeyJDtWkEGiGrQaufKFAhmxL8Ewecry4c71TqIIvFpK/ORXIOGoIfrSptAdrXb3wIMEcnhqfIIbwOVrXdIgYzxYvOxJTjZ+noq908KJUQERNkivLNl2DzXq5WLVur8S4JNVPFR8VIpMC1x0cw1x2NI4Q8Tg6dKC9dfT4meYl4pHvFTQB2JPsy7OGItyknPY9YNXn6lCeuASRN+DLP8tG/8qkWp05NoFC6IiR/vqSVCcoJ9ohPkpf4/HOXSb5gDX7iDP4m6XIE42d55Mvte9Nx/gfwcycmzyaVzr5r+lxnd2KkRXBQOTGy3zLZlRbBuM/s281kal7929ZWfrSUyUcGInzaZb/Ow5nF8rNfvMtjsnfKa1/7Yh664PPU19HA02ipCyzDvvHznycnU1460yX9C+YVguG98NetKT4xmAGDeTR/QJfkAsuUi2zOM5NpHu1pTNPBFD7Ld4TtSpjft0g69lcwOshCcsuxkxitFRnj2XDXgYWyj7ZrfwRlfT5VoBYZ+klgKufmP4lUmcU0wxf/OXEMKJ1AcoOhp6bGjdvHyUyakKk7M6kWYDKs2srrH79/p+6SrD+brGqmKRGXJisQnY0lLCQ14pZ/jshMcjglWrgNYdVy/M2v7zpzlFqzVqrqhkl2SSqpI5qAQPBZzPZoz2C5d/NTtj7cLZcu8aBUcw65zzijKx/DfDfIrKnwPhlnR/c06Q/vk9BwIiPcWbVAfjgzkyTjbkziBDFNf0Pya1/7Bvcwm8XXev/jd8sv33o3SRlbbHlg3AFmV5JGuQ9NAxjlgT6mwX77poZ3zKbv9o1jBz9Qc+SxxsSidROnnwmgqXJO0DT79UkaWg4Ayvc//+M/Lp0A5cXnXiijPBTriLihP2fz/rvv5gkiPuSfKVUC/048/bU5FwDGT/KzLiRnDLKt4sMPPwHsPk9zh8fgwD9M9gqP976ESXdPu08Sdt+6KW+D+JTGf01rc2vwOIPWJ8gpN7cQD3ezyxTr4HM4n7L+fuHqpdT38OE0oGz4mlAk0JQbbImiyXOmgkbPYthZ8QJqFQv4jXVOQWH/8913NWQwxhvN81EscAhMsZLPOVPDRYzPMF/160X/JptcsPFdgahBvaheTK18UJOiVyK06hBbFs1yrB/EnQAhmpRhUIXLLB/GOXJ8RMzQ0GjyCuf4zUSfVKEmc5b5BL/IiYZJrW7NkCX+qlh+DJT7d9EcajDNnT8C2ouZ1zn3sSfTD9lAhqYzO9slxna0WDfa9633brBZ7BdoFR5/TR3uPlQrDKEl1eZqmZmHs9FE+mT7PPzV/jmoBKPaszKD7/AhTIYu64pWAsQWEcwZRAonjNd1Mb7Hdwcm4/4v/vTPys7f2y73H02T2fQsZnqS3Z48mAFT7WNt7t+5kzY1dyoG09J0M8YYePfu3WPw8EwkQlzS9mCalSpyBeZYtVpwvxJEGLds7+SZR7TvdzX8U3hqOqDr5wcMaMOCbWj2EZJb3Nuk62SIbI8w0jiJzf7AwQJtxP+D7igXBpQIMNvKn3b2SSPyJMpLM8zVHMhbBVRxWMt4URipVVUQakv/WcY/YkIrFdxwKsNd4kU7LkQ6k9QnCHdA2HAOOhTWUkGSSPmO9YRITB1LM8bbNG/+YwEz6+fuqfbx1Ao4gXaIoukQ4N6ZUdLD2tEK29EI4+XB/XvUSRY8TPFHnAyV+MjAVcI8rpMbSP7wk08zE88AoPOaNx9E5dPRFJgm0C0X/owye76If86EI8YiN9EQRzjpMskUsRHacOuEP7nHbdxfN2YZaNev8rB+++UKlabbwyx9BabgZZAM1oTL5EQxOG90w8s+Qz4Dnn4Zo9P593mX7737Vuklvvj2u2+TGDwS3/o8oPy7v/6baFnrskJBLU82WcMfbzztWN/RX69QY17kAWDr0GYyh33xMYbmqE4wyNWSPpTBOhy07VgfLYbWxhhwT/8Qmg6LgOBbnIRA6zYD/b3pRygHf/XjFJM5NvrFisIgOiQGVFr2OwNN1Ye2VIOq+ZRLgCP9yF/eCLasp6dPnvd28eQ7PPNFG+I+Zp3TQBENxr02lUA5M1pvCHrp0K8eNmNj1mx4SWGmhH+wRwrvSAKZYChM/mRBX0193NrYaoFD7Aj2Rz4niEO+/9M3yvSnt8s2S5DuVTbUYWjGR/gZy7zGA08HmPxkLxFr2y61ub5tj2xWrRQNRXOa+QGY7Ux9k4cOGJc04TeuCEzv45rCFmz6n6sI2wmOLNrbBUCaZQcpdeoSJC6LabYhTbqM0cxrvp2A+C8syh8HpxpKIBmBgB4AJL+0Kpmxck6L4Q8F+NSMWX4xtwvtduvGDXzgCZJTHkX7uX/fKmNZ4LO5oT5N49EjHqBFPyZxAdyaTEItITe2g9BHf8bl8sWL7Hvnx1UZOIaX9MHHT0+yDMl+H/qhmd/iHrcHu9d9f8DnLqF1mTgSliXVkDQ6SDbl7taHt8tM3wy/BnKtnMePzfMACL4fYmnku0cdPHwQiwxuzzt5NkzoLzQnaUflyfeATkTy3x0TgtH+yVMVl4eAjwvI51ZoDcjCfa82WqU8n6nAF8wQtG4wc4XA1RHjaakPrWkanDNXk2ydnJjc60Y044u+72I6Pt+Y5kqK4RXM5w5+D5/n5xZr8gYCd0buPhuFfIZsbZ//2M+auJuzHjOK/cUHe5NOQVuYw7s+l7mijtgVJgEH1NsPyF0nztNDBBhH9rbDFQPMHQhTEBkqURvkkYj0y8mO4Mvggh+6DSZZbKCRfQ57Zsv0WZAIYDhERpHaVA2XZjiPqaQPAlpaFUSeCSTzKeTyo6s5G/iB9+9+iq89iVtS97OrratFqPWpGX1axzvvvsegZPKD1nVrh1tMDHm5KmfEQP/YxzPqlki7mnaeZUl/Y72N+xfJqjKM4153H9/o1o4FAvw7AE7ZuZHOx3nLN/lhkP7tt97nwWK36RRRCFwf+xF8YZHQMURJ+I61FHhul0GsvOgjCu64Dd5o8jmvj31EZKSCknLca7ljAMz6JnMRmuTliqgH/Ce7CEF4aIYzU2owVy4LSpktMxPr5P0AKlTNmoOq3LmZMtnUpJgsT2MtCNlOiJ420sVcE3emppkTqGZbu3TmRib3N6vJ8gwi1rZ/7de+RtinL0/NMHSzvsmKDxpUR1reOGAy2qAvbaCdtlp44htdEXDIPy6Fv2jWzmx9iXvd4kpT8DxEAeb6K2X6Ww4Wt1gI9C58OX2hA2b0DjoFbP+QFQwj+93RzIkadDYWV0Gv3yx1cIDrckbJ/Z+EsAAAIABJREFUOXicGQN4zrdissIDNTODwl/9nb7/oPzz//F/QluShMyt8Z/10zh0GQTarCltzKZN0BglZU3XpNtYJQPPZ3GusxSrf635lh7Xxk2fWwf4vfiWxyiJfv1pZGCOpr+80cmMfIXBMHFmsjy8eRNalA+ZTrv8xqZLl9AjLR++/1EUxouvPF8Ghvvik9Kx9BFq4TX945+9hnH8kQN8wzLoT0YYns4AhR9aES2z1+BL7uSjn6p04bN1NZmpBtDscsL/OcIoBCYw9d9q7iZVMcry67cwQealce6QXM18Kw3mqW3BABqAfwbv21T1CEw/yeHnT9P1E2MTEGfPTcQJv3r1Aswhtshy5Mz0/YR6OrM9geFkci6j/nONyY3Q5sh0ttnaopmuPm/2ZaOZDnABDArbXkPegBJPmP5wMmDwUwYpdUXjpCxLr2hatU/zpca1HB5AtKEP9negaUmsKHRRl/UKYP1LgSj/5JEqwCwb++soceA7sVgjJ0AAqwFTNHQpGXdb+kNVhNCwtz7YYZTH2bjNY52Q0QSP0FEjrhMcdTkSYeBfk8iCINyDpP+o9vUHqgbgITYMN4DMeTToAtapnYe59rPRbYytGj6+0OfKu+R5Ev/yPsukcU+Qp7me7vL84ldfw+9kUqrS0XeEQtkozZBMH+2YMuajmlIFFnBSXuZrMTjnP7FSgUZpbnOyF43MaXmcUWZ1HmkAQmysPnbaKvS5wLMXHR1c1FTlCQrogbo+TnkIUDC+6y+HxFDYIEKCSKo1SLvpjyJhHp8w8zvJM3xOsx9meKirXH2OlDSkPvtoGnPsdlp+0Xafh0ch5H3a3mKSsQOjNYtmL9EdhFupV4sf4HM5mTvA1zXwLpPqVfemVD9S86qWdKSqedXY9sfZtYc+kqtW1eUgjsgqkeXcAqz2dEbfyspIB0kjh/hzOywj6oMZaA7DKSuk/O9Ph3CywQw/ylg0BlJxkMdsM/DzUIQ0/tkfKYE2XBfKLzMp8XeImDOiHckphV8+yCCODZMy17+7WFhoPkWuFZdnDHC5eLBO0HyI7SaQnV9V2yJstLp2H/egp4yRLL0+z5ZnbOkW8VhsR/o6dnqs3CPRxcmijy0XC1vLO+XjNz4sX/nGK1gVnuaMkPc12bDN/ti1WFjzB+JHigXOKSdNGGWjRQWn3cx5pSOD/GpdVQb1r9c8BB6FarH6NQwEiBGkzEToFouZsmKBAe81ofSCP9xHuWYdGVN8MeVJU+c1/USfqOtTzDQZAnSTJAX3er/zzgfMzu8TNnIrwTJOOjmKJFK4qy+bvxCi2lZN1WwloRvb4CV9OuhqK1dJnGhpIEI/19V4JmYYcor/nM6oSeWgZpAAMsxxxcS+C1ifXWR+aPXdcIPwtVxK8/CpxgLepVZXLux4tGaTp+ER2hUNkLo16/JARnCNv8iqMaB9d3BzzjpDGt81za7suDGuHTfDZVPp62ICNMIyq6EbQz6a3mRdIXgHk1EKH0MuTZm88W50ZHFhjlO4Edy/ROLwzPTD7Jj8yq99PQD2hi/h20+c50l7/XURQWLk1xquwUfvfcDepQ0C/aKASnm5dcbURx/Dre9p/cmVoDOZ1ADUaEpBSxlgE0D7LlibL796kCgsyJp+URWEZwIumFMZREUhjDe1Uz7X2SuUUTfVQVQOiioL25ZmPjYOKYE4gOMaeBtD35mhy3Z24iFxzHaIdo1bc+aTNqTKe+7y8H5/es4A9Qb+lM8BUriGXxrN/Eo7NAeYdMSd3UZ7U0cmRtxUY4uVpPSNsroiFIFhWA/NL98Fp4LQlAlm46oe/qaknfNZ6z7LKHQAHMs647bHAVpj5Cd6gQHPWjsSOwJQNiZ4BT1mJ8BL+43+WoffrcKB7eFAWCaI7m9Ujg73JEuphy0jhuvcKepz6t0334OVOcdE6sandwHnGBqUyRKPkTHzfoAlUbehOAg1/9ee54erHs2wQHGyfIGnw5ld9N77s0ySNssXMO9f+Y0v8ysei/wYw4Py6P4MPjEAl6fQ/P+192ZPeibZfV6iVqAKhX3rBtA7phd0z9I9GxkzE1RQQTls0fa1Ixymr+T/yQrLYVkUbclWSLaCpIfmMnSTMz2c6X1fADQGjX1H7YWCn+d33vzqAxrTHEfowhfKqu9d8s3l5MmTJzNPnjx5ha5979RBxu9MiCAWcddXcpzYSBUB3d7b1zQ6nw3IP0SdOH4bXPW29ZKuXNMu4SxwRqtafDkOkvvoghwqIxwmpKCfmONe+QTRUv14pVRQwhHav1hKoxt97DF26l1BJY1B+DwaMVrCWLqOOAfVrHWIVbMndxnPOBE6yEBfUZFjQg6/BKZqPBKY0BZ8ufEu4PkHfrpzaldpgUTmGPMeyHCcG/kjUTPzpQx9gmdZkqRUkdTBBchwy4ew26DkxhgWpUtkHMdEQcIkgeQtTKFH+y9coEs+EqFDoXgX0mz5xBK2kSPfECseGbeTgpMm8e9wytWXCxfYrzRxAM3zveAJLk6jOfLIzraGruk6gtvtmKCxXmwkN51xIwbzaOlH9h3PfiHheOmlr7cnnngCqcFk9rMfO/ooZh1fiCLz3M597d/82z9qpz/Hogc7SaeZoL/w8lPtyKMoKWNemx6c8SnjUtbv51CIWYVO1hjKmKeEpsuad5Dpi42wihxuxUudiz40uR6uYoKPSgQ2wH/vFlMhfOBuS/dVxGfiw3vkTUEumcElpHAHv6kBnuWSyYeI6dbMzPB4isD9CIgPYALlFVrnm2+wKxAglHtpr3w3GkKapL5wCYtlKG8cObiAmIeoEJNbaq+iV+mpEA65nLQMOZt4/jvMrvjo1ICSuafeLU8A4d2uWrjJe5LtCop7QlzOLuFoEq3qZu4jqiP6mN3D5TS4YGW7F0jlDenK7lnCt1FLddKjDVAIxJ/kqmhHgs0wgLLEAY9dubiLhIAI4TrcxZ94FfcygnLG4wcrUjnE3sVDsxYwtuCY+jiHUG2f2B69T8eE77zzfsQ+yl/WmTjtZovHHfZOvfTSiyFE7RttwEFXKOc3sGv09a+f5BSMg5j6PgSTQJbJzOnG4q8g/PPgXbESRnOPYrueseZ2GqT48ITkRSpjEZvtd2eq7EIr/CmXD7rcxuiB+pH2xI2BC1uG83moL+7pn1JtINKwJp7Wzd0BULik33iWGHoFizlbXPzSqkl0AKayqKvpydntIr///e9BlF/Pmd8i+dQZbFlCFavsz16E8OzWVNdyK4Hno6tDucigXwKQU06xzrvG1tih3yBVi2IO3Mm75y+MNiKHGEV0NXELQUKYBg/yiFkci5UpKlxyD/FRLsdBGnfN6RpwbjmY3Fbz1Y5xXQdv2KtMfPLWjLYu3ZHvICzjTnHiD+cwpogNqYEz1DEnDdpQazWJsAX4UFZSk/D9g2tOTXGeEUohJ555JPJN0MZenYbe5j7sH623pzAmduo0tpgU+8AttTK3gFD9u698B2LEdCOLFG7TOLzvUawgs4DBlhaVhe8y1n/mqcfQ3MIYwzk22l3BNA/aXmtoaG2AA2HyxDX3yzNdZMwInBTjnkMUhk7iVTeR2RAPKboX/oMTymAYf956Q6bwwdsYSiDMmpHa4qG9tHQrnnrlncysdyLKFQqpPpsRdwlWeRQZBa5kGh6aOH5Q+CvQhnGj1OFDLEOS+Mnnn6Pr3t8+/fQclYsZFLYYbEOncGGOY09mWUpjVcbVlVlWcSRI13XPo1EUC8ggQvjkGoFBkjIv8hAEEgz3lkAtgFfApYhcDERZtrlvBQJ01qtt84QzIARoI1LI7mRFGCy3z3K3HEoaEZmzVcPWONz8DWMeDg18l2hNS2dezuj1FwzzMz3hddZak55AX3AahK/iueBODOISBuI07scfnWdlh6VbdA40sKWZbHF5le25ugjKaQBaLjmGVtU8mvE3L7LVQy16tlNM0S9fRpvL46zvnuHMI44SPIhS8kuI6/bumWIM+nT7o3/1hwyloJJ7mOqZgjtQRjosYICKIKxIIqiMgCVo/Dn5ZgLAi/gWEhzPFNMH/gnFp6ybS1fWkN78DdTTJvcc3fcEw6Y/sPB+sFVs2TYEGfhLfyFKAKiGbNgBodytgBCG2ZrpgGheE867y4x36Kqff/bpaE5rCfib3/4tCjTVPuc0syvMDjUVrbkTZ3jK6+R6WjXboFl+wdjqBsYANHrV54IW1FZnJsIuTLkAr4W32x58Q5zxsx8RFZRLLuhs1WcJMept1EJwgJ/mXeoQeycvaknJgRGowDFVpHVb64jYkiV5ChS5dk7qvcawIl9Ae2MqYk04IRLm3DtX7e/cmVjW2Iv4KZvDA4cdru9z+BW9iIocapRfu6oEo0zoOPwQlhm4oUuUnkPpsuROtJ+ymAHDEH3qdp757BSrayxg3L2Tmfebr7/Z/vB//tfgnjEl6+XrTLIaDAO+CSy1miV3z1IreBDT/qwdy5RGZx0AZBqdaIGW+/gzIkbjd9ohrHTD+6vv/sVHWOLYcF+5ql9VWbJNiTTEmAqk9ZNxJhsgJYvx4jjdTvmTpeUHubnwjH8QmC+peNXYPvv4E8RBb2Ki5TmMTNHFQOUvvHCS2TjjOUQd779xE9OAmCB87AjdpYeWuvcHw1J0nxJwJgBcJRxbm3c5kWXWiRZbX95toXALbbPbgF0etSt2ZcQ4Er1mAu0VLPsyS3TO3CWsEDupqEisrNDVKUVPqtW5Dq2ZaBG0gUBfZFpeK9gih8PyVIobMuBCfiZahLM7Nw5tJpVSDR8/EiBnymRKQmwp/JmqN8tjICuPMucdnBDkBvvbnSfsOnYQjocZHZZ4lXrsmF9IQ9Zy8OfnzrbPPj+HobEngAk7RjQ6j6vezkRGEzmXEbbP0F0vX8ew7f6DWPM43T54/6NIJF789vPt8OMcCIuVpVUJlDzD7QAzkzRhAcRAyyVkECkNL/UfuAO/5Rn8KMro2SKWs+yke0hF4bvtD6gdkFbEKRKzFOfEgEx1SYPHIj7fK3VZua2iZloGlDVXhHDOeBkWIkJwvgc1q0cfe5JugUPsab1aZfv2Ky+zo+8QlbLCIByDAFiDuMS6uBo11vj164twW5frIDJgs36AhHtVunn6s+AhNK7Zjcc9rdpvErJEgZ9lEnmGdbYvvCZhVyyiFVW4dKewV0UQRS2W0YZgg1R0EwE/PVsRi3iRVkkxoAhLJZpunRzS0IkfTs03FUbEs2Naw5iA8S1XgLHglJeUTIi/qvzsLNSLd9OqstNdY/sdEX+bw5Lc8vodjqN+Bj3Wnayvf4CiBooglEFZp4sWDdHSHnQF1uCQly+eZVXnDGNkJjTMujWaewcwDj6NQdv3PmpfsPpz5SwnxLGN5eihozUWhYDJnSEWPQYCedoJBYIpgBtfFBfBR1J39vhpdHwTVzI4S1N4q7JVGXhOHW579d0//+jPKD2VQKJphcEmRRZPlr3wVc8kRsx0H1ZOQgSPdn2AyXO4xwBA5xQFjIk5xtrkpK5P6JYxfQf3ctP9nv37M4P81ndeCbCfcZSJmuXa51avUjPOSZv4WVY056FCJEy5nzNfOZ0rRuIo4xfg0M9Zd4yKwt16vFrbpuhWPuEkOKnd4vgucYkkCVQLFQrU1WO03K6juzNSdEjEhZVEIzXiEE94/CN4vts4DKdGuDCKE3GRCQ3PGb8SLy73erbjlHiH2hg9G2QIjV81MC1g3EDo/QV6l0efeATCYE0ckVyGKOBaglYbXeWRM2dOczDCJfQZkBpgrGtxVY0tVAZZR9pEbrubXivmslGcmXQWTv2+/+4n7c/+5K/ajcuLbefs3rZ9Eg19bN17sKySAolSgnTFJ2QEkKGTACvAvA+/8efu1+9gMmjItY+L9EnjlRRDmQmT55pkDO/cREj9bLn6cwHZEoVIkwj6Tx85hIZQtS35R//ij9oZFBdUQ9M0oMacPB/nyWeeRWWNI+Xw9zwfT/PyfEV5hXm49bSIihzwUCrgLjwblmvaveLDwfmuDfVZZJAqn3SZbIipAET0BLeil7D9QybhivVsXkINR2OsK3fQaVnONWcNByh0d5+7QvzgjzTdhmrhw8mpYBuncOlsQFr00FkWiTIPvCuZkPCN7KDA9Ko+8cuYqL71MXMNu9KMTC5OuGfR9H/hmycxn4OBWTToteah4ddNcAsoKNKQL+W5hsrdWU9sw1DE7bssQ2L64/K18+31t/+u/R2/Z7Hz/tSTT7B9+BLxHA6pnYTh2st32l/9n6+2D3/+MTbjMS47gS16NuNNQJEOXcIdO2cY4Oq3KhPIoWD9uRPj+F04dcFUOJ5vlh8EBUdyQd7TYP0QTwONP1qhVASBFIXaalQ2hXoSDp+0mnBN/BQzzFJ5VoSmWSaZFe5CwfcGAmv3de/GXN8ttGSWFm+gG0hXjxhJ4/hrcE8NmOqkqd6FO26VG91lMmIFqMThtl87GBV3zX8OwrRuVYvL/h0riVIbT3jt4iUCu1EH9iIpIgZmhE543PaQMkJUEnfUtAQkhJWH5GNecl4Jv8aTBOE9QwnKbXftGFb4c+FBYkx3br7USHaV+l1xS3L1KlHRAAHasL0aqtEb2LqmCVEBBzCzc+zpJ9vrv3i3nT/zQXv2yafaiy++2D79/HO44iI7TJEQ8K8M9fQXZ9uRF9Be34ZaIlaap+SqiOoaJnj+p//xv2cfFeNWZKTTjFUdxU9yekbG9eDg7VffYQPhlfa9f/CdNs8GtuW72KDfRo8Eou8ppcnqYMEW+ArI4Nnyy2hE81e5LcIEcVVqYlCRzjjFfSpKuiQV+JYevBSCtr4VpxwGWD1wKonSpAuhliEICRZCIhmNOlnRS6xZ32J/80WUZl2pOYgl3rffOJdJBtUZDjlFl6NYxhWgcBoQILeUI/nz8E+r0i5U+45udV3aZAbP+E3Vuj4ztGsO5yR//dzwllk1WAD14SZqAik0lxPa2kxf4bgTL41qKRPMQa/mC7yOW8PJpHacE6xa/pRQbbgSezoTvpIKhLsd+JxURYcSDSHQGaKjusjFklDBMgb+rL/gXV/g1k+3NfbnK3Wnv1zTxQo19Tco90W2W0w09tQj6djFKs0EKzlUBr0T6+6sCt1AlfDwYwdQqMEYGN2+Yp5wztffQPzENmbmBaiygFc22TEWn6AOHHbco8FeOH2h/en//n+1V374zfbUS4+3O+toR9mYyCL49gGX4VOeti4hoSpGcBM6Gj7358JmEikU+F0EiYJck4AYKTR1JJl5D1lxBMhuCMTyKePWdLMQDf58CJHZR86zsrMLOdrHH2AqD2Gv+3ouXTiH/I090CxB7mTLwxqC3Dm0ZXYe2snxKWei6OHES8Br556QUPHUqgQpvNtZkVlcvs1xKcxMqSxXcMIJ4RJylKi5URSJRYtqru5sIv+TmLPVAKUGu15V7IzvMMGZ7SL2zu8Ct4S0ziRCJRTTllDkdD5IUBL+NLNc1dNm0QJXUVgVNIXUO5mIKJN1J6enR8zSKCKohtA/P3W6/ewnP2fiQVr2PA5hrT1+EdKD0HBLyliZVneY/K0G8tYKm3uGssXZiTNjwIsXrsbOuia/r9y4SI/h8AYpA79lRG8XzlxoJ775OD3XPQwe7GYXgeZlNlkN2t/eee19iLH0MZfWWPwAhzPIjecx5aOZmiWWjJduLrW/+fGrKJdca9/60UssT2JogglsJjihl6Ec1o7AjjmLpxuVc3geESZMJV1OtW6+WnYQUQGMzRsEYbJJzEvyEGlbGftRArQrs52l7dNNhli9S6TSp4yItE598mH7a4jghZMvsN9ZcZGGpJaYuTsu3MH6KzsMAe48diXdxC85maFxJdB+TKATG7cqTJCWLda9PO5FD3GpJQ9HM2NlfLoakEOYDCOm4cSrdNmu8EwpK4TbTDl4p7tXWeMIB0mtQSyTs0wKWL6cMy25KUTgGUXa75nWaoVlp3Fk8sXdTW6zwOO4OmNaCNTcJWLv63R7Cvbl0nLOo09iOOvnwMp2EMdrhAz9SXAWuMrsg0/dVd3o5ZMKLZsMaS6z336dFR8PfTD+eY4B/O0ffavtXWR35bufpju3F/BU3wvMttdZS3dfxRrlmmEZeJZ6mgTdL//gJIrZd9DJ/BXaR5fTGDVOK0iO/R89hqlDtLTOYWL7F3/zRsbbL//ONwDRwQdDFnEOBJ0gO8F16B92z/AkY2rKs2vfnidI7A+iZwjiHRcpNionggoBoqfw4l3ChUdIaFSOmWZA67sA6UcFhRgh1LR6vsnZXG4sLkMLpyvxWBILIyFeYuuqgmAJTPtFytqcUOgHYOF+EqQQuXRJthAcM0u6F7JJN6oViIhd8HfPDtEKVhDuKowN0AalDSG3BmuoQGKTG2yHU+5Fz/E4p4w9duyRyC/vsC1E4naWKiFZ5ppkMdmC600Qxy5+0omPDRAilPgjIUWAfQ/RlxWlMMexq9XmOExVsOgs0jA8vPTC5ywhIijfhhzTNpQa4MIj+cocep3oUYxjvNJtsvYAx+COpzjXXf1J5cOy30U0teYWMAuDppE6po4bHSqssI5+5HH2D+3naBYaODa+2oqW7gDAw7UW9u1sh5/iBBH2tW9Hk0n83UFVcUXtLhry9377O+3Jr3EYAcvGZ8jT04cfe/oxcAzLB09Cnjoa4JVO+q/oxJrcckVHE6++9eP3FbCLOJBkF0LhQQEhuQ+IsCI6oVb3Hbwkw0rSiqZC+IXgjG4dEc+2r7+iCmfTtmrdtEuJELfd+C3MLS/TBc0w83N5TCJ0kL2DSdEVdP9OYlDKFQsPh7KrBGtASDXY/ZKmS4sxZ2JtBnQJ1Zk6FuGY8ExQ8RNwh1kIegM/yAM4qWQKrCrbgf3sBEQjx27XsaOrJHtYmnP15Dw23VUc4WNsLKX8ICQ8jTJY7hhzGJ6DFPJIpQx3cWs36wQGchy+gRyCObywV5hepzzgu5SFKR/f5AfGLccLzioZUBjCit9QY/TdGZcv7GUJV+Rr+RgGgzddOsuOrJFPoRi8tnqb4/80dU162EDUhMzBExz/suGY2ckZmYDmJSY+Dsc2KceTLx5vX3vpyXYd258XPoXLakeehro2s9iOsy5/+JnfZTL7K5RLzkUpeQcT13DNAdhOSynEQy4VrIg2LZ8wsY+pjqWRbZ06qVkSLbGEFUmkAUdbiRSS0lX7ncJYEC4hRMNJ1NmyynfqnXTgOHywauVajuuUTboHxdxdlQFdtDy14ic55es4LfJrcKTtHGP3PsuWyjfVjeRIZIjK8VxtToPI5I6MoewsRS98C0KrBuPqj7CtwdmWOAJFrqkihsYdoCmspWmIiiOYGU5cRxb4GcufcgXPEpKo5OByOHf+WaNZTgPutH4KKZdM2UlLQshMH3zcJa7DDPE6AYcRN8avqQqePodzug/K4YHjOMrkH+E1OjaBWIBk4wieOPERn4S3PfIE1lzDZsKCga9ptktAf3wHq/jBzuFq2CYi+0kqqrSk3KZRYiQ1x1XwnRa+1AFJygNM2pph2MF2wrZwGMspR59VvpUJnvOJ6xuXUt5HnjnQ/CkZcXZuPdc2b5KohJLawy+9hNZ/BYaNJGvgwUP/FN5CmbAlpzBSmN+8kGG6be7FlvGi+xRpvkuIAuzYyvuQ3CisFWhYCZoY/EAc8WGAVCJEycTCWM6Mj6Or6ZEhh1gt8vB4Z4ZX4WLWSBECdwmcBE1pOnAyO3XcCTE77lwmHbXXY11DKlwrYp1h8uO+FvfPaE/T/deLpL/MjFUOO6VeIyjJ2DRiHogEAiwOSdkgOHIGDhoiPzl0HBXq9sesfgCXBGZ5JW/xFzQaF1jFl97ryEO3SdymDyE6cVpFoWWScoAdohmucG9Jw6k7AfHJNEzLnY667CpF2z28HeKUQBW0LyPXVFNLXMyw8rabrvogy5gyBXuMAGd6D3XVwFR5s14td8RhMAjL5O6CSCeI3xcjTKoUVB6aYDwtTzFAcAOcYDP+ohGwBqKMFxdyMlOduLPkVn7Qm3shJxjB16TkFFRPOKGE7LN0AsnyhBNBlTBhRALI8IPcOulTIPJ0BGn1eTKYZgI1fC8s7oW+ve9WJg0mY+U4O3fcNyNh4CkccmCJW4KagEA0G2h85ZoiTIIWkZ7zmANK2TJR407FLaSZlR3jQDvE12Xdm28SB3UycEUbhBVkOSkjRG9DFi4+4E9E3u9tY7RpVPOVSPmWMC7rgUtNuWhANltFSFuF5Cn0KEOLlGuKB2lQ4vFqLRQuza8/J0sULeDF5KkBsov3tIUJeombhsuY0y27cnDQkMbwvd/5Hl0xdtiXrwVe5wu1ZcVMvuySHTCLlTQB4MvOUnHCEEh7otkoaAa4MC7uvqUR6jnmJMR8Mz5/Eqjo00GYdGk8KKkIxPqKAD25DLcirvRTlUiQm7BciCsBShkmE0RYAfqZwOAUweiRCrK2CK1al3Xo5ngbrdQcez9wuk8//DjRJQw5qDNY1bX0dBMYUW0rEDGTD59BTFo/cN9ljCQnyzIcnMTJndiPmhac2UnPKl2UQvqo8BHdsVkqm2c3W/lsTyJh2/0WcVEqiDDLo8IrEMzuod4qaooFFHxLuiFQyyfREk7MA18wwV2i3IGZ6QMH92Hy+gxcn+3BwCqq7LW07isMCsWtbyeKZtF/hVE8+Giq7l51IlZVDm4lRAOZN/9diUTdhUNsOFt2p4DDFerWrt2drb/O9S8xZCAAODflhQApiwsWaeT4P4wQE2HsMk64ejsESmviORwznlwySCUDERf8hSMZA0qm2B0Aw4uZATbLW07MGd/2xGO69KGCkp6eTkYQZWSWCXKsWy9Wq5WhYN+TKdSQVq5pkzd9CUwnUWtMVaLyJDXV4CTcKWDUCIhdljFMR95YhOW+GpsO3R1jLg+wn8bQ1AxjseQJyL3LCUcjn00qyOfqKUS++VsoYA0B892iSphanYAACz/4SahJUz++DenHTyhMS0ISWGMuAAAgAElEQVSiUieBfwIj6JuIYoRrimVCBfTmlfQsPGElSCdQzoydSGZOIPAjR3jiUMzs/fbktyjw9nTCOjL1S1wnjdux57nE0YEZelAv9mRbgnsSBm5h6K4eRYC4uN+FdvDKEIcCb8UyGSGzIA93PY+ehqGQeZAYcaSpgiTXQgofLHu6LCopmQkdgUXSliMy/tRXxRsvjIGMa/pENZUqlukkmqiT4XCHyGzepK1sUfmmQFclUDSAYTrCsuNs9p6ssGYtGBpYtfJNb4UxkNIuhxPaR5pA9V9w+iSMAUQMIcxgZU1WHe7HGFcYDCfOAwvPcj09JfCAT5olZqyw+iVT0rHBJKJlFRYuufNuGKtGj2gH4Se+/bSK1tQ7f/t2u/jZZQ5ynYfTw7WCLMrKcGYdJRYDmwoQ2aEUF8THdW8bTsa3Sd6FgXvt8LFDSCbeJz+iApZxo1VOZOGwsTqe3UTxdxuNyDJvY2xbjXAgISJRguT6//XypVgPpgWsX0Wo5gdZKviGixA4YyEfgFQrExQHYC1ZB7pAdcYs0otoTIaC8m5ryUSJu+9ihdggRXSARDJIV0qXEZEG+RjMtOwGsgwYajAqHDDcDcLj7iw8XSppbEdDZ8rxyDTdNV2xM3XV0zTsZTfjTHfFMeVdBuQk7kSsO/hSVYwzbH6Oie5B3XLBKgfdGoTm5Ixbhjgi0XhWoHCmWybd4qKUSWqRmPDzWwpkwfQmFXGRdXDv+ZO4qrt19eUyAuztmGtRaclWpZUKG6Y9j3iTkxnenxM7OeosvYbywhAyaaYxGoc8jxw7zFCE5VNwMDQ5ALcwdbPexIurXItMvCx3ajbw8To463Oci3X/ooL+9pC7oH+V87vwPOBqQlyeiAahTdkN/zU+GBCLR9hyiJPA8dYPBNmV5d3UC3jFNMWlqiKSPIXP8iHhhaUj14oO+8YzQwRrjhD62SAEx1Y9rUEbnM86kZTD6Pmu0QFljpuZ1NDyReIQNhvleNFkDSqDEeo7brOhzMIpPGRLg6uzdOUuZkTUJQwQQG6m5IPECkxyQ57qHaIZOXARQksY4hAliDKa8XEKzH0iSMpn2R16iEOtd9xxSy7jyhlUyKT8mHgBRjma3ZVnRGrfSdxV46EbHzhl9kbRIIM3gqulpfVllzunseO+ijXjTBCFT+QUSAyDVtuzjz9NI8OTBm6XacORB9kADWpY8Z168n1wKa8B/A3pPfhs/SWNHomAln/LjUfuvoYRjnqXLFMhgRxkxp9UBCgiGT4XIVlXINnKwy+teIib8SKFsi7kKCFoIeE5FUQlpMshcTMPZ5X9CCw/mbPpZUwnqfLJKdEAY+4RKRBXEvFAgW0YAFhlO8EydjPlkq7MUF9wStaD0ZBxy4QW3DRJLSjK6FTuZaGGsdVO1LWYqSPLnGSlR1ILlxQOSwcsmU3xLqaMT0kybOCjLwHcM8f9mGDx0x9neP0tB5Vu/Ysjuam7OCcBwg1kd1mD37zNSgxpKm+0Ac4wTJGL29fMQJySvmVXI8syMO+Fa9bsXcUWx8aOp4V3iqXQme3YloebLuxfwGjELSZW88RX38q9+Iw7MRm479Hd7aUfPMssnlk6xwgWVoe6AoZeFPEffKRQddEvvYKvPaCPhaTyoowWmiINQaQr0hcHwuozYdJYeCuuXO+9IUztgJ1baJ2ZxpFJdkBKWKQTYKwvPkISXOWEdfdWmVpx8k1Ih4rtXZrxrecQuunys+VzDXe09rpfCD/fhILCmAUOkAsGSwJ3cTPb1CocYVNZHSERuWiQSiJ0NcgZ+CaZCo8nYXAjtWpQntHo3mvLl7GW8DEDl4gUZlvR95gYlJ1G+1aBIDYFrS5byAdn4YyI87EueU154x/CrMp2lGJZ7Yrlkhsqh6DSF2GXiORnjmLH5cSYWxR5EouEaUEIYc/kJC9wOZsGO66mzbHiMkPZ1u6ttJe+80y7eg6FbOWLwLidBvgotjSfePZYe/LkcSZ37E69h2ob8Lg+H3NAKcOICgQ/eM/D2KXKOu5RdRQfPirhydCH9Kwy6bSwRsl8CScYi49X6pjANTxigDmlEgItr2ObMMIKvq0cExqeTXD4KHrsjixHLqEgEhW5mU0Bhi0icatSDefXWjf3O2+MVcMtvfNVgs2yHOn4XSLRFdA+0Lbpb9x5aQXo1NbRpuKdFWbmJCZ3UqFXmagyQrtDIVUU4QxYsYvKFZ6KYZ2nkTg7HsJIHBnmdvjNJHAAS8oHGLzrVZOFse8JW+WsOHoQjpqyyXIJjuQDls8l04R2lu2EmZJKuE5qXPeec1cjclwr10Zkg9Mg1iaEd5d9WkAR+CP/Zcyy7+A8jdTx9lJ76hvHkAP/brt6nnPLWaDYe3APy7wYbECBZFmtIeYV1q/cUliDaS5gMHAIjS71VI+/0bWGWxIKTsAhAt+UK8M2UneWU25azjDmG/aW4YT+nL4Lh2Hc1LmTniEoCc+KtvAhSp5E7PCXlQLCZlBvphau/wgnMEnHMM4idJaeZytUpMiFQhi+k1dai3nxbNjkx929PhKn/7b+SbSmp+iu1ad0MnULRYtZxpsbjDfdR6S6mghyhSMiFgg1SZKnEwbz3YGAfYO0onXu+A2YTZsLcJORDUByxUtXFWQBfKny4Vkw68XzuNt6t7GYluWFwEjfScc9bINGO55Gtg0tKC3qmqpjT3U+3SC4sLA/K1OfsYvUSlb4vknPoAaVYh0nfLpM7oD3cbSUttFVb2AcaxMNq4NP7mnH2XvuKpJqenfouilZ25wGHstlWcmWUuTPb0PJ8vTrLltluz9EdcmVRMixExVldHIW4gzI1KZEa9Dh7rPpdmaUyU9as19wCSeOATzgSjC8xktiMjJvInkrTSrQSqKg1k8S906FVDpDenzPO8QkMl2Gk2ad5Rex8gyR5DnELKD4UQbzFIpULgM0OuvkCZ2Fm6httM4BoAqJd8BNlfe5BKcqmjPXVWpgB1xI4o9yL1pOU4iMMuywrMLmP88OAXoljSrBb5ZRMAKLd8ow+Hdc9O/9nlAUAj6YtNUoMpKaT2rd20Dl8Gr9bLf3SrmKc2qXaJMDGzUHcwPdxxinFRdUtDiSwDXqqu4AINcwxuR9od5WWWTQpKCNfgNiVPguziXGjGMZ5ihY13UaGpU3vluXX+efuL3wppNnsQdiBlgdA2+zEXH3i07aMGhopLzqOqRFV243kn6kPoj4wmoILOM+K86vFt7KsBKDarPhJ7VwTzQuFZ33Xtl8BZP5jTgl8Z0NJ2WJ3yRJRySaj90zb8BgHj3NBIlWDIISqpBtt1iPcIOY2wZ6w9CEi7NYt+QKnhOhDVZYmB6EyDeoIMeVHh9y1/El400/KNaypYR7k3tHcq8UYexjICGvMhdsfjP8FvHWdwujn9Wv1QrlmJZHwpSby/nUMFKC4GLBbpSJHzv6OGlhqwkDBotM8By0Kf6R09tAo59KC7IBmVpJVuz+NVDm7J7ykq5aVgpew4t5v6c4jTfLoPU9V5XELpnlPs699NZtld2ceBcGGkYP670/+330TML5ZljYpYsHlttUJMaBcdKDjcWvjyYzaJIV30okOUaQ6R2ECpgcUAKpT1xNAL+8G5z3LDP6iGdvfRUfTyvDOD5a8QYymaRDCQYu4gBR88gh0OFbTTiMCQx850pXPpEzDxUBeTLFDijcrcHwnuxodOOXYhcVdiOUh1AdxEVOCkpcOXHj1ibiIszopnuV/l2XFk4bRbR+hi64w/5gJQUqwgZHVJD3UZgQICEyvhR38MLgkAxsgPw5FLGiM+61cZLfXpZc6cyxWHKw3QTu9z76mLXvXdGi9/hCCXmZDX0TTtDAhUSZrOCEu7Tjyd82iF4Otc1JDXUr/0/REJS6H8eaC4OhIVivEmfGmsGviP+y6wQXIgMGXffrz3nn0+guk6QenBPoZ13Yw1V0chz88o2yjzuKRavRLDXEMkIsCA643G2l4U0iPZRoYUicX4Wv5NJ9S29+o+hhTZ34grlAnIogqaTrfZSvnNJ/WrUMOPkTL7I2swCBfKaVU20Qt5OBHUwEFtENnEfZw/GX4mi/qwHjyRN2d9lOQUS79MAsTuE00xwiusnW1dXkC+GAFydOJJFLCGzo5jqx+UXX39MYhzIOdcW3CpOy5NHhioRZP5dNdVbGPBM3G4uiomwPoYwarZqHkwvPdRRMZtGSyliXOCbt2ZfGlSyt2CxU4K8SyXbKg5VMcMzMHUC2ITqzTCmSV1i2c4KynlGAmFaMy4pzCRPJxMOc4brrz/2uv5zPnJKeNIas2GdFRMOnDCHU9KJrCKFkwYSya1jNxumQq7v0ArH+QAVZkWnN3KKlnkqjgPjT0OLSnYBA866u2gJaOHyM779h+91H0km5gKm62yLycE4CJ1+7JdJFTpK8ijBMi7hJizikRY0kDbdguFy3D+NQkxCd5/ekMHTparnMMc5049mG+3SY/TrLJeXA4UTDxpbFAtMjT83yWAS3TKREyYySpTAFRxWinlMNNji/WwZA089no+Y6xPXNf8PYcl3DRuko4p1J1sY9+mUnXfgqStISmpV5B63zTHaoSO0lWZZFhi373QVKmCSYDK1ntOCZcU/P0yjFIaUTItfpXU4SjIAqBIHVgQVuVClCzCei9kYXDy7jxNefE83S5l/iMz7lAtaMGV1MEgzeiytyp7wh1PjJOQnLcwgVTtr3vxMrjh3rdGfGAuAQACkqJA/REaTyVIyDXwqNJ9/tJLxb6ByBMRBxQUQYwvrNYN6FU+d91N0P31SYMLr2K8e/pyKDLSMZ20CgnLFRrGGw6j3Dyoib/CV+5Xx02BSSc8iZdc9Q6VewVKb1Yo9iNv4aQmY5svJNFgGTpA1VTe2IuEjfkYVAp+xmi4sXQ4SAwbv3TBxMIgU11Jbrfh1l0cjhc0iCxGTGEzvh2ihLHXpsV9szvdCWr0y2OSZl9zBg5X74VcphOCdAMhkJbp1jaZI5MGuCGh9EZ8gwj7CTcTsVjb7p9DYXDcC/3b2A64AxGu2UXU4VIhngpuTIpRnSMDSqTmJowHLPxPfub0jMu//cjWv3XgASxqFCGjnEyLNB5f6GUSISYhw4o99sOxZoijI2tOhLOgF/irc1JRVIMXx3gpJuG8A7gg3nR+GLn0GlpvwTzvV2CVWPqkb8yFmXOPgSnpQT33AlluGJeCniqNZMA4e/rsNAkyEOIh4GIJo7kSjXFFKDUFum3dwGM3ML7Ex3jjGk51Uusu/ZwbdaS7Ak0qs0iwM4iQCfws53l9CDSPICvylNgOASzt5fvCeh8hjBSOb92ftQkpGfY+YRYUA4h7FtefQFDjD91Q2GFZqeYSWIjW+W1X02du2XLmDFjW+rlM2dmp4Nr8KzxnXVGdVk9cEjnEzBcyZUEF5EX4FxgE9wLaMwi2erhkdx5fBOSOu74Uk75ejPVQqjBmfGMRQIEs5KqNKQkEKoepuGhJdnvqSlE4N7lr/157t1h4CVsOYbIqCO4ZjOUgUsHJCwshTjhPPrD0RJU/iEzruE7I93vazdVFw4nH5WkAGSEncAoNbNZ1RxQ5xRBYI4ObNx+thz6F+SpWmIeAfTS3RvsxgEk9lbCRq72ph02Q1bQ2ihi48VuQfdtFrbjrqzwkP4bIpjWwZsl9mxXJYGI8c0fS6200K4OX6FMzCul2f8uftViK0wVqzEaWMyx5OvYMkX04EXmIhcwbiDROnW4mX22+/fw07Ey7eDizXkktk2y/AlIi7wq1W87YyVdzKRO/b4o4EjuASHCWOFjzn9gl5LlwodPlLegte60Y/GClOhFqSaUQoPJEckPvE5UYiY8HiFIdmqdUMYdSBcToV7scABxhn/mp5Dpcg3Caeo0LmDLmpvsZwgRMYLMRnIz0NmPg+VYBi7CRgzhZCzkrrf5J5CkXhCy7O/QGYV0IohhO7nWDWf+VLB5KZDNqTbs6v4RjMt8iY/lxOdAK0sQYCsh2uTXZmemU+5A3DbSnY2SqBzpAVtUuEBDGQgVmFf96TCeTkofZcVDMRb3Z4Z3QeDHuDmwZoZYOqwVai6dr9gYBTONCQa0MX2DS3DTdIwluiyZ9iVOMluSS1euEjgYQB3Wc/3PCSVVe4y/rRuVughBFZUyk3nGA7sZ9vt7t0LoaFO+D3/+2HqsBUcghXigFhkJJ7Sa+1S+FHAkCcBDTcUIz1lZttwaPMLLfWPhqOAhvd0X+nEyrQh6kzZcthzVtsgvghJfHMrNwXTSUGNkW8AmPGlL/xMKDTcu2VhHwJvzZjxAlG9ERoriDGsyeQSUOKfLsNkJE6DmI/5CRX5+yBvLXgNseWcQXomogoLN9g0NnWXSmP84qxbzujge9oufYXDpujO7yF4307lR1QEQa8xM92xsAOrFBQcEYsNypFj9qmQVUAWlKHsWzk/5EmYcZ0IvFtR/d1v1cC2ytBXzKxYG5gz+0kUdtUE18rv5s3VdggzgKex7RQiS8NyogZOmL26RWQ7ctlZrGrs3MVZ6btnEBNxFjnlX6mB6Cj/cTiERVcweh+Hmw8SEnl10qhyECYFKKYhsenyrR4rL5GWbtj6JJDFxc83tauqTh1CUaviR2KR7tIGEir5+04ycZnI0rtVjZgi/8lfLiKRDhUUouNZThcnt8FlnCgAdrH5ZBrG4+YvABLQhwHoCO0rsEnEVWNwRpxEkq8f8jYelmREnupdl1CAWIGraGzLA5qc8EyzTYFj1pipM0GyKTtmU25JxW2AD1hu27V/T4jb8XZSI/0qjTCLKCup4DBEd1bIuBMnvfJTPPFQEI/8e3nG4/lcFc4DSbqJbAGOh2nVqLi5wrMPmeT1y9ezbcT18RtYGFljC65Dl3Uap9aBd7EffHqORgW+3Xi3yZJjddcFexHhALOwp+4kDDEo8P25oAtR+VXiofzF3eue4IT3m8OlIEzCMnmTgos4O7fnD+PBL5IacO44Uw7vON8/j7p2KGn1FJ7BfoYMxUmFJhxTAKyHFEHgk5F+Hc3xIpUBzaRjIeT8VX8VP5VEXBFgy/BjuF4n5qpJk6+CcUseyZK0B+q4L9/KwBiBzwKp6OEZkVEIphvXLnk2rrHSs2sBgTOcM5MYlB0WEFKLsGxXUOcN7jnD2TUuyYkZOdc4EY7nHXwk57qkfGPvhSc9Clf3fRrgHk1Cho8PEncIyYTo6dwyPMfqzYUvLrE7FHMyKl3Q3ZuUXP8m8AY+kLqAld+DnMW+iaW2SFZgFE5GEngckOE5DQGu65//1l+cuI/X8O63jvN+NyB1IyElf/39xcP4PKdbLzyotGKazvKd2FRwcgRGFbxD3IS3ow8pmjWB/BsorMaYstC0AD+F2Lzo54XbQFB5xq9m0wZJKYZEuRnNTHC1zMfdF/z5H1oifnj2wvdJju9m051hKmD3qbRU8DVbz7hx68Eiyg5OYOZ3LkR2eemiB9HTLVKpG7c1eGAxWPZTvsnzLPG2qfUO0pIflZzx7pD5SG5p9ltZP/SpGmaF6uXpAUfvAz62/MVEd35EVEJCkygKMxiJ4X6H654vpDraHOvnmrHW+t2NW5yqS1c+gQ6lx2YvsPV4mcY3vYfx5QCt+UqE2XRm/VG3BUJxQV/SE6ZO/VZfO7wS2ajxpBKEdSjjMKaUmAgEYntZyNN0TROvrC5JU8R3X5ZZJH2f8c8KGGzUhQXLiG+IuybPlWbJpHvWGUeSCZH6GCv1xSXz9MQhM++dCge/IrBKNJD0IMDaC12twfiSNPkQxku+D/ew//j7XZCJlYB6igs2skFhM0xgdu3eyTjzVmbZjjGPcFpvmRrcbE8/8Wi79DlSFey+zwC/M/FlEpplgrGD84Rc8bHekjbp5e7FvPiNKieNdoA1HwNGLu4utKzqMvozomVxZpmk8HJZ0Be/loxOLiKvMLjDH8RHch6U9Z1IqnG0oF4ljeeOkge6cZdQtZM0P7/MoaW3GVcutOOYbtmLiGjp6sW2nfBusjMfRV7CLhzmkUpPXhaMN8Nws16rqISLh4Fw8fcLTgQlASPwb7oGsOXwXPGK6yW8hOd30cK4f8BI4oRj+5kwYAQJjeUWb6bFT1mo+Egsh6AMQlMJAkyEwZ8bAQEsiQs4H0NYIV4DVuErEnGNbzgcj3nPc/fg7lfDZX5mGL/hLL+RpPW0xviaXh7qjRfj22DsEtiLAHFqnY1nZJrzzFAN/8yzJ5g4/Krt3MfZiez5uXQGOSeaOwqQzXnKmS8ilur3SJBIrvxsdTl2NZR7aKQiwHQloOApBChIhDMMiLZHgeeF6+mv0Ds7JZNGpUdtEobw6EN2ma+HHsg93OMzzSxc25RzO7FYzBjO/dqe2eMqkQfBLi5zWMG++XbxztX23DePt2NfO9Qu377Wpjl/c+4QZ7w7kAuRA4GEIXa5h1Z8E5eODfHPM7DYgzzUGVa8pHhVxsQhseCGlwz/pLCkpz+PXvh3GFV05XeTMk/jGEhk8plKLwsweA2NOrVPPekgzBqPCYusOXceAwgF9d4TrjStKQMPzkx5HE2KeM7nIS3jdhewhvfcRs+E4ZmUhS2ux0srHYXLUCwFdLC9QBfmyFoxVNaaQfxuurjDGDC9fv0a5wlBhGgPaUBAjaPbHDjgpChr3KaZbHtFWVYbW5V5KMUIluDAMtm6BwTcY08SVVL4wW8bOgeSpWcsbmBMSwnCvQmUgemmkTiGUCRQR1fRqiEl5XuKjWYmsZmpssk8wxCWUxWuX5tA6I5IbG5+Rzt55Pm2/MFb7cSuJzDUf4gGhrjpJgZrOWTBbcDREBtwF6AfvISoBJ2GRNkV2dAci6AeDDv+TnEdBwM0YaU48UN+ITL9itiGKkraNtT4D2FMLvU4pOvQKiiUgp2GA0s8INDSvoIwpc+NVBKEEZwXdRdh8JzC+sGoQsk/nj1sPuTjEN9QA5S59TQTUIQklVG0RDUO6SZeZVWhk4AF1/GBf7sPFpmoUbplZJE70biZRUC9myNCXIlavHWj7cT/NieBLTOFnUUs5NF/dyUS4i/sxWY4HNKkq2zm24kxGQWOZE1thDMkcLLnYg0VPNu2ZVGT8KqQadwVbggXUbyflQ1a/xS2J2cn0RjaVEbJPqR1zGSjyNuw5OtQIEujSArmMQszy07JpbXb0Z1UlW8nw5U1zuDxOOZZ5Jxf/9432t05sudYkyW2JU+wODKJTqnHCMp0KNJXOCuyOOavD1R4GX1PWYe6lsNVBYzKXw9jcQAgtCGiYcedeE1PohbP5Xy2EYvILboz+dAVvjGjOIG02kYh1VWFJLxRqrRGGGIlWCoKgAzGcxFiJyD9khTf+zfecYaofCpeB3xILmFMVBTo9LfRJT2LAdQmrfxxehZOSMXsP7CXTV2KT+bYMuD+FkzowWFmpxbatUvn0y0ayYapycCFvRh1tYtNogO3owIsQ3o6Kq/Kk5x4rrBymYyTCgKhSz3LRCYg+nTPIhux2T3kUrt3HcLeEud/n/lVO/fZRxi5opvm4Prjjx9m+XAH8EqkiH9Idzsbxn7xl6+3c2+fZ8wIV2eSMQ+318DtbuK4n+k83faR54+1g4ydb61gNodT2TIsAQdq5vwmLoQB2MEuUdwZcJ9Lkavc8bfohk7DLdxLTIWHqputtCg7xOjQxFjGK8LjTdzxq4ZhyjRIx8T0LnJtx8/5zMW9WjoYpgqrNVgnFM5EeeB7iFE/E84XLkQ0ql1pd5UoofGqkMOdSAUQoAxs3XcJMqw9EQ1jSrlQWlsSqfBaYepbR0bCMqN205kC6h3Y6dnBuGyDSvY3eRfVL+yNb0N7W41tlXB3YOJwg1bMYgt6mMg5GaMKfVA4wNjzGrVq/Gt4MsBVoXus3Cen3F/DeBJCil0kcXmPMd/Mrvb6Tz5qb2LIYImdihuchXmXrRRWwhtk/5/8599ntQbTiDux0ItQ/SLGVl/7yRvt4NwB1r05VZQKW3aJlbHzNWSZTvRm9s+15w69gMYpiwY7WEal5mbZYOaqyThZShzjruNfP8s4KvR4oAeeU2IR7f/A5RL3gXCjVxu2gbsjmyj28K6vEIVMk38RbLrzARzH1OLG7ibDVsJ3TbFKoScemALVQDTD54EoO9sLkeRSENTgvgARmvpUD/SyZF0ESeh8E2mG6UlsFZ6C4j/kCsFX0arwVgO8nIpRXSz7ZlBwWGIbr1rgm1gfzf524kt8rrQgYWGd2RPBdkPEnAoGJIVv8zEg41THRT7yXt2OAJgvd2+5mHcnaSeSy6TvTBpE0q3fYxVqdnJX+9mfv93efY3zdRbpYpcYXzJOnGWpdGp6ox3Ytb0d2M6WWg64X1/abK/+Px+3z8+ztxzz02xRAh6Vm9GG4mBSj8nemGD/Dn+nz3zenrt9si1gMlFwNigPzJmRhbPfVKtAUi7gf4A48yEXQlosLrlvfciTn4YA9U4gu1aTq/C9/sSDLoipezhlPIPHPHXU+dJxaCYhUB8kw3hw1/lcziEmmYbVlQ/fwimByCoIRBbER98lTh+4xy8Qm6uVXOkkXC54D3ENXAiswhjWbrIakYgy/vAtGQz5FUZG6QRJlMetE+pYqtwwy+RGPcp7zGS1k+mWZDXbVTy1e1brSG2kR44eZTsFp2FsGwxJAVHGrMBC7BCl2XUuAfQ4YNJTqv2SK/gnJtjSsIGa3ba59u4vP20f/QL75bdQ2eVEMufiKgSvraBfycz7+RPPsKd9hW4d8y8oMhw9dLydfPlo+1/+6b9r125dbPsZAkyz3HgPBWg6AlazEB0xbJl7FJOBhzjElI1lHp0XOSXjE/lln5B1GSyeX3aF2iB1nIt+OaB1UWX1brThNXXV6+jL8bZ8elYjHzy2mE4l6Nh9y1U+VnuPm67c8ZEuQb0AScrWOWQHlJgC238Vhwj+D/G8Peh6AfUfn70b0XiVPM+m3wnBwOblHVdpqLcJEUGdISi65O10c/NYyl3gt4hN8GUOFdg9u7G+ObAAACAASURBVBPzhXcSxyORGxOPOyz7rbDW7NEsk3PuDKVLlNukgZCrhG0rGVyHqV7xF5Ag0zAF1STcbVORD4oXOyZ2t7MfnWsfvflJZI3C89xTz3G4wPZ2+MAB8mV4gfH8PbtZ24cjLi1xJOBV7CpxOu7np85zbuUBDirgfB7sgB46jM1Kegk1jNTPXKOBff+738p+eEoIKQpDwWpbtvru0TPQtOMfXI2VBc+ArP/wKELz/OBlFGb4HqE3gUqcZn3AnSvrB6PWO9/G8dgD6Ze0yVbqGqGyB+CedAdmXBzTQoYoxgCHMkOcevELgFQitFoe/RpOpx/OyqVAifIAElKWDNKHBEWjj4Tu3U9efY/31r1CecUN+VlQ9TEfefRQOzy/H2EMbJRuzsMCLn9xDoUG5JckFGOmWqBw7MmSn1te2fo1dIEQJjPi7I0ZprUO3nNWDTJEvwVuax5gnUAF6eDBD+7tnmGsO8H221ucefnaq6+1M29/hm3yV9qPfviD9tc//qv201d/xuayI+33/4vfazevX+DI5S+QFMBdmXWvrM8whrzZLnDcyRQD4GkUmz3C8NLly+3Z575GHivtGrP0HYxFOaUHMRSGHhDBho2QZ065AA4VrYOXIMgGJrh1j9cDFz6n/EMF5OtQXeDenkwvnoa7CQ61kTp2gtmJr+6mGBBAC2GJKAz5lk9JaHgHd7wmvZ5pYocEoS+790x+Bl9uHY4tn3pKfD4WURLOgCldD5mcEr+3uP6l3xOFS0eaafQJlEC6rVS9PBMeT8N43ekvx7V7djlL4/xPPHG8zW/MtDvXbjLu4sAqxpqLrJjcY2LkgUordKkHd+2jQlUfQ6tIfw18A0gm5+Tt+NIKEbbsfxEenquDoRLIsCawQgOchhUWwqgdv3v73vazn77azn10uv3OP/pB+0//s99r/+s//9/a+29/wHmOcmzCY2d9ZQUjs7P7ksYOJjqvvfa32EC/Rlls7XBHBP/+1tEjPX/+SjvEsSYzHM98a/lym3BHJ2wke+VZ5XIv+gTcmsRJXlGVrq5fvve6HcfmVvgH8W0JdWJFZ6rhR9y3uLW+w0/EjdxYaAi4WGPPd0iPIN1nFI2H+zmmPBPWEmAeFhq/DuB4Ij3lXijvRk8SPI+7ClMA+8kW1V1i4amCcHRBIa7xNHu43IdokZXBqWJw6gqKGxDgpjqMjL9u3LzOZGSTLnM3hAqn5NQvlznnUIqYYuymYdJMboBhxClJXCKEfiD8EnlsEheK5FdId6wIlMDJZIYdZa7xzmzfwwRkpt28tNw++DuIkHPDd8/tav/in/5hu8rZ6scOP8rYE8KBi7/19nscOMDmMggMBLSf/uxNTvfFthBHx3j8y04US7RW55ElyjBv3rrGzH0XVcOqEDLOGUwUbmBHcxatqhWkDRnrKaAGvqiTBfMu893fsMfx56Rw3HVJiX69yx7R9njA+5573fX7fR8f8tLDee+/hwTDSw47UhQOXfZwxCvyGu5WlN1WT3sI1wknrz0OifoHlgpZfOwc0T4hhO/YcIg0nqTcSQQHOWPIC7Gb3sgJOGIflgXYFpPdkLcvXcEmz97MxNc4jsR9JR72xA26YtbOBOMiMsBryP4OTB9kb82eEH5XVghEEKN/tU4/wIhFi3tMt/s6+BSEiPJcW7rBxGVmNwdRrbf3OULkIiZYrly43VZvrWcN/id/+tdpZI8cOQxHY0sVKzNuNItxAxrT2bOedstZPIx1dy3sQSGYg0Thliefe6bdvu3pYtQIp0rcuL2KQsfNdujYkXabM8nPnb3Unj7yBEocbLNAGuFkT50Bl1ZLWF0cvwhMPDlBHMedSCzsj9A5PHSiHKruwc/Du3FNz58ETqN4kDDw0dX6N+EzkBxgyHN9T7z76tXqvx826ZLkiSwReuExVXN/uJ7ir72ncGR2H9EaWs7UYw3P8THLIG701RIR0jQqwpfSwrtEQaZAIHBz4sRTbQaOf+TAPgTRVBpbeT3d6zaTH62hrXIE8oUbl9s059w89eKTjM+sSPijhJtsiiidTMk1RZB/29xnS1eppgwnAmG/ckf77J0z7f1ffhLN8tsczuQOv2VEQioX7piY5+CmybZrx0Lbw2qUy6C3Of/G46yPfuPr7RbKJG+99R7bitl/RMZuqJN4xNux46zrMyGan5vheD25amMyBCe9zhqSWu6Iot5+/YP2xLeezJDHZc8iDLEFtNWyR/BbrC/RpDEeqPxOkGJiC9fjBEfq98UBYLvnv9dZgf4Izz/Q8DZU6uiu/5br+Xe4IUyW7BijJNpAEYpLwrjyTuu0gTzoiBBuiv848D73TDpRBijCl/ayD0NihO3ICbHoPeQ1SmMIWjdSohJEMHNhukFWezhm7t1ffsgK3zpGEJbabo78S5kow21OblhETKSJwt0H5tt2zsBZ2cZqS4Yu1e2luwbZltn9zbMI41WgYH7E0XYsJTL+u3z2Bis4Z9v7EMfKTXYlIje9t74NM34QDZyAnjqW4jzDUgsai3A47Sipbb6TpdJ33n2vfcEJYspctQriUMP6ckXHVaM5OTwFVwSmIa21DayLoJTilonbHK0ns3nx6y8G30oktAKchmT9SDgGCE7F/RbC/DTuOq71ezh+rVO/VkTrUlyPek2zSqJ+ty5gFPwU/YTo/cb/qJ6dkI7BMwzUkzqQmtF9rmAq/9rzoyo3ufSgkeOV16gAvcAPK5B+cpkgyawAMEes8DgiSp9NJP+VU0+r34369zm1px3f6Rao0A3MqOyiq/SMHlbp2menTtH1rSK7nEeYfahd5ZgUOfHxZ4+hwa5SBZQfRAqIWBSXtGg45BQTiobBLkZ0iJ/2cOjVYnv/jY/aqQ/OcE73zczSp+Fe2tWUB2g4VaXkGQhSky/ryCdX2S7sPm+5qBz7Ft3zCmIfe4cJNpp5nPQUY2LP2pFjzmN54xJngB87uhNrbftKIYNxyv5D+1mWPND+6i/eKGUVyuteelYRMlyZclEeJ+xeC7Het1yvsy2fepK41DKTCB/EfbdlNIoDkCwgVhYjzwc5lcRLOIZErFXgOi2RQXeD1CNw6ucnYAjd9DBj9yhxaKGxkhgSouKq5Qy+4SjDN9OkxPkZi/8iyiHLMWx0oqxgQ1pD/A5DR0zCSjNC+xUu+UpcNCbp6tijj7SlLzjACvnlEpODRw7vZ7vB7Xbl3M32+Q2E7+gqPnbisXbwOEcgw+EgJzIRbiIHdgcwTmvUrqb3oDu+y1Dg7Y/ehSDPtcsXr4Y7sqYTobYTLHhrLYciFfD4lUW663XFUXA6J02arpE7ua/bepJTyiU9ZlrdSkVaTsBy1iR+63Lla2tt7z7lomzpZTb+8ivPI1Lax4pWa2+/+z5bR1D8SGpydx6DJh/86X6TLrZC1tUEetxx/y8/F5csf/E//r4VOjWYJH0a3vhMHuB7a8Jbed7Fz7r2bSs93uqzI+3SvklC3d87lZ8wXujmREa9c5UjDhDV3Yz14A2K1m+UXgJUKFMcdSd6iZvgp+L4LM18lUuXS3P3/Mh7yCed6W6wlufWiSx7QhQ70Cg6cmR/u/CrW+3GjdvtlRPfCSdyRi6XsqsJkENGGgKYQ454mTO4P3n9FAZVOVz19NUYV53noCYF3S53ioPtcMadbGugA2c9e7HdIv0Y62ICIxxKuy2Sz3JIpmgQG0RD3FXS0QUGyNsJ0XZWdpaQr97EsvDPOWf86LGF9oPnXiYPtKYwD/OP//E/5Mjsi3BYZnsOHRCrqSm1TZany82JD6tc9VL+XEe4HvlsPTw4Q+9ftoik+5CF+BpcZyT9ffyeb5RTW/t9NSoFxy8pjFWujI9SmPh4EqPncEzFJGmFehPWVBg18AA38Z37/WU2Y/0JJ+X3F1ZiTGfEQROXsHj6N5C6se5Pj7Q6eMoU/awzTp79yC/Cb9LSAOs0dbzD3gxjBpjWajO74E53UJZCpnmbsSa9LVQ0idhlsd1WvCKcjnngaO4RSpJKzKGSOTawLV1Zaec/vNyunbqpXLvN3+PcRSYecjaP0YPy2fbL7kzkoK5dL7PhbYluOQiCaN2eagU6ThXZjhc18O9RzHLGVZZIFYclDLBobnvXvr2soU+1FSZEq6wMTaH9dPosE7Udj7GbkykX8sob189l/882FFR2T6H4HMNNCv8xG0O/OcnwREsdkSj0eqDoIs4GECdOcWIgd3BYxNYDxDuXBydIFX4sHPhQIlAu3IhU656wqbCh3vJcIQNBgTFUdmojuOzefug0kjGmJp5H0XkMcVGYmvRAHkWdQ4JDSKOE4LyBhMBGmwXmkGHeeTIxnEWp4vS84n3fJYRIPPGbCuTBjjaETjSJNub1iLUdDjc/MdfO37iUI40lkpu3l1ACl+jKiIPKtDvgeHP7UZqAthSeWzmOmlQudmaukde2PNE+ZLZ9+q3PIWzMtmAB2i2+bkm0C+17olFbYlbtHnZNZdPTQJAa8CJB4CVNCG8Coi/jsHC2jCMdE1pyChYCYQbPmHg/UgRXf26i0KxWlMrLy5ThyadPtF+8/mm7fOFs+/a3v9b27eHAUfrzfewfX0DD/e6qZq2x0w5hbqhAwp9aOeIueApGUzmF2+T5IM77e79X0Lr+fUMCy3J/vNSbkW3oQtLpRb/BgZ77XHotIM4g8r7k6oVawUk8A5H12Ekbygx99W69fxy7d/ZdsjTSgTIrucSskHikJVimr3C9yKMy4CF36ojIAgndmXqNG9cn2mtvvdvWIZRLF26w3XVXlB9usDSoftsaVOchVd/8/ott4SDr6BN3mPiQYBJx3Mf4cxJDVOuz7Zc/eYtVmwtsoERrwvEAShIaPXXS4nhQI1220nBPVegg2LVFLGPwTe1uf3IacZFdjyThmFK/VYguW5tpCBK4B2HtP7Af4pxv165zKi6GDMSOOpWx50lD+fjjT9qRw3vbJ5+cao8f39U+eO+z9g9/+yTKKgj1aawqF6erBCxpPmf4hFuScZx3fiI0RNT983Hw68/336sLvt9v/K1S6ukN9xCkoXyveu8hxuPe99zpbRTQBwAe3rPDwrFIBusGTqvnqwg3Je5Sd3VBW3cJcPQTO3JY47rWyX2EEJ5HLarnaroPceIxyfpNAIFHgXo4Ac86TVNfuXC5/eE/+zftT/74Z3SRs+2ZE9+A22xrV+i2t8GFJrfvjMLGHJvOnv/G15D8YLSVZchNTayZDvDaJc+ihPEB6mnnPoYo70KUTHwUfGsZY4kZtvComQQ1JW8535pr8HBClyQ1Oe1sewOuKdHJPWOqhu/aRbcMEqXcwuaVg1VR0NiHQYOVlSW07escS6YzIbBJ0ruFFGGK+wfvf0QDYBLGsuZ2xsz3GFbcuHQ9dQGvVgWUdOH9JOyIf2vUD+7lkuGUvR68j/kP363hB/+sq6/6uy8du0l+EnMtRKTIEXWWn/7DDwiswdFPuuDnVmyHPdJN6KeorvaVK7Mr7mu0Kqh3G8JWB2E1jbkENYAPRbDZKRh/ww0PIjAhUiQ/PNSZTMJZi0nTYJVnXSuaR4qsANidWyvt93/3v2z/3X/zT5go7Gh/+dd/0t597432ztvvIua5gWwQobgyQeSYkoVJ2kRM0mVFSKqdeut0+/TtM21+206ITc0jbMVp7JWVlVXMZGv5YhUjAnLNGOySIJl0SHQRqUEYMfMycMOSUdZY0/zs0kruyDk+NBi3G++BW64xs19C+C4srmJNo595Z+kW+5V2t5e/+1vt7V/+gp2SC+3oI0fbu5fPkAaW6Zi925imKL+LBoWTYgbVC+jjj4zv+/E6VLb+HbUPnxjJ9SVi69N4PT2fuxsITYKRwC0jvcNWnkO4xO9x/Gq6ut6ESCfwCG93NSTxjcEY1Tbk34HuwbzLKe2iCuD6knBDYKOmEABZA+oK87DriOM/7CN+gujMMmPMHsa881wEuwoSdh880P7bf/IH7fe+8/ttfs/e9vGpD6C2qXbiuefYxLWDLnGt/fTvftm++ORX7dhzx9oRVMom4GjmoKxybnKuXTt7tX3yxum2ZwfLizfrWGPFPO7xFnX+lEdGKA4H85sa89p2Fxd22RJ9xp8gYUBH3iXkKk1VsERp160JGDXvr17ljEyYsLYwNV1jGso2n3/xJF37IupwV9lWMdX+8s//HPEXiicgQCmJ1kbWJjDkSpx7kT0PIzFxL5ZSEWKrfn18X9wzSEwQ/a1z073fwYnJx0DKFlL39wfgjfogYmrFujFv40h40oohRnX2pcjxIGVCDz0p8cWdoId+Bpg6GT88hcHXiAFGgIKlITbfk5iFBLhaG5dA/WCY+3+GHf8pRslPf7uldHhDpg+5JV32ld+6s9JOnHy+PcP6ssq1p89+zH5xdkLS5e3E7OAcZvm++/JL2C/aaP/+X/1ZW7zOqRXrjCeZsU/Z/dzZbB/+7BTUONVuX0WhjEnHulsW+MuJvXJUZsQx3gWMnpk+vxNzhowHY0zV8SBGVO3C1Q+1wBLXCmfqWB65oF184KWrcvVnP6arFcQvEa+6LogAwsxZPgTULPfzJ19oH777DmNIZKW0zgvnLrAmz8IB36bh/o6ZXbgoI1RWnXxILsMvY2f9yj+4tw6GMbX+dpW1pFt3G9iXfhKKYfmzm03aPOuXX5ZqSVcmOdTzEJryUG5+xnMB4P4fjdAGbYp886/imYN5wTSgoczGh1JwG/L4NXdbl+Or/rMr689QIy0YZEiDOFuLRNrfy7euwZO4euBnWP0sa35El7v6i39/xn9lFfvkRx9rL3z9+Xb5xjmWIa/DiVAWXphpTz75eJRplW/uYQvF9175dlu7vdF++uPXOeGWmTQC9Bk4zU9//FpbucwKDPqQzqJXN5EPMcOdQFNc7aQlDk9VScNy+JNL3rhxI0Qn4TmWtIHtUEkZTqgqmg1r3GUyRFzNcKe7hiNOIZfUxOAaE6sNllBJkHQ2mXXfiTbUL3/2U7SSLtA1ohDiKg8IcC62zHj0OrslF4mjgX+5We2p4WOQRx2A9yIy7xKX33TeQRzOpcMcTTO6O6Hb+knEnQBDPBCQxNwVWXK3fm0IkhPfa6VIMRz50OhdlQv58d7Hl0pTHD7582AtCdZQnXBHhEr+pqyrviCPv/4iJ0nrGIKk0HJP0wCx4DfIiFIGfn4PtxiLdH+1VUIisLv+PJKJ9g+jO90E4ZXZPfPY19rKnbvt1pVb7cqVC7TSzdw//xTFCmbS0wi5r1651B7Zv7+98LUT7fyZi23xws32CEZSf/IXP2m3LkGIi+4J1wbQbiY+mpK+2y5gXsa18h1oUdxZJC27WLifihfj40f9JFDLaLct8Vq++kE0xFOHc5IuXGysY3DhDgdJTcExVyEyIwZ1xDAdK3gFbnz+i7N0sayvs+NzAUWQH/7wZRrJxXblGlt6yWMaobuiKOWwxEpjsG7Uq6ju1GZNyhJJcuAWV4TZt0V0XI+hn1ASHK4qLrhO1OE9z1yMK/kmvBEGjjw6EsfvqexcerS623iNituCoTz6e/9enNPhF04uEKIbIhso76QX4hzegwz9et6WkP9wCR7ynfcRFP0pmOiRhq/46WNFOkqoPElhhCBnxITwOwg/OLWvndh9gu54pj117ET7cHmzfXHhQ2bIrZ27dI5tspzAjQnCJcz5LU0utW+ffIZtrifaLBzwnf/7l23lC5LbYL8NgvY1LPSuY99ome7S2bQcZ1mrvYh4phE5uYdIsY8cU8KU81gEzWy7V30VoowWEt1XiDEw03iA1YDOnrVv6URjEVKagxNustbtSXTuqtyAI0pKzGcQpF9VxiS5Uc67kW9Oo0RyZ/Feu41IjPFA22D9foJufpNxsjpPM3J6hOyhQ/EOgYvATjriUO6ln/jdpMHKgXUhBNAaaYzvw0+C1w3or7R6JN4YSDBeZ/IXojS/ytEqCnclTP5IoNKouhRveSec9BH5q3F5F1feAJKyFYC/Ecc0zm/iRlT/mwR+IMxW3ALMgugsrAVy7KLyxGNPsrf6yIF29cz1dvXWJZbnVtqNO5fpGm8wo32O02xRNUNx4gqC67Nnz7V9h/aiJHGnnT51CxU0jAxg53uTylWmqem/Gzdvpms2f/Uv5YY5pmW5Zs0SqxW8ZtcL+nrX7hJoEE3duOnNMMExnM1zH62uaqjO4OX0COvhitvpyiXKNDz94SIbNArzlXiceRvXic7Fi8BJZS0zdJiA+25jEnaXMWoqcCA5YTI37/qLL1pxXmOQN+wLhsPnMBnCBdd5JxiwDKgO/Hax4y5pEzazeAKme6YBhKDsNWlckn+lbUwCEZ4Y5FO9SnALbIUj4OW5Z5qgQaRxttx/MMJMYUm3CKoXdSujr3pK6IpIoSx9FdM0RymBcLXLr6H0e+rC+/CL6fb552fharfb3O7N9qMf/ag9uo8JBnzq01Pn2idn3m/nb50m7KeM2+jqL6AmN4+d8rtwSQ6jcmzkpEcnh/Pn2HE73e0ExOIkyHFjCAgoMkwZoHEdPLikDsVxEC6x8Se30vkcY/sDYcvtnRxpykWNJDfRxVgWRL2WZUy4EZxYp0xP0zFzrKOfOnUmoqJFlFRcoFOLyeXWHB8tt4QI5YQSkCojgZe8grlhAhbaFL/AIvPLt9yF3XiDn19C2EJRTg7e69Z6kWPaV2eyxaPWT3qZLbW/LB3bbfsWRIkNnbtWeYaqyR4/fPNfXxNoePwPRphma9lTRB4KIN9/A0f4RA0b95m/EYL8AsIZbniS1+0bV9mFeA7OwgFSqxfaqdMftceeYBcik6B1xp/THIs8t29X27t2vP2Df/R77Z//s3/HqRaLbOndzyz6bjhkjsZjInKTCY2HCETeCAK1b2RN9cmNZdFldu64kW/+qqKogBAuVCL8BLWb3kBG6bMNzArQnKDC9J1MxuSF6864EUMx1WbmD4Gyg3KKYUJvJLfYJemSI6TH+HIFm5k0IkjHVSGF+kCR/BzahZuRR+6pYfBEmHA38vceQ/2ZD0iUTi3qz6LJ9YQ13XngLbjx9YEfznC551rPxkv7q3IPIRJcDi/BCZ+NtjIBRvGXNPMVrgmZgkvzkSl0JmRs3UMJ06iybF0llsevvBQhGqcyGwc2EfmUFMVEdzz3t6ps31LihOgtdUSkFGQnXd3+nZPtcTS81y6stBeeZqsrKzqfvvd+Wz6yu+3acxgB+ePt6PGX0Tza2/6r//pE+/f/xx+391i+vIs2ULpq6GJpsfQks9cIkPVXupDTbeWeds8I0x17igO7cJ0wyUljCHYoS0e6Gu05upmwipW0Qa4T/45jLd06XNp1eidWsOe2b99CZuuTk3LyImrHtLNwxuvXWemRnElglQmUXH6dxiUohWXTr4rOAEDPvItrciOeduaF3LjOef1ix5vOV4I1Cm6EdSjuoXWetAlIBJKK26qz+tiZUWCzGxdOOIoEqkU7hyqOiQstBbe46flJrL7rpsABb1Ds8NdnxVsgJ9zffyFFE64u78vBgwAJsWNiLEgnQL0clxSaBgh9A7nhVHjZ2e1iZWbl5oU2P8W4j7Hf2x980vajh3n50iXEM5fankewlsZ6+tT0U+1vf/bHbe/hx5kRf8TqyjW0KjEggNWLCU64yHiJWpYj2s0q97yFMS7lhuneB5Q5VpT4Mvvm2ZUYEoBwGcKLSX6RD6IdlOLh5X4bCXUbxOawYE35Jfdo4DNpWlUtjsDXr12ja9YoF5OljC/ZDuKkjGMJl+i+5R0eaBCCDv4kIckKF+4kt3H2WkQHyENNEoqySYyl4iYxImckDX1TDwlrQjgSlINKRJFZm1flks9FRnmsd8pG8IFI7SEhPPGkv8QnQRLABohvnkFi4piAYY3vB++GTR0Pecoo6IKG9iJwY8AY7zd2FtjCmMaoG34gdrC55Xc/QSbzfCziHMLhnTEJCd+DW+xiwvLooUMsJf4clbarnLV4um1DW33XoSNogO+KmtunHKN8+vSH7d13zrWnnjnZPv34VJSIV9DMWcOsyxQ2KjVoRYpwIFomhCKXUudSopRLOtlyudHVH9e7JRqJo5BJGcUkDWaGylcB2Fm7qziubwfZfHfVaM2zwZV7UuuRPEgsiVNEHH1S4ki02vrMEc/ksobYy0mVcEgtKxx9XWRmI4XooMWg012fEho/ka+fV8MqMxTHRaCEYaJSf8QfworlpDPcw6IkTseOnTXybSAjygG9SEQMKrzWfxFlH5NLlGgmACc/iTEUb7zyIyLRClKJsbtMFof3dOXAGFeFM1Jl2CP8JvctIuvF/HIskfEwtxXX8Rt5JxiX/ItKZptwFK3m7sGw/zJil9uYXLnAeHOKFZG7bG997wyGBK5daXtZ9lMJYs/eiXbtxiftzX/7Wnvh5HdZrvx+e/eNnzM+ZTUFhcspVpA0s+J40gOdQizkIYH4qy6cvJXlQDha8BAtwqQyhmHmWWXyXWG5RrDkulKNHKdm6nJ/x1JUd1AqFzEROQlES94mIL6tlBUUlF3jvwsHXcFynWlbubKNNQjT/UVOokwio0XykXjMD9I22YQtQbgcUw4NsYdREDf4r7tYtcxkUeXils8FMun4JV+HAMNzgZ9vKYvtMI2uymAjUjXR7RgSpcmlC08Zt8ovpElqwAfBUlYbmQ7CRAZHhQdxuRA8EIJgm0f9J3AHMy9e/BZPw/rui2jmvUfEH7wlLNdyyaIqxHhJwi/CxEtuSRAwQWoVjsJCIAdQrl1hZn77znXEQkvt6iJLgazYbIcgV9la8dlrn7U/+dc/b8+eeKI99+yxdomVlL/9iz9tL730w3bi2Rfbe+9gLvraZRRx0QaXe0FgNoxMeIA7XFGY+VaTmyI0OZBhPBtce+9yTIlLjivxuJzmGNU4wml3xme+WQYI1TGl+AHX4mjXvt0I9M9nD/mkmu4D11SlzYmQEzVhsN7EjydZeMeLiq4GpA1J80GOFO4oUXS8R6bouJKfXB64/gAAAbdJREFUo8sixOrui1uaEAnmInVVRjn7aPDWq3K3BsxXD+tW33wkGsMZYEfcQD3hx/8mK2/uh7fiqosvuW0+JowpmCaUUknqm8+9twxhGiy5JTBFILR/+hUQtK4hohTom0CE00F1apcUgVEpvoMsMzId4xvXpa9NiCyNF4KXMyYOAQXetLa5XZb4ioVilYNC+yxaN9kOq/rXI1To4pkPWPfGFiYMZ3GVbygCrzAuW7y51s6+eYGTxna1t39+ur3+03fbK7/1DCdX3Gnvv/U3WOI9zh70J9vn2K+8c+UL1q6xYeQ4MZyrJiade7vlQdmlXNUuqLZuaEkDcRKcSBOBK4wBXaWxkB7SKWZthJ4BKSrt/nP6r+XlQ5ffrbMk+Z3ffrk9+uSj7V/+D/8SO/FQMOX3fKK77Kx0q4cEpZMQN3hfjxwVTul4m7RkGpPgBB5EthrIISDKwzJ4CVQuaTsgJN9ceh1qDbj0yZjUZx43MXVjObVRXRxdz6o58SHxyAO9WjDrRrGR/NCVKCUIkesy1pXzm0bZmycGz+miJV7TElnEr7RMzrDc+SZ37+XG5z+6/4iB//9h4P8F/vX0X8jbJFwAAAAASUVORK5CYII=',  # noqa
            'metadata': json.dumps({
                'filename': 'A beautiful bird / an eagle.png'
            }),
        }
        asset_file_uid = self.verify_asset_file(
            self.create_asset_file(payload=payload),
            payload=payload,
            form_media=True,
        )
        asset_file = AssetFile.objects.get(uid=asset_file_uid)
        dirname, filename = os.path.split(asset_file.content.name)
        expected_filename_start = 'A_beautiful_bird__an_eagle'
        assert filename.startswith(expected_filename_start)


class AssetDeploymentTest(BaseAssetDetailTestCase):

    def test_asset_deployment(self):
        deployment_url = reverse(self._get_endpoint('asset-deployment'),
                                 kwargs={'uid': self.asset_uid})

        response1 = self.client.post(deployment_url, {
            'backend': 'mock',
            'active': True,
        })

        self.assertEqual(response1.data['asset']['deployment__active'], True)
        self.assertEqual(response1.data['asset']['has_deployment'], True)

        response2 = self.client.get(self.asset_url, format='json')

        self.assertEqual(response2.data['deployment__active'], True)
        self.assertEqual(response2.data['has_deployment'], True)
        assert (
            response2.data['deployment_status']
            == AssetDeploymentStatus.DEPLOYED.value
        )

    def test_asset_redeployment(self):
        self.test_asset_deployment()

        # Update asset to redeploy it
        data = {
            'name': f'{self.asset.name} v2'
        }
        asset_response = self.client.patch(self.asset_url,
                                           data=data,
                                           format='json')
        self.assertEqual(asset_response.status_code,
                         status.HTTP_200_OK)
        self.asset.refresh_from_db()
        version_id = asset_response.data['version_id']

        deployment_url = reverse(self._get_endpoint('asset-deployment'),
                                 kwargs={'uid': self.asset_uid})

        # We cannot `POST` to redeploy...
        redeploy_response = self.client.post(deployment_url, {
            'backend': 'mock',
            'active': True,
            'version_id': version_id,
        })
        self.assertEqual(redeploy_response.status_code,
                         status.HTTP_405_METHOD_NOT_ALLOWED)

        # ... but we can with `PATCH`
        redeploy_response = self.client.patch(deployment_url, {
            'backend': 'mock',
            'active': True,
            'version_id': version_id,
        })
        self.assertEqual(redeploy_response.status_code,
                         status.HTTP_200_OK)
        # Validate version id
        self.asset.refresh_from_db()
        self.assertEqual(self.asset.deployment.version_id,
                         redeploy_response.data['version_id'])
        self.assertEqual(self.asset.deployment.version_id,
                         version_id)

    def test_asset_deployment_dates(self):
        p = dateutil.parser.parse

        assert self.asset.date_deployed is None
        asset_response = self.client.get(self.asset_url, format='json')
        assert asset_response.data['date_deployed'] is None

        before = timezone.now()
        self.test_asset_deployment()
        after = timezone.now()

        asset_response = self.client.get(self.asset_url, format='json')
        date_first_deployed = asset_response.data['date_deployed']
        assert before <= p(date_first_deployed) <= after
        deployed_version = asset_response.data['deployed_versions']['results'][
            0
        ]
        assert asset_response.data['version_id'] == deployed_version['uid']
        assert(
            asset_response.data['deployed_version_id']
            == deployed_version['uid']
        )

        # Add a form media file to this asset
        crab_png_b64 = (
            'iVBORw0KGgoAAAANSUhEUgAAABIAAAAPAgMAAACU6HeBAAAADFBMVEU7PTqv'
            'OD/m6OX////GxYKhAAAAR0lEQVQI1y2MMQrAMAwD9Ul5yJQ1+Y8zm0Ig9iur'
            'kmo4xAmEUgJpaYE9y0VLBrwVO9ZzUnSODidlthgossXf73pNDltav88X3Ncm'
            'NcRl6K8AAAAASUVORK5CYII='
        )
        asset_file_list_url = reverse(
            self._get_endpoint('asset-file-list'), args=[self.asset.uid]
        )
        asset_file_post_data = {
            'file_type': AssetFile.FORM_MEDIA,
            'description': 'I have pincers',
            'base64Encoded': 'data:image/png;base64,' + crab_png_b64,
            'metadata': json.dumps({'filename': 'crab.png'}),
        }
        asset_file_response = self.client.post(
            asset_file_list_url, asset_file_post_data
        )
        assert asset_file_response.status_code == status.HTTP_201_CREATED

        # Redeploy with the new media file, which is a change that occurs
        # without creating a new `AssetVersion`
        deployment_url = reverse(
            self._get_endpoint('asset-deployment'),
            kwargs={'uid': self.asset_uid},
        )
        before = timezone.now()
        redeploy_response = self.client.patch(
            deployment_url,
            {
                'backend': 'mock',
                'active': True,
                'version_id': deployed_version['uid'],
            },
        )
        after = timezone.now()
        assert redeploy_response.status_code == status.HTTP_200_OK

        asset_response = self.client.get(self.asset_url, format='json')

        assert (
            before <= p(asset_response.data['date_deployed']) <= after
        ), 'Redeployment should update the deployment timestamp'

        assert (
            deployed_version['date_modified']
            == asset_response.data['deployed_versions']['results'][0][
                'date_modified'
            ]
        ), (
            'Redeploying the same version, unmodified, should not change the'
            ' modification date of that version'
        )

    def test_archive_asset(self):
        self.test_asset_deployment()

        deployment_url = reverse(self._get_endpoint('asset-deployment'),
                                 kwargs={'uid': self.asset_uid})

        response1 = self.client.patch(deployment_url, {
            'backend': 'mock',
            'active': False,
        })

        self.assertEqual(response1.data['asset']['deployment__active'], False)
        assert (
            response1.data['asset']['deployment_status']
            == AssetDeploymentStatus.ARCHIVED.value
        )

        response2 = self.client.get(self.asset_url, format='json')
        self.assertEqual(response2.data['deployment__active'], False)
        assert (
            response2.data['deployment_status']
            == AssetDeploymentStatus.ARCHIVED.value
        )

    def test_archive_asset_does_not_modify_date_deployed(self):
        self.test_asset_deployment()
        self.asset.refresh_from_db()
        original_date_deployed = self.asset.date_deployed

        deployment_url = reverse(self._get_endpoint('asset-deployment'),
                                 kwargs={'uid': self.asset_uid})


        # archive
        response = self.client.patch(deployment_url, {
            'backend': 'mock',
            'active': False,
        })
        assert response.status_code == status.HTTP_200_OK
        self.asset.refresh_from_db()
        assert self.asset.date_deployed == original_date_deployed

        # unarchive
        response = self.client.patch(deployment_url, {
            'backend': 'mock',
            'active': True,
        })
        assert response.status_code == status.HTTP_200_OK
        self.asset.refresh_from_db()
        assert self.asset.date_deployed == original_date_deployed
