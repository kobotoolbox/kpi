# coding: utf-8
from django.test import TestCase
from django.urls import reverse

from kobo.apps.openrosa.apps.logger.views import download_jsonform


class TestMapView(TestCase):

    def test_jsonform_url(self):
        id_string = "Tutorial"
        username = "Bob"
        url = reverse(download_jsonform, kwargs={"username": username,
                                                 "id_string": id_string})
        self.assertIn("{0}/forms/{1}/form.json".format(username, id_string),
                      url)
