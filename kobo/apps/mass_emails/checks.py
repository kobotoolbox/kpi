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

    if settings.MASS_EMAIL_THROTTLE_PER_SECOND < 0.1:
        errors.append(
            Error(
                f'MASS_EMAIL_THROTTLE_PER_SECOND is '
                f'{settings.MASS_EMAIL_THROTTLE_PER_SECOND}, but must be at '
                f'least 0.1.',
                hint=(
                    'Set the MASS_EMAIL_THROTTLE_PER_SECOND environment '
                    'variable to a positive number.'
                ),
                id='mass_emails.E001',
            )
        )

    if settings.MAILER_CONNECTION_IDLE_TIMEOUT <= 0:
        errors.append(
            Error(
                f'MAILER_CONNECTION_IDLE_TIMEOUT is '
                f'{settings.MAILER_CONNECTION_IDLE_TIMEOUT}, but must be '
                f'greater than 0.',
                hint=(
                    'Set the MAILER_CONNECTION_IDLE_TIMEOUT environment '
                    'variable to a positive number.'
                ),
                id='mass_emails.E002',
            )
        )

    return errors


register(check_mass_email_send_settings)
