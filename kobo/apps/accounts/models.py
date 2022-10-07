from django.db import models


class ImportedVerification(models.Model):
    """
    Temporary model indicating the email address is imported from django-registration
    and is not truely verified.
    Is it Spring 2023 or later? Delete me please.
    Also modify the initial migration to not create these.
    """

    email = models.OneToOneField(
        'account.EmailAddress',
        on_delete=models.CASCADE,
        primary_key=True,
        related_name='+',
    )
