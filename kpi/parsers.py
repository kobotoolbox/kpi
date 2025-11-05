import base64

from django.conf import settings
from django.http.multipartparser import MultiPartParser as DjangoMultiPartParser
from django.http.multipartparser import MultiPartParserError
from django.utils.encoding import force_str
from rest_framework.exceptions import ParseError
from rest_framework.parsers import DataAndFiles
from rest_framework.parsers import MultiPartParser as DRFMultiPartParser


class MultiPartParserWithRawFilenames(DjangoMultiPartParser):
    """
    A parser that "smuggles" unsanitized filenames through
    `DjangoMultiPartParser._parse()` by encoding them to base64. Then, after
    the superclass is called, the base64-encoded filenames are decoded and
    split into raw and sanitized attributes on each file.
    """

    def sanitize_file_name(self, file_name: str) -> str:
        raw = force_str(file_name)
        encoded = base64.urlsafe_b64encode(raw.encode('utf-8')).decode('ascii')
        return encoded

    def parse(self):
        data, files = super().parse()

        for field_name, f in files.items():
            decoded = base64.urlsafe_b64decode(f.name.encode('ascii')).decode('utf-8')
            f._raw_filename = decoded
            f.name = super().sanitize_file_name(decoded)

        return data, files


class RawFilenameMultiPartParser(DRFMultiPartParser):
    """
    DRF-compatible MultiPartParser that intercepts the original filenames
    via base64 encoding and stores the decoded version in ._raw_filename.
    """

    def parse(self, stream, media_type=None, parser_context=None):
        """
        This is unfortunately copied verbatim from the superclass except for
        using MultiPartParserWithRawFilenames as the parser. It seems better
        than copying all of DjangoMultiPartParser.parse(), which is huge and
        has lots of sensitive logic that would have to be manually tracked
        against upstream Django
        """

        parser_context = parser_context or {}
        request = parser_context['request']
        encoding = parser_context.get('encoding', settings.DEFAULT_CHARSET)
        meta = request.META.copy()
        meta['CONTENT_TYPE'] = media_type
        upload_handlers = request.upload_handlers

        try:
            # Kobo-specific change here!
            parser = MultiPartParserWithRawFilenames(
                meta, stream, upload_handlers, encoding
            )
            data, files = parser.parse()
            return DataAndFiles(data, files)
        except MultiPartParserError as exc:
            raise ParseError('Multipart form parse error - %s' % str(exc))
