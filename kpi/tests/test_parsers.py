from io import BytesIO

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIRequestFactory

from kpi.parsers import RawFilenameMultiPartParser


class RawFilenameMultiPartParserTestCase(TestCase):
    def _parse_single_file(self, filename: str):
        upload = SimpleUploadedFile(filename, b'<data/>', content_type='text/xml')
        request = APIRequestFactory().post(
            '/', {'xml_submission_file': upload}, format='multipart'
        )
        parser = RawFilenameMultiPartParser()
        result = parser.parse(
            BytesIO(request.body),
            request.META['CONTENT_TYPE'],
            {'request': request, 'encoding': 'utf-8'},
        )
        return result.files['xml_submission_file']

    def test_preserves_long_raw_filename(self):
        # KoboCollect names the submission file after the form title. A long
        # title used to overflow the base64-smuggled name past Django's
        # 255-char cap on `file.name`, corrupting it and raising during decode
        # (the production HTTP 500). The original filename must survive intact.
        filename = 'a' * 220 + '.xml'
        parsed = self._parse_single_file(filename)
        assert parsed._raw_filename == filename

    def test_preserves_short_raw_filename(self):
        filename = 'submission.xml'
        parsed = self._parse_single_file(filename)
        assert parsed._raw_filename == filename
