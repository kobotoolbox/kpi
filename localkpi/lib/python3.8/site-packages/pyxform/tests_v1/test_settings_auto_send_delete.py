# -*- coding: utf-8 -*-
"""
Test settins auto settings.
"""
from pyxform.tests_v1.pyxform_test_case import PyxformTestCase


class SettingsAutoSendDelete(PyxformTestCase):
    def test_settings_auto_send_true(self):

        self.assertPyxformXform(
            name="data",
            md="""
            | survey   |              |           |           |
            |          | type         | name      | label     |
            |          | text         | name      | Name      |
            | settings |              |           |           |
            |          | auto_send    |           |           |
            |          | true         |           |           |
            """,
            debug=False,
            xml__contains=['<submission orx:auto-send="true"/>'],
        )

    def test_settings_auto_delete_true(self):

        self.assertPyxformXform(
            name="data",
            md="""
            | survey   |              |           |           |
            |          | type         | name      | label     |
            |          | text         | name      | Name      |
            | settings |              |           |           |
            |          | auto_delete  |           |           |
            |          | true         |           |           |
            """,
            debug=False,
            xml__contains=['<submission orx:auto-delete="true"/>'],
        )

    def test_settings_auto_send_delete_false(self):

        self.assertPyxformXform(
            name="data",
            md="""
            | survey   |              |           |           |
            |          | type         | name      | label     |
            |          | text         | name      | Name      |
            | settings |              |           |           |
            |          | auto_delete  | auto_send |           |
            |          | false        | false     |           |
            """,
            debug=False,
            xml__contains=[
                '<submission orx:auto-delete="false" orx:auto-send="false"/>'
            ],
        )

    def test_settings_without_submission_url_does_not_generate_method_attribute(self):

        self.assertPyxformXform(
            name="data",
            md="""
            | survey   |              |           |           |
            |          | type         | name      | label     |
            |          | text         | name      | Name      |
            | settings |                                                                    |           |           |
            |          | public_key                                                         | auto_send |           |
            |          | MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwOHPJWD9zc8JPBZj/UtC   | false     |           |
            |          | dHiY7I4HWt61UG1XRaGvvwUkC/y8P5Kk6dRnf3yMTBHQoisT2vU2ODWVaU5elndk   |           |           |
            |          | hiKiWdhufp1d86FWGYz/i+VOmdoV+0zoyPzk+vTEG8bpiY7/UcDYY0CsrRmaMei1   |           |           |
            |          | 15xZwQpSMpayqMjemvwGDyhy2B3Yize4yaxyLFG53wMrHEczzsYz8FuRfuKUleE/   |           |           |
            |          | 6jFc3uXZET4LJ7S76n1XU+bE+mhhoZ+tVERgaVH38l0SZljBITwHeqQ9WQckkmDf   |           |           |
            |          | bRHBG7TQm+Afnx0s5E2bGIT5jB5cj9YaX6BqZSeodpafQjpXEJg6uufxF1Ni3Btv   |           |           |
            |          |  4wIDAQAB                                                          |           |           |
            """,
            debug=False,
            xml__contains=[
                '<submission base64RsaPublicKey="MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwOHPJWD9zc8JPBZj/UtC" orx:auto-send="false"/>'
            ],
        )

    def test_settings_with_submission_url_generates_method_attribute(self):

        self.assertPyxformXform(
            name="data",
            md="""
            | survey   |              |           |           |
            |          | type         | name      | label     |
            |          | text         | name      | Name      |
            | settings |                                                       |           |           |
            |          | submission_url                                        | auto_send |           |
            |          | https://odk.ona.io/random_person/submission           | false     |           |
            """,
            debug=False,
            xml__contains=[
                '<submission action="https://odk.ona.io/random_person/submission" method="post" orx:auto-send="false"/>'
            ],
        )
