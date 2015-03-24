from kpi.models import SurveyAsset
from kpi.models import Collection
from kpi.models.object_permission import get_all_objects_for_user
from django.contrib.auth.models import User
from django.test import TestCase
import json
import re

class SurveyAssetsTestCase(TestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.user = User.objects.all()[0]
        self.survey_asset = SurveyAsset.objects.create(content=[
            {'type': 'text', 'label': 'Question 1', 'name': 'q1', 'kuid': 'abc'},
            {'type': 'text', 'label': 'Question 2', 'name': 'q2', 'kuid': 'def'},
        ], owner=self.user)
        self.sa = self.survey_asset

class CreateSurveyAssetVersions(SurveyAssetsTestCase):
    def test_survey_asset_with_versions(self):
        self.survey_asset.content[0]['type'] = 'integer'
        self.assertEqual(self.survey_asset.content[0]['type'], 'integer')
        self.survey_asset.save()
        self.assertEqual(len(self.survey_asset.versions()), 2)

    def test_asset_can_be_owned(self):
        self.assertEqual(self.survey_asset.owner, self.user)

    def test_asset_can_be_tagged(self):
        def _list_tag_names():
            return sorted(list(self.survey_asset.tags.names()))
        self.assertEqual(_list_tag_names(), [])
        self.survey_asset.tags.add('tag1')
        self.assertEqual(_list_tag_names(), ['tag1'])
        # duplicate tags ignored
        self.survey_asset.tags.add('tag1')
        self.assertEqual(_list_tag_names(), ['tag1'])
        self.survey_asset.tags.add('tag2')
        self.assertEqual(_list_tag_names(), ['tag1', 'tag2'])


    def test_asset_can_be_anonymous(self):
        anon_asset = SurveyAsset.objects.create(content=[])
        self.assertEqual(anon_asset.owner, None)

class ReadSurveyAssetsTests(SurveyAssetsTestCase):
    def test_strip_kuids(self):
        sans_kuid = self.sa.to_ss_structure(content_tag='survey', strip_kuids=True)['survey']
        self.assertEqual(len(sans_kuid), 2)
        self.assertTrue('kuid' not in sans_kuid[0].keys())

class UpdateSurveyAssetsTest(SurveyAssetsTestCase):
    def test_add_settings(self):
        self.assertEqual(self.survey_asset.settings, None)
        self.survey_asset.settings = {'style':'grid-theme'}
        # self.assertEqual(self.survey_asset.settings, {'style':'grid-theme'})
        ss_struct = self.survey_asset._to_ss_structure()['settings']
        self.assertEqual(len(ss_struct), 1)
        self.assertEqual(ss_struct[0], {
                'style': 'grid-theme',
            })

class ShareSurveyAssetsTest(SurveyAssetsTestCase):
    def setUp(self):
        super(ShareSurveyAssetsTest, self).setUp()
        self.someuser = User.objects.get(username='someuser')
        self.coll = Collection.objects.create(owner=self.user)
        # Make a copy of self.survey_asset and put it inside self.coll
        self.asset_in_coll = self.survey_asset
        self.asset_in_coll.pk = None
        self.asset_in_coll.collection = self.coll
        self.asset_in_coll.save()

    def grant_and_revoke_standalone(self, user, perm):
        self.assertEqual(user.has_perm(perm, self.survey_asset), False)
        # Grant
        self.survey_asset.assign_perm(user, perm)
        self.assertEqual(user.has_perm(perm, self.survey_asset), True)
        # Revoke
        self.survey_asset.remove_perm(user, perm)
        self.assertEqual(user.has_perm(perm, self.survey_asset), False)

    def test_user_view_permission(self):
        self.grant_and_revoke_standalone(self.someuser, 'view_surveyasset')

    def test_user_change_permission(self):
        self.grant_and_revoke_standalone(self.someuser, 'change_surveyasset')

    def grant_and_revoke_parent(self, user, perm):
        # Collection permissions have different suffixes
        coll_perm = re.sub('_surveyasset$', '_collection', perm)
        self.assertEqual(user.has_perm(perm, self.asset_in_coll), False)
        # Grant
        self.coll.assign_perm(user, coll_perm)
        self.assertEqual(user.has_perm(perm, self.asset_in_coll), True)
        # Revoke
        self.coll.remove_perm(user, coll_perm)
        self.assertEqual(user.has_perm(perm, self.asset_in_coll), False)

    def test_user_inherited_view_permission(self):
        self.grant_and_revoke_parent(self.someuser, 'view_surveyasset')

    def test_user_inherited_change_permission(self):
        self.grant_and_revoke_parent(self.someuser, 'change_surveyasset')

    def assign_collection_asset_perms(self, user, collection_perm, asset_perm,
                                      collection_deny=False, asset_deny=False,
                                      asset_first=False):
        self.assertEqual(user.has_perm(collection_perm, self.coll), False)
        self.assertEqual(user.has_perm(asset_perm, self.asset_in_coll), False)
        if asset_first:
            self.asset_in_coll.assign_perm(user, asset_perm, deny=asset_deny)
            self.coll.assign_perm(user, collection_perm, deny=collection_deny)
        else:
            self.coll.assign_perm(user, collection_perm, deny=collection_deny)
            self.asset_in_coll.assign_perm(user, asset_perm, deny=asset_deny)
        self.assertEqual(user.has_perm(collection_perm, self.coll),
                         not collection_deny)
        self.assertEqual(user.has_perm(asset_perm, self.asset_in_coll),
                         not asset_deny)
 
    def test_user_view_collection_change_asset(self, asset_first=False):
        user = self.someuser
        self.assign_collection_asset_perms(
            user,
            'view_collection',
            'change_surveyasset',
            asset_first=asset_first
        )

    def test_user_change_collection_view_asset(self, asset_first=False):
        user = self.someuser
        self.assign_collection_asset_perms(
            user,
            'change_collection',
            'change_surveyasset',
            asset_deny=True,
            asset_first=asset_first
        )
        # assign_collection_asset_perms verifies the assignments, but make sure
        # that the user can still view the asset
        self.assertEqual(user.has_perm('view_surveyasset', self.asset_in_coll),
                         True)

    def test_user_change_collection_deny_asset(self, asset_first=False):
        user = self.someuser
        self.assign_collection_asset_perms(
            user,
            'change_collection',
            'view_surveyasset',
            asset_deny=True,
            asset_first=asset_first
        )
        # Verify that denying view_asset denies change_asset as well
        self.assertEqual(user.has_perm('change_surveyasset',
                                       self.asset_in_coll),
                         False)

    ''' Try the previous tests again, but this time assign permissions to the
    asset before assigning permissions to the collection. '''
    def test_user_change_asset_view_collection(self):
        self.test_user_view_collection_change_asset(asset_first=True)
    def test_user_view_asset_change_collection(self):
        self.test_user_change_collection_view_asset(asset_first=True)
    def test_user_deny_asset_change_collection(self):
        self.test_user_change_collection_deny_asset(asset_first=True)

    def test_query_all_assets_user_can_access(self):
        # The owner should have access to all owned assets
        self.assertEqual(
            get_all_objects_for_user(self.user, SurveyAsset).count(),
            2
        )
        # The other user should have nothing yet
        self.assertEqual(
            get_all_objects_for_user(self.someuser, SurveyAsset).count(),
            0
        )
        # Grant access and verify the result
        self.survey_asset.assign_perm(self.someuser, 'view_surveyasset')
        self.assertEqual(
            # Without coercion, django.db.models.query.ValuesListQuerySet isn't
            # a real list and will fail the comparison.
            list(
                get_all_objects_for_user(
                    self.someuser,
                    SurveyAsset
                ).values_list('pk', flat=True)
            ),
            [self.survey_asset.pk]
        )

    def test_owner_can_edit_permissions(self):
        self.assertTrue(self.survey_asset.owner.has_perm(
            'share_surveyasset',
            self.survey_asset
        ))

    def test_share_surveyasset_permission_is_not_inherited(self):
        # Change self.coll so that its owner isn't a superuser
        self.coll.owner = User.objects.get(username='someuser')
        self.coll.save()
        # Give the child survey asset a different owner
        self.asset_in_coll.owner = User.objects.get(username='anotheruser')
        # The change permission is inherited; prevent it from allowing
        # users to edit permissions
        self.asset_in_coll.editors_can_change_permissions = False
        self.asset_in_coll.save()
        # Ensure the parent's owner can't change permissions on the child
        self.assertFalse(self.coll.owner.has_perm(
            'share_surveyasset',
            self.asset_in_coll
        ))

    def test_change_permission_provides_share_permission(self):
        someuser = User.objects.get(username='someuser')
        self.assertFalse(someuser.has_perm(
            'change_surveyasset', self.survey_asset))
        # Grant the change permission and make sure it provides
        # share_surveyasset
        self.survey_asset.assign_perm(someuser, 'change_surveyasset')
        self.assertTrue(someuser.has_perm(
            'share_surveyasset', self.survey_asset))
        # Restrict share_surveyasset to the owner and make sure someuser loses
        # the permission
        self.survey_asset.editors_can_change_permissions = False
        self.assertFalse(someuser.has_perm(
            'share_surveyasset', self.survey_asset))

    # TODO
    def test_url_view_permission(self): pass
    def test_url_change_permission(self): pass
    def test_url_inherited_view_permission(self): pass
    def test_url_inherited_change_permission(self): pass
    def test_url_permission_conflict_resolution(self): pass
