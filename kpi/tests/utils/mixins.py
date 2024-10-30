import base64
import json
from io import StringIO

from rest_framework import status
from rest_framework.reverse import reverse

from kpi.models.asset_file import AssetFile


class AssetFileTestCaseMixin:

    @property
    def asset_file_payload(self):
        geojson_ = StringIO(
            json.dumps(
                {
                    'type': 'Feature',
                    'geometry': {'type': 'Point', 'coordinates': [125.6, 10.1]},
                    'properties': {'name': 'Dinagat Islands'},
                }
            )
        )
        geojson_.name = 'dingagat_island.geojson'
        return {
            'file_type': AssetFile.MAP_LAYER,
            'description': 'Dinagat Islands',
            'content': geojson_,
            'metadata': json.dumps({'source': 'http://geojson.org/'}),
        }

    def create_asset_file(
        self, payload=None, status_code=status.HTTP_201_CREATED
    ):
        payload = self.asset_file_payload if payload is None else payload

        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(json.loads(response.content)['count'], 0)
        response = self.client.post(self.list_url, payload)
        self.assertEqual(response.status_code, status_code)
        return response

    def delete_asset_file(self):
        af_uid = self.verify_asset_file(self.create_asset_file())
        detail_url = reverse(
            self._get_endpoint('asset-file-detail'),
            args=(self.asset.uid, af_uid),
        )
        response = self.client.delete(detail_url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        # TODO: test that the file itself is removed

    def get_asset_file_content(self, url):
        response = self.client.get(url)
        return b''.join(response.streaming_content)

    def verify_asset_file(self, response, payload=None, form_media=False):
        posted_payload = self.asset_file_payload if payload is None else payload
        response_dict = json.loads(response.content)
        self.assertEqual(
            response_dict['asset'],
            self.absolute_reverse(
                self._get_endpoint('asset-detail'), args=[self.asset.uid]
            ),
        )
        self.assertEqual(
            response_dict['user'],
            self.absolute_reverse(
                self._get_endpoint('user-kpi-detail'),
                args=[self.current_username],
            ),
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
            json.dumps(response_metadata), posted_payload['metadata']
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
                expected_content,
            )
            return response_dict['uid']

        # Content uploaded as base64
        try:
            base64_encoded = posted_payload['base64Encoded']
        except KeyError:
            pass
        else:
            media_content = base64_encoded[base64_encoded.index('base64') + 7 :]
            expected_content = base64.decodebytes(media_content.encode())
            self.assertEqual(
                self.get_asset_file_content(response_dict['content']),
                expected_content,
            )
            return response_dict['uid']

        # Content uploaded as a URL
        metadata = json.loads(posted_payload['metadata'])
        payload_url = metadata['redirect_url']
        # If none of the other upload methods have been chosen,
        # `redirect_url` should be present in the response because user
        # must have provided a redirect url. Otherwise, a validation error
        # should have been raised about invalid payload.
        response_url = response_dict['metadata']['redirect_url']
        assert response_url == payload_url and response_url != ''
        return response_dict['uid']


class PermissionAssignmentTestCaseMixin:

    def get_asset_perm_assignment_list_url(self, asset):
        return reverse(
            self._get_endpoint('asset-permission-assignment-list'),
            kwargs={'parent_lookup_asset': asset.uid}
        )

    def get_urls_for_asset_perm_assignment_objs(self, perm_assignments, asset):
        return [
            self.absolute_reverse(
                self._get_endpoint('asset-permission-assignment-detail'),
                kwargs={'uid': uid, 'parent_lookup_asset': asset.uid},
            )
            for uid in perm_assignments.values_list('uid', flat=True)
        ]
