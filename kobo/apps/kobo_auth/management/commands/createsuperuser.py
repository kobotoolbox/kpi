from allauth.account.models import EmailAddress
from django.conf import settings
from django.contrib.auth.management.commands.createsuperuser import (
    Command as CreateSuperuserCommand,
)

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.main.models.user_profile import UserProfile


class Command(CreateSuperuserCommand):
    def handle(self, *args, **options):
        super().handle(*args, **options)

        # Fix any superuser missing a user profile or email address
        UserProfile.objects.bulk_create(
            [
                UserProfile(user_id=superuser_pk, validated_password=True)
                for superuser_pk in User.objects.using(settings.OPENROSA_DB_ALIAS)
                .values_list('pk', flat=True)
                .filter(is_superuser=True)
                .exclude(
                    pk__in=UserProfile.objects.values_list('user_id', flat=True).filter(
                        user__is_superuser=True
                    )
                )
            ],
            ignore_conflicts=True,
        )

        EmailAddress.objects.bulk_create(
            [
                EmailAddress(user=user, email=user.email, verified=True, primary=True)
                for user in User.objects.filter(
                    is_superuser=True, emailaddress=None
                ).exclude(email='')
            ],
            ignore_conflicts=True,
        )
