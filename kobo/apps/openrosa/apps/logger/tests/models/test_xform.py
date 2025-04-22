import os
import reversion
import unittest

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.main.tests.test_base import TestBase
from kobo.apps.openrosa.apps.logger.models import XForm
from kpi.models.asset import Asset


class TestXForm(TestBase):
    def test_set_title_in_xml_unicode_error(self):
        xls_file_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "../..",  "fixtures", "tutorial", "tutorial_arabic_labels.xls"
        )
        self._publish_xls_file_and_set_xform(xls_file_path)

        self.assertTrue(isinstance(self.xform.xml, str))

        # change title
        self.xform.title = 'Random Title'

        self.assertNotIn(self.xform.title, self.xform.xml)

        # set title in xform xml
        self.xform._set_title()
        self.assertIn(self.xform.title, self.xform.xml)

    @unittest.skip('Fails under Django 1.6')
    def test_reversion(self):
        self.assertTrue(reversion.is_registered(XForm))

    def test_get_related_asset(self):
        """
        # Ensure the `asset` property of XForm is correctly retrieved, including
        all fallback mechanisms.
        """
        user = User.objects.create_user(
            username='alice', email='alice@alice.com', password='alice'
        )
        asset = Asset.objects.create(
            content={'survey': [{'type': 'audio', 'label': 'q1', 'name': 'q1'}]},
            owner=user
        )
        asset.deploy(backend='mock', active=True)
        id_string = asset.deployment.xform.id_string
        xform = XForm.objects.get(id_string=id_string)

        # 1) Trivial case, asset is retrieved with kpi_asset_uid
        assert xform.asset.pk == asset.pk
        xform.kpi_asset_uid = None
        xform.save(update_fields=['kpi_asset_uid'])

        # 2) No asset found, `xform.asset` should still be an asset
        Asset.objects.filter(uid=asset.uid).update(_deployment_data={})
        setattr(xform, '_cache_asset', None)
        assert xform.kpi_asset_uid is None
        assert xform.asset.pk is None
        assert xform.asset.uid == asset.uid
