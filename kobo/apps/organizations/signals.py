from django.db.models import Count
from django.db.models.signals import post_migrate
from django.dispatch import receiver

from kobo.apps.data_migrations.models import MigrationTask, MigrateTaskStatus
from .models import Organization
from .tasks import transfer_members_data_ownership_to_org


@receiver(post_migrate)
def migrate_members_data_to_org(sender, **kwargs):
    print('POST_MIGRATE', **kwargs, flush=True)
    # migration_task = MigrationTask.objects.get_or_create(
    #     name='migrate_members_data_to_org'
    # )
    # if migration_task.status != MigrateTaskStatus.CREATED:
    #     return
    #
    # migration_task.status = MigrateTaskStatus.IN_PROGRESS
    # migration_task.save(update_fields=['status'])
    #
    # organizations = Organization.objects.only('id').annotate(
    #     count=Count('organization_users')
    # ).filter(count__gt=1)
    #
    # for organization in organizations:
    #     transfer_members_data_ownership_to_org.delay(organization.pk)
    #
    # migration_task.status = MigrateTaskStatus.COMPLETED
    # migration_task.save(update_fields=['status'])
