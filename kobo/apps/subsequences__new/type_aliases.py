from typing import Type, TypeAlias, Union

from .actions.manual_transcription import ManualTranscriptionAction

# A list of possible action classes
ActionClassType: TypeAlias = Union[
    Type[ManualTranscriptionAction],
]
