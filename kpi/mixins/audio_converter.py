# coding: utf-8
import subprocess

from kpi.exceptions import FFMpegException, NotSupportedFormatException
from kpi.utils.log import logging


class ConverterMixin:

    AVAILABLE_CONVERSIONS = ('mp3', 'flac')
    SUPPORTED_CONVERTED_FORMAT = (
        'audio',
        'video',
    )

    def get_converter_content(self, file_format) -> bytes:
        """
        Convert and return MP3 content of File object located at
        `self.absolute_path`.
        """

        if not hasattr(self, 'mimetype') or not hasattr(self, 'absolute_path'):
            raise NotImplementedError(
                'Parent class does not implement `mimetype` or `absolute_path'
            )

        supported_formats = (
            'audio',
            'video',
        )

        if not self.mimetype.startswith(supported_formats):
            raise NotSupportedFormatException

        ffmpeg_command = [
            '/usr/bin/ffmpeg',
            '-i',
            self.absolute_path,
            '-vn',
            '-f',
            file_format,
            'pipe:1',
        ]

        pipe = subprocess.run(
            ffmpeg_command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

        if pipe.returncode:
            logging.error(f'ffmpeg error: {pipe.stderr}')
            raise FFMpegException

        return pipe.stdout
