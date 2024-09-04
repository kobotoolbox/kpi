import contextlib

from kobo.apps.audit_log.models import SubmissionAccessLog, SubmissionGroup
from kobo.apps.audit_log.signals import create_access_log, add_submission_to_group, assign_self_to_group
from django.contrib.auth.signals import user_logged_in
from django.dispatch import receiver
from django.db.models.signals import post_save


@contextlib.contextmanager
def skip_login_access_log():
    """
    Context manager for skipping the creation of an access log on login

    Disconnects the method that creates access logs from the user_logged_in signal within the contextmanager block.
    Useful when you want full control over the audit logs produced in a test.
    """
    user_logged_in.disconnect(create_access_log)
    yield
    user_logged_in.connect(create_access_log)


@contextlib.contextmanager
def skip_all_signals():
    """
    Context manager for skipping all signals related to AccessLogs

    Disconnects the post_save and user_logged_in signals for all AccessLogs and the related proxy classes.
    Useful for testing model methods in isolation.
    """
    post_save.disconnect(add_submission_to_group, sender=SubmissionAccessLog)
    post_save.disconnect(assign_self_to_group, sender=SubmissionGroup)
    user_logged_in.disconnect(create_access_log)
    yield
    post_save.connect(add_submission_to_group, sender=SubmissionAccessLog)
    post_save.connect(assign_self_to_group, sender=SubmissionGroup)
    user_logged_in.connect(create_access_log)
