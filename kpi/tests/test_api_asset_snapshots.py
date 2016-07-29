import json

from django.core.urlresolvers import reverse
from rest_framework import status

from .kpi_test_case import KpiTestCase


class TestAssetSnapshotList(KpiTestCase):
    fixtures = ['test_data']

    form_source = '''
                    {
                        "survey": [
                            {"type":"text","label":"Text+Question.","required":"true"},
                            {"name":"start","type":"start"},
                            {"name":"end","type":"end"}],
                        "settings": [
                            {"form_title":"New+form",
                            "form_id":"new_form"}]
                    }
                 '''

    def test_create_asset_snapshot(self):
        self.client.login(username='someuser', password='someuser')
        url = reverse('assetsnapshot-list')

        data = {'source': self.form_source}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED,
                         msg=response.data)
