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

    if not (0 < settings.MASS_EMAIL_SEND_RATE_RATIO <= 1.0):
        errors.append(
            Error(
                f'MASS_EMAIL_SEND_RATE_RATIO is '
                f'{settings.MASS_EMAIL_SEND_RATE_RATIO}, but must be greater '
                f'than 0 and at most 1.',
                hint=(
                    'Set the MASS_EMAIL_SEND_RATE_RATIO environment variable '
                    'to a value between 0 (exclusive) and 1 (inclusive). '
                    '0.5 or below is recommended so two full budget windows '
                    "landing back to back still can't exceed the provider's "
                    'real rate limit; above that is allowed but at the risk '
                    'of bursting past it near a window boundary.'
                ),
                id='mass_emails.E002',
            )
        )

    if settings.MASS_EMAIL_THROTTLE_COOLDOWN_SECONDS <= 0:
        errors.append(
            Error(
                f'MASS_EMAIL_THROTTLE_COOLDOWN_SECONDS is '
                f'{settings.MASS_EMAIL_THROTTLE_COOLDOWN_SECONDS}, but must '
                f'be greater than 0.',
                hint=(
                    'Set the MASS_EMAIL_THROTTLE_COOLDOWN_SECONDS '
                    'environment variable to a positive number.'
                ),
                id='mass_emails.E003',
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
                id='mass_emails.E004',
            )
        )

    return errors


register(check_mass_email_send_settings)
