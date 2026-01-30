from django.db import models

from kobo.apps.kobo_auth.shortcuts import User


class V1UserTracker(models.Model):
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name='v1_user_tracker'
    )
    last_accessed = models.DateTimeField(auto_now=True)
    last_accessed_path = models.CharField(max_length=255)

    class Meta:
        db_table = 'v1_user_tracker'
