import contextlib

from django.contrib.auth import user_logged_in

from kobo.apps.audit_log.signals import create_access_log


@contextlib.contextmanager
def skip_login_access_log():
    """
    Context manager for skipping the creation of an access log on login

    Disconnects the method that creates access logs from the user_logged_in signal
    within the contextmanager block. Useful when you want full control over the audit
    logs produced in a test.
    """
    user_logged_in.disconnect(create_access_log)
    yield
    user_logged_in.connect(create_access_log)
