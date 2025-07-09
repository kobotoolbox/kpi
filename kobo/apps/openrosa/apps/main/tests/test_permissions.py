# coding: utf-8
import os

from kobo.apps.openrosa.libs.permissions import assign_perm, remove_perm
from kpi.constants import PERM_CHANGE_ASSET, PERM_VIEW_ASSET

from .test_base import TestBase


class TestPermissions(TestBase):

    def setUp(self):
        TestBase.setUp(self)
        self._create_user_and_login()
        self._publish_transportation_form()
        s = 'transport_2011-07-25_19-05-49'
        self._make_submission(os.path.join(
            self.this_directory, 'fixtures',
            'transportation', 'instances', s, s + '.xml'))
        self.submission = self.xform.instances.reverse()[0]

    def test_set_permissions_for_user(self):
        # alice cannot view bob's forms
        # `self.xform` belongs to bob
        self._create_user_and_login('alice', 'alice')
        # Alice is `self.user` now.
        self.assertEqual(self.user.has_perm(PERM_VIEW_ASSET, self.xform.asset), False)
        self.assertEqual(self.user.has_perm(PERM_CHANGE_ASSET, self.xform.asset), False)
        assign_perm(PERM_VIEW_ASSET, self.user, self.xform.asset)
        self.assertEqual(self.user.has_perm(PERM_VIEW_ASSET, self.xform.asset), True)
        assign_perm(PERM_CHANGE_ASSET, self.user, self.xform.asset)
        self.assertEqual(self.user.has_perm(PERM_CHANGE_ASSET, self.xform.asset), True)
        xform = self.xform

        remove_perm(PERM_VIEW_ASSET, self.user, xform.asset)
        self.assertEqual(self.user.has_perm(PERM_VIEW_ASSET, xform.asset), False)
        remove_perm(PERM_CHANGE_ASSET, self.user, xform.asset)
        self.assertEqual(self.user.has_perm(PERM_CHANGE_ASSET, xform.asset), False)

        self._publish_transportation_form()
        self.assertNotEqual(xform, self.xform)
        # Alice is the owner of `self.xform`
        self.assertEqual(self.user.has_perm(PERM_VIEW_ASSET, self.xform.asset), True)
        self.assertEqual(self.user.has_perm(PERM_CHANGE_ASSET, self.xform.asset), True)
