import threading
from contextlib import contextmanager

import sqlparse

lock = threading.Lock()


@contextmanager
def disable_max_tokens(*args, **kwargs):
    with lock:
        old_limit = sqlparse.engine.grouping.MAX_GROUPING_TOKENS
        sqlparse.engine.grouping.MAX_GROUPING_TOKENS = None
        try:
            yield
        finally:
            sqlparse.engine.grouping.MAX_GROUPING_TOKENS = old_limit
