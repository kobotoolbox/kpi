# coding: utf-8
from datetime import datetime, timedelta
from typing import Tuple, Union

from kpi.exceptions import NotSupportedFormatException
from kpi.utils.ffmpeg import decode_args, run_ffmpeg


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

        pipe = run_ffmpeg([
            *decode_args(self.absolute_path),
            '-f',
            audio_format,
            'pipe:1',
        ])

        if include_duration:
            duration = str(pipe.stderr).split('Duration: ')[-1].split('.')[0]
            t = datetime.strptime(duration,'%H:%M:%S')
            delta = timedelta(hours=t.hour, minutes=t.minute, seconds=t.second)
            return (pipe.stdout, delta)

        return pipe.stdout
