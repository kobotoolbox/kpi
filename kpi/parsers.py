from django.conf import settings
from django.http.multipartparser import MultiPartParser as DjangoMultiPartParser
from django.http.multipartparser import MultiPartParserError
from django.utils.encoding import force_str
from rest_framework.exceptions import ParseError
from rest_framework.parsers import DataAndFiles
from rest_framework.parsers import MultiPartParser as DRFMultiPartParser

# Prefix for the short placeholder names returned by `sanitize_file_name`.
# It only needs to survive `DjangoMultiPartParser` as an opaque lookup key, so
# keep it well under Django's 255-char limit on `file.name`.
RAW_FILENAME_TOKEN_PREFIX = '__kobo_raw_filename__'


class MultiPartParserWithRawFilenames(DjangoMultiPartParser):
    """
    A parser that "smuggles" unsanitized filenames through
    `DjangoMultiPartParser._parse()`. Instead of storing the raw filename in
    `file.name` (which Django silently truncates to 255 chars), it hands back a
    short placeholder token and keeps the original filename in a side-channel
    dict. After the superclass is called, each file's raw filename is recovered
    from that dict, so it survives regardless of length.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Maps placeholder token -> original (unsanitized) filename.
        self._raw_filenames = {}

    def sanitize_file_name(self, file_name: str) -> str:
        raw = force_str(file_name)
        token = f'{RAW_FILENAME_TOKEN_PREFIX}{len(self._raw_filenames)}'
        self._raw_filenames[token] = raw
        return token

    def parse(self):
        data, files = super().parse()

        for field_name, f in files.items():
            raw = self._raw_filenames.get(f.name, f.name)
            f._raw_filename = raw
            f.name = super().sanitize_file_name(raw)

        return data, files


class RawFilenameMultiPartParser(DRFMultiPartParser):
    """
    DRF-compatible MultiPartParser that intercepts the original filenames and
    stores them, unsanitized, in ._raw_filename.
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
