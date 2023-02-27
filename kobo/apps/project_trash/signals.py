from django.db.models.signals import post_delete
from django.dispatch import receiver

from django_celery_beat.models import PeriodicTask


#@receiver(post_delete, sender=PeriodicTask)
#def delete_clocked_schedule(sender, instance, **kwargs):
#    instance.clocked.delete()
