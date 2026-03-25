from django.core.management.base import BaseCommand
from django.db import transaction

from kobo.apps.accounts.mfa.models import MfaMethodsWrapper
from kobo.apps.openrosa.apps.main.models import UserProfile


class Command(BaseCommand):
    help = 'Backfills UserProfile.is_mfa_active to match MfaMethodsWrapper records.'

    def handle(self, *args, **options):
        active_mfa_user_ids = list(
            MfaMethodsWrapper.objects.filter(
                is_active=True
            ).values_list('user_id', flat=True)
        )

        with transaction.atomic():
            UserProfile.objects.filter(
                is_mfa_active=False,
                user_id__in=active_mfa_user_ids
            ).update(is_mfa_active=True)

            UserProfile.objects.filter(
                is_mfa_active=True
            ).exclude(
                user_id__in=active_mfa_user_ids
            ).update(is_mfa_active=False)

        self.stdout.write(
            self.style.SUCCESS(
                'Successfully synced MFA profiles with UserProfile records.'
            )
        )
