# coding: utf-8
import pytest

import json
import re
from collections import OrderedDict
from copy import deepcopy

import xlrd
from django.contrib.auth.models import User, AnonymousUser
from django.core.exceptions import ValidationError
from django.test import TestCase

from kpi.utils.kobo_content import KoboContent

from kpi.constants import PERM_VIEW_ASSET, PERM_CHANGE_ASSET, PERM_SHARE_ASSET, \
    PERM_VIEW_COLLECTION, PERM_CHANGE_COLLECTION
from kpi.models import Asset
from kpi.models import Collection
from kpi.models.object_permission import get_all_objects_for_user

# move this into a fixture file?
# note: this is not a very robust example of a cascading select
CASCADE_CONTENT = {'survey': [{'type': 'select_one',
                                'select_from_list_name': 'country',
                                'label': ['country'],
                                '$anchor': 'xs1',
                                'name': 'xs1',
                                'required': True},
                               {'type': 'select_one',
                                'select_from_list_name': 'region',
                                'label': ['region'],
                                '$anchor': 'xs2',
                                'name': 'xs2',
                                'choice_filter': 'country=${country}',
                                'required': True},
                               {'type': 'select_one',
                                'select_from_list_name': 'town',
                                'label': ['region'],
                                '$anchor': 'xs3',
                                'name': 'xs3',
                                'choice_filter': 'region=${region}',
                                'required': True}],
                   'choices': [{'label': ['France'],
                                 '$anchor': 'xc1',
                                 'name': 'xc1',
                                 'list_name': 'country',
                                 'name': 'france'},
                                {'country': 'france',
                                 'label': ['\xcele-de-France'],
                                 '$anchor': 'xc2',
                                 'name': 'xc2',
                                 'list_name': 'region',
                                 'name': 'ile-de-france'},
                                {'region': 'ile-de-france',
                                 'label': ['Paris'],
                                 '$anchor': 'xc3',
                                 'name': 'xc3',
                                 'list_name': 'town',
                                 'name': 'paris'}],
                   'translated': ['label'],
                   'schema': '1',
                   'translations': [None]}


class AssetsTestCase(TestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.user = User.objects.get(username='someuser')
        self.asset = Asset.objects.create(content={'schema': '2',
            'translations': [{'$anchor': 'tx0', 'name': ''}],
            'survey': [{'type': 'text',
                        '$anchor': 'abc',
                        'label': {'tx0': 'Question 1'},
                        'name': 'q1'},
                       {'type': 'text',
                        '$anchor': 'def',
                        'label': {'tx0': 'Question 2'},
                        'name': 'q2'}]
            }, owner=self.user, asset_type='survey')
        self.sa = self.asset


class CreateAssetVersions(AssetsTestCase):

    def test_asset_with_versions(self):
        self.asset.content['survey'][0]['type'] = 'integer'
        self.assertEqual(self.asset.content['survey'][0]['type'], 'integer')
        self.asset.save()
        self.assertEqual(self.asset.asset_versions.count(), 2)

    def test_asset_can_be_owned(self):
        self.assertEqual(self.asset.owner, self.user)

    def test_asset_can_be_tagged(self):
        def _list_tag_names():
            return sorted(list(self.asset.tags.names()))
        self.assertEqual(_list_tag_names(), [])
        self.asset.tags.add('tag1')
        self.assertEqual(_list_tag_names(), ['tag1'])
        # duplicate tags ignored
        self.asset.tags.add('tag1')
        self.assertEqual(_list_tag_names(), ['tag1'])
        self.asset.tags.add('tag2')
        self.assertEqual(_list_tag_names(), ['tag1', 'tag2'])

    def test_asset_can_be_reverted(self):
        anchors = [rr.get('$anchor') for rr in self.asset.content['survey']]
        assert anchors == ['abc', 'def']
        _content = self.asset.content
        # just making sure it's valid
        _content_plus1 = KoboContent(_content, validate=True).export(schema='2')
        _content_plus1['survey'].append({'type':'note',
                                        'label': {'tx0':'note'},
                                        'name': 'xx',
                                        '$anchor': 'xx'})

        vuid = self.asset.latest_version.uid
        self.asset.content = _content_plus1
        self.asset.save()

        assert len(self.asset.content['survey']) == 3

        vcount = self.asset.asset_versions.count()
        self.asset.revert_to_version(vuid)
        vcount2 = self.asset.asset_versions.count()
        assert (vcount + 1) == vcount2

        assert len(self.asset.content['survey']) == 2

    def test_asset_can_be_anonymous(self):
        anon_asset = Asset.objects.create(content=self.asset.content)
        self.assertEqual(anon_asset.owner, None)


class AssetContentTests(AssetsTestCase):
    def _wrap_field(self, field_name, value):
        return {'survey': [
            {'type': 'text', 'name': 'x'},
            {'type': 'text', 'name': 'y', field_name: value},
        ]}

    def _wrap_type(self, type_val, select_from=None):
        r1 = {'type': type_val,
              'name': 'q_yn',
              'label': 'Yes or No'}
        if select_from:
            r1['select_from_list_name'] = select_from
        return {'survey': [r1], 'choices': [
            {'list_name': 'yn', 'name': 'y', 'label': 'Yes'},
            {'list_name': 'yn', 'name': 'n', 'label': 'No'},
        ]}

    def test_to_xls_io_versioned_appended(self):
        # it would be nice to support this syntax: 'label': {'*': 'wee'},
        _label = {}
        for tx in self.asset.content['translations']:
            _label[tx['$anchor']] = 'wee'
        append = {
            'survey': [
                {
                    '$anchor': 'testnote',
                    'type': 'note',
                    'name': 'testnote',
                    'label': _label,
                    # it would be nice to support this syntax:
                 },
            ],
            'settings': {
                'submission_url': 'jkl',
            }
        }
        xls_io = self.asset.to_xls_io(versioned=True, append=append)
        workbook = xlrd.open_workbook(file_contents=xls_io.read())

        survey_sheet = workbook.sheet_by_name('survey')
        # `versioned=True` should add a calculate question to the the last row.
        # The calculation (version uid) changes on each run, so don't look past
        # the first two columns (type and name)

        keys = [kk.value for kk in survey_sheet.row(0)]
        r3vals = [vv.value for vv in survey_sheet.row(3)]
        r4vals = [vv.value for vv in survey_sheet.row(4)]
        note_row = dict(zip(keys, r3vals))

        # this no longer tests the order of the columns
        assert note_row['type'] == 'note'
        assert note_row['name'] == 'testnote'

        calc_row = dict(zip(keys, r4vals))
        assert calc_row['type'] == 'calculate'
        assert calc_row['name'] == '__version__'

        settings_sheet = workbook.sheet_by_name('settings')

        settings_from_sheet = dict([
            (kk.value for kk in settings_sheet.col(nn)) for nn in [0, 1]
        ])
        assert settings_from_sheet['submission_url'] == 'jkl'
        assert len(settings_from_sheet['version']) == 22
        assert settings_from_sheet['version'][0] == 'v'


class AssetSettingsTests(AssetsTestCase):
    def _content(self, form_title='some form title'):
        return {
            'settings': {
                'title': form_title,
                'identifier': 'xid_stringx',
            },
            'schema': '2',
            'survey': [
                {'type': 'text', 'label': {'tx0': 'Question 1'},
                 'name': 'q1', '$anchor': 'abc'},
                {'type': 'text', 'label': {'tx0': 'Question 2'},
                 'name': 'q2', '$anchor': 'def'},
            ],
            'translations': [{'$anchor': 'tx0', 'name': ''}],
        }

    def test_asset_type_changes_based_on_row_count(self):
        # we are inferring the asset_type from the content so that
        # a question can become a block and vice versa
        a1 = Asset.objects.create(content=self._content(), owner=self.user,
                                  asset_type='block')
        self.assertEqual(a1.asset_type, 'block')
        self.assertEqual(len(a1.content['survey']), 2)

        # shorten the content
        a1.content['survey'] = [a1.content['survey'][0]]

        # trigger the asset_type change
        a1.save()
        self.assertEqual(a1.asset_type, 'question')
        self.assertEqual(len(a1.content['survey']), 1)

    def test_blocks_strip_settings(self):
        a1 = Asset.objects.create(content=self._content(), owner=self.user,
                                  asset_type='block')
        self.assertEqual(a1.content['settings'], {})

    def test_questions_strip_settings(self):
        a1 = Asset.objects.create(content=self._content(), owner=self.user,
                                  asset_type='question')
        self.assertEqual(a1.content['settings'], {})

    def test_surveys_retain_settings(self):
        _content = self._content()
        _content['settings'] = {
            'style': ['pages'],
        }
        a1 = Asset.objects.create(content=_content, owner=self.user,
                                  asset_type='survey')
        self.assertEqual(a1.asset_type, 'survey')
        assert a1.content_v2['settings'].get('style') == ['pages']

    def test_templates_retain_settings(self):
        _content = self._content()
        _content['settings'] = {'style': ['pages'],}
        a1 = Asset.objects.create(content=_content, owner=self.user,
                                  asset_type='template')
        assert a1.asset_type == 'template'
        assert a1.content_v2['settings'].get('style') == ['pages']

    def test_surveys_move_form_title_to_name(self):
        ccx = self._content('abcxyz')
        a1 = Asset.objects.create(content=ccx,
                                  owner=self.user,
                                  asset_type='survey')
        content_v2 = a1.content_v2
        # settingslist
        settings = content_v2['settings']
        self.assertEqual(a1.asset_type, 'survey')
        assert 'title' not in settings.keys()
        # self.assertTrue('title' not in settings.keys())
        self.assertEqual(a1.name, 'abcxyz')

    def test_templates_move_form_title_to_name(self):
        a1 = Asset.objects.create(content=self._content('abcxyz'),
                                  owner=self.user,
                                  asset_type='template')
        # settingslist
        settings = a1.content['settings']
        self.assertEqual(a1.asset_type, 'template')
        self.assertTrue('form_title' not in settings)
        self.assertEqual(a1.name, 'abcxyz')


class AssetScoreTestCase(TestCase):
    fixtures = ['test_data']

    @pytest.mark.skip(reason='matrix not yet implemented in this refactor')
    def test_score_can_be_exported(self):
        _matrix_score = {
            'survey': [
                {'kobo--score-choices': 'nb7ud55',
                 'label': ['Los Angeles'],
                 'required': True,
                 'type': 'begin_score'},
                {'label': ['Food'], 'type': 'score__row'},
                {'label': ['Music'], 'type': 'score__row'},
                {'label': ['Night life'], 'type': 'score__row'},
                {'label': ['Housing'], 'type': 'score__row'},
                {'label': ['Culture'], 'type': 'score__row'},
                {'type': 'end_score'}],
            'choices': [
                {'label': ['Great'],
                 'list_name': 'nb7ud55'},
                {'label': ['OK'],
                 'list_name': 'nb7ud55'},
                {'label': ['Bad'],
                 'list_name': 'nb7ud55'}],
            'settings': {},
        }
        a1 = Asset.objects.create(content=_matrix_score, asset_type='survey')
        _snapshot = a1.snapshot
        self.assertNotEqual(_snapshot.xml, '')
        self.assertNotEqual(_snapshot.details['status'], 'failure')


class AssetSnapshotXmlTestCase(AssetSettingsTests):
    @pytest.mark.skip(reason='need to get cascades working')
    def test_cascading_select_xform(self):
        asset = Asset.objects.create(asset_type='survey',
                                     content=CASCADE_CONTENT)
        # kuids automatically populated by asset.save()
        _content = asset.content_v2
        anchor_key = '$anchor'
        survey_kuids = [row.get('$anchor') for row in asset.content.get('survey')]
        choices_kuids = ()
        for list_name, choices in _content['choices'].items():
            for choice in choices:
                choices_kuids = choices_kuids + (choice.get(anchor_key),)
                # [row.get('$anchor') for row in asset.content.get('choices')]
        self.assertTrue(None not in survey_kuids)
        self.assertTrue(None not in choices_kuids)
        # asset.snapshot.xml generates a document that does not have any
        # "$kuid" or "<$kuid>x</$kuid>" elements
        _xml = asset.snapshot.xml
        # as is in every xform:
        assert '<instance>' in _xml
        # specific to this cascading select form:
        for expected in ['town', 'region', 'country']:
            assert '<instance id="{}">'.format(expected) in _xml
        assert '$kuid' not in _xml

    def test_surveys_exported_to_xml_have_id_string_and_title(self):
        a1 = Asset.objects.create(content=self._content('abcxyz'),
                                  owner=self.user,
                                  asset_type='survey')
        export = a1.snapshot
        assert '<h:title>abcxyz</h:title>' in export.xml
        assert '<data id="xid_stringx">' in export.xml


# TODO: test values of "valid_xlsform_content"

# class ReadAssetsTests(AssetsTestCase):
#     def test_strip_kuids(self):
#         sans_kuid = self.sa.to_ss_structure(content_tag='survey', strip_kuids=True)['survey']
#         self.assertEqual(len(sans_kuid), 2)
#         self.assertTrue('kuid' not in sans_kuid[0].keys())

# class UpdateAssetsTest(AssetsTestCase):
#     def test_add_settings(self):
#         self.assertEqual(self.asset.settings, None)
#         self.asset.settings = {'style':'grid-theme'}
# self.assertEqual(self.asset.settings, {'style':'grid-theme'})
#         ss_struct = self.asset.to_ss_structure()['settings']
#         self.assertEqual(len(ss_struct), 1)
#         self.assertEqual(ss_struct[0], {
#                 'style': 'grid-theme',
#             })

class ShareAssetsTest(AssetsTestCase):

    def setUp(self):
        super().setUp()
        self.someuser = User.objects.get(username='someuser')
        self.anotheruser = User.objects.get(username='anotheruser')
        self.coll = Collection.objects.create(owner=self.user)
        # Make a copy of self.asset and put it inside self.coll
        self.asset_in_coll = self.asset.clone()
        self.asset_in_coll.parent = self.coll
        self.asset_in_coll.save()

    def grant_and_revoke_standalone(self, user, perm):
        self.assertEqual(user.has_perm(perm, self.asset), False)
        # Grant
        self.asset.assign_perm(user, perm)
        self.assertEqual(user.has_perm(perm, self.asset), True)
        # Revoke
        self.asset.remove_perm(user, perm)
        self.assertEqual(user.has_perm(perm, self.asset), False)

    def test_user_view_permission(self):
        self.grant_and_revoke_standalone(self.anotheruser, PERM_VIEW_ASSET)

    def test_user_change_permission(self):
        self.grant_and_revoke_standalone(self.anotheruser, PERM_CHANGE_ASSET)

    def grant_and_revoke_parent(self, user, perm):
        # Collection permissions have different suffixes
        coll_perm = re.sub('_asset$', '_collection', perm)
        self.assertEqual(user.has_perm(perm, self.asset_in_coll), False)
        # Grant
        self.coll.assign_perm(user, coll_perm)
        self.assertEqual(user.has_perm(perm, self.asset_in_coll), True)
        # Revoke
        self.coll.remove_perm(user, coll_perm)
        self.assertEqual(user.has_perm(perm, self.asset_in_coll), False)

    def test_user_inherited_view_permission(self):
        self.grant_and_revoke_parent(self.anotheruser, PERM_VIEW_ASSET)

    def test_user_inherited_change_permission(self):
        self.grant_and_revoke_parent(self.anotheruser, PERM_CHANGE_ASSET)

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
        user = self.anotheruser
        self.assign_collection_asset_perms(
            user,
            PERM_VIEW_COLLECTION,
            PERM_CHANGE_ASSET,
            asset_first=asset_first
        )

    def test_user_change_collection_view_asset(self, asset_first=False):
        user = self.anotheruser
        self.assign_collection_asset_perms(
            user,
            PERM_CHANGE_COLLECTION,
            PERM_CHANGE_ASSET,
            asset_deny=True,
            asset_first=asset_first
        )
        # assign_collection_asset_perms verifies the assignments, but make sure
        # that the user can still view the asset
        self.assertEqual(user.has_perm(PERM_VIEW_ASSET, self.asset_in_coll),
                         True)

    def test_user_change_collection_deny_asset(self, asset_first=False):
        user = self.anotheruser
        self.assign_collection_asset_perms(
            user,
            PERM_CHANGE_COLLECTION,
            PERM_VIEW_ASSET,
            asset_deny=True,
            asset_first=asset_first
        )
        # Verify that denying view_asset denies change_asset as well
        self.assertEqual(user.has_perm(PERM_CHANGE_ASSET,
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
            get_all_objects_for_user(self.user, Asset).count(),
            2
        )
        # The other user should have nothing yet
        self.assertEqual(
            get_all_objects_for_user(self.anotheruser, Asset).count(),
            0
        )
        # Grant access and verify the result
        self.asset.assign_perm(self.anotheruser, PERM_VIEW_ASSET)
        self.assertEqual(
            # Without coercion, django.db.models.query.ValuesListQuerySet isn't
            # a real list and will fail the comparison.
            list(
                get_all_objects_for_user(
                    self.anotheruser,
                    Asset
                ).values_list('pk', flat=True)
            ),
            [self.asset.pk]
        )

    def test_owner_can_edit_permissions(self):
        self.assertTrue(self.asset.owner.has_perm(
            PERM_SHARE_ASSET,
            self.asset
        ))

    def test_share_asset_permission_is_not_inherited(self):
        # Give the child asset a different owner
        self.asset_in_coll.owner = User.objects.get(username='anotheruser')
        # The change permission is inherited; prevent it from allowing
        # users to edit permissions
        self.asset_in_coll.editors_can_change_permissions = False
        self.asset_in_coll.save()
        # Ensure the parent's owner can't change permissions on the child
        self.assertFalse(self.coll.owner.has_perm(
            PERM_SHARE_ASSET,
            self.asset_in_coll
        ))

    def test_change_permission_provides_share_permission(self):
        anotheruser = User.objects.get(username='anotheruser')
        self.assertFalse(anotheruser.has_perm(
            PERM_CHANGE_ASSET, self.asset))
        # Grant the change permission and make sure it provides
        # share_asset
        self.asset.assign_perm(anotheruser, PERM_CHANGE_ASSET)
        self.assertTrue(anotheruser.has_perm(
            PERM_SHARE_ASSET, self.asset))
        # Restrict share_asset to the owner and make sure anotheruser loses
        # the permission
        self.asset.editors_can_change_permissions = False
        self.assertFalse(anotheruser.has_perm(
            PERM_SHARE_ASSET, self.asset))

    def test_anonymous_view_permission_on_standalone_asset(self):
        # Grant
        self.assertFalse(AnonymousUser().has_perm(
            PERM_VIEW_ASSET, self.asset))
        self.asset.assign_perm(AnonymousUser(), PERM_VIEW_ASSET)
        self.assertTrue(AnonymousUser().has_perm(
            PERM_VIEW_ASSET, self.asset))
        # Revoke
        self.asset.remove_perm(AnonymousUser(), PERM_VIEW_ASSET)
        self.assertFalse(AnonymousUser().has_perm(
            PERM_VIEW_ASSET, self.asset))

    def test_anoymous_change_permission_on_standalone_asset(self):
        # TODO: behave properly if ALLOWED_ANONYMOUS_PERMISSIONS actually
        # includes change_asset
        try:
            # This is expected to fail since only real users can have any
            # permissions beyond view
            self.asset.assign_perm(
                AnonymousUser(), PERM_CHANGE_ASSET)
        except ValidationError:
            pass
        # Make sure the assignment failed
        self.assertFalse(AnonymousUser().has_perm(
            PERM_CHANGE_ASSET, self.asset))

    def test_anonymous_as_baseline_for_authenticated(self):
        """
        If the public can view an object, then all users should be able
        to do the same.
        """
        # Neither anonymous nor `anotheruser` should have any permission yet
        for user_obj in AnonymousUser(), self.anotheruser:
            self.assertFalse(user_obj.has_perm(
                PERM_VIEW_ASSET, self.asset))
        # Grant to anonymous
        self.asset.assign_perm(AnonymousUser(), PERM_VIEW_ASSET)
        # Check that both anonymous and `anotheruser` can view
        for user_obj in AnonymousUser(), self.anotheruser:
            self.assertTrue(user_obj.has_perm(
                PERM_VIEW_ASSET, self.asset))
