from collections.abc import Iterator
from typing import TypeAlias

# Batches of project ids, in increasing order, each with the last project id
# walked, to resume after
XFormIdBatches: TypeAlias = Iterator[tuple[int, list[int]]]
