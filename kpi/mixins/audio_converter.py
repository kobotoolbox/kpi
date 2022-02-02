# coding: utf-8
import subprocess

from kpi.exceptions import FFMpegException, NotSupportedFormatException
from kpi.utils.log import logging


class AudioConverterMixin:

    CONVERSION_AUDIO_FORMAT = 'mp3'
    SUPPORTED_CONVERTED_FORMAT = (
        'audio',
        'video',
    )

    def get_converted_audio(self, input_file: str) -> bytes:

        supported_formats = (
            'audio',
            'video',
        )

        if not self.mimetype.startswith(supported_formats):
            raise NotSupportedFormatException

        ffmpeg_command = [
            '/usr/bin/ffmpeg',
            '-i',
            self.path,
            '-f',
            self.CONVERSION_AUDIO_FORMAT,
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
