"""
Tests for `create_media`, focused on SSRF-safe media downloads.
"""

from unittest.mock import MagicMock

import pytest
import responses
from django.test import TestCase
from rest_framework import status
from ssrf_protect.exceptions import SSRFProtectException

from kobo.apps.openrosa.apps.main.models.meta_data import create_media


class CreateMediaSsrfTestCase(TestCase):
    """
    `create_media` must validate every hop of the download, including
    redirects, and never fetch an internal address.
    """

    @responses.activate
    def test_create_media_blocks_redirect_to_private_ip(self):
        media = MagicMock(data_value='http://8.8.8.8/eagle.png', filename='eagle.png')
        responses.add(
            responses.GET,
            'http://8.8.8.8/eagle.png',
            status=status.HTTP_302_FOUND,
            headers={'Location': 'http://127.0.0.1/secret'},
        )

        with pytest.raises(SSRFProtectException):
            create_media(media)

        self.assertEqual(
            [call.request.url for call in responses.calls],
            ['http://8.8.8.8/eagle.png'],
        )

    @responses.activate
    def test_create_media_streams_public_redirect(self):
        media = MagicMock(data_value='http://8.8.8.8/eagle.png', filename='eagle.png')
        responses.add(
            responses.GET,
            'http://8.8.8.8/eagle.png',
            status=status.HTTP_302_FOUND,
            headers={'Location': 'http://1.1.1.1/eagle.png'},
        )
        responses.add(
            responses.GET,
            'http://1.1.1.1/eagle.png',
            status=status.HTTP_200_OK,
            body=b'media content',
        )

        result = create_media(media)

        self.assertEqual(result.data_value, 'eagle.png')
        self.assertEqual(result.data_file.read(), b'media content')
