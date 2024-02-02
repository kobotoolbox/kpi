import threading
from functools import wraps

thread_local = threading.local()


class use_db:
    """
    source: https://adriennedomingus.medium.com/django-databases-and-decorators-14fa1f9a5c97
    """
    def __init__(self, database_name):
        self.database_name = database_name

    def __enter__(self):
        setattr(thread_local, 'DB_ALIAS', self.database_name)

    def __exit__(self, exc_type, exc_value, traceback):
        setattr(thread_local, 'DB_ALIAS', None)

    def __call__(self, test_func):
        @wraps(test_func)
        def inner(*args, **kwargs):
            return test_func(*args, **kwargs)
        return inner


def get_thread_local(attr, default=None):
    return getattr(thread_local, attr, None) or default
