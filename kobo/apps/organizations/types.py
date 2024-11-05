from typing import Literal, Union

UsageType = Literal['characters', 'seconds', 'submission', 'storage']

UsageLimit = Union[int, Literal['unlimited']]
