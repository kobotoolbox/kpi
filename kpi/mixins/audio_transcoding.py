# coding: utf-8
import subprocess
from datetime import datetime, timedelta
from typing import Tuple, Union

from kpi.exceptions import FFMpegException, NotSupportedFormatException
from kpi.utils.log import logging


class AudioTranscodingMixin:

    AVAILABLE_OUTPUT_FORMATS = ('mp3', 'flac')
    SUPPORTED_INPUT_MIMETYPE_PREFIXES = ('audio', 'video')

    def get_transcoded_audio(
        self,
        audio_format: str,
        include_duration=False
    ) -> Union[bytes, Tuple[bytes, timedelta]]:
        """
        Use ffmpeg to remove video (if any) and return transcoded audio from
        the file located at `self.absolute_path`
        """

        if not hasattr(self, 'mimetype') or not hasattr(self, 'absolute_path'):
            raise NotImplementedError(
                'Parent class does not implement `mimetype` or `absolute_path'
            )

        if not self.mimetype.startswith(self.SUPPORTED_INPUT_MIMETYPE_PREFIXES):
            raise NotSupportedFormatException

        audio_format = audio_format.lower()
        if audio_format not in self.AVAILABLE_OUTPUT_FORMATS:
            raise NotSupportedFormatException

        ffmpeg_command = [
            '/usr/bin/ffmpeg',
            '-i',
            self.absolute_path,
            '-ac',
            '1',
            '-vn',
            '-f',
            audio_format,
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

        if include_duration:
            duration = str(pipe.stderr).split('Duration: ')[-1].split('.')[0]
            t = datetime.strptime(duration,'%H:%M:%S')
            delta = timedelta(hours=t.hour, minutes=t.minute, seconds=t.second)
            return (pipe.stdout, delta)

        return pipe.stdout
