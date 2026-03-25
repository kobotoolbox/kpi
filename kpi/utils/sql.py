from contextlib import contextmanager

import sqlparse


@contextmanager
def disable_max_tokens(*args, **kwargs):
    """
    Temporarily turns off SQLParse MAX_GROUPING_TOKENS. Use only for trusted SQL input
    """
    current_max_tokens = sqlparse.engine.grouping.MAX_GROUPING_TOKENS
    sqlparse.engine.grouping.MAX_GROUPING_TOKENS = None
    try:
        yield
    finally:
        sqlparse.engine.grouping.MAX_GROUPING_TOKENS = current_max_tokens
