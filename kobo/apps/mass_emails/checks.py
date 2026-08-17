from django.conf import settings
from django.core.checks import Error, register


def check_mass_email_send_settings(app_configs, **kwargs):
    """
    Validate the operational settings used by the mass email send loop

    An invalid value here would abort a `send_emails` run mid-way (a
    `ZeroDivisionError` from the throttle batching, or a `ValueError` from
    `time.sleep()`), stranding the remaining enqueued records until the next
    scheduled run.
    """

    errors = []

    if settings.MASS_EMAIL_THROTTLE_PER_SECOND < 1:
        errors.append(
            Error(
                f'MASS_EMAIL_THROTTLE_PER_SECOND is '
                f'{settings.MASS_EMAIL_THROTTLE_PER_SECOND}, but must be at '
                f'least 1.',
                hint=(
                    'Set the MASS_EMAIL_THROTTLE_PER_SECOND environment '
                    'variable to a positive integer.'
                ),
                id='mass_emails.E001',
            )
        )

    if settings.MASS_EMAIL_SLEEP_SECONDS < 0:
        errors.append(
            Error(
                f'MASS_EMAIL_SLEEP_SECONDS is '
                f'{settings.MASS_EMAIL_SLEEP_SECONDS}, but must not be '
                f'negative.',
                hint=(
                    'Set the MASS_EMAIL_SLEEP_SECONDS environment variable '
                    'to 0 or a positive integer.'
                ),
                id='mass_emails.E002',
            )
        )

    return errors


register(check_mass_email_send_settings)
