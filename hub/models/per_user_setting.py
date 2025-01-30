from django.core.exceptions import FieldError, ValidationError
from django.db import models

from kobo.apps.kobo_auth.shortcuts import User
from kpi.utils.object_permission import get_database_user


class PerUserSetting(models.Model):
    """
    A configuration setting that has different values depending on whether not
    a user matches certain criteria
    """
    user_queries = models.JSONField(
        help_text='A JSON representation of a *list* of Django queries, '
                  'e.g. `[{"email__iendswith": "@kobotoolbox.org"}, '
                  '{"email__iendswith": "@kbtdev.org"}]`. '
                  'A matching user is one who would be returned by ANY of '
                  'the queries in the list.'
    )
    name = models.CharField(max_length=255, unique=True,
                            default='INTERCOM_APP_ID')  # Not used
    value_when_matched = models.CharField(max_length=2048, blank=True)
    value_when_not_matched = models.CharField(max_length=2048, blank=True)

    def user_matches(self, user, ignore_invalid_queries=True):
        user = get_database_user(user)
        manager = user._meta.model.objects
        queryset = manager.none()
        for user_query in self.user_queries:
            try:
                queryset |= manager.filter(**user_query)
            except (FieldError, TypeError):
                if ignore_invalid_queries:
                    return False
                else:
                    raise
        return queryset.filter(pk=user.pk).exists()

    def get_for_user(self, user):
        if self.user_matches(user):
            return self.value_when_matched
        else:
            return self.value_when_not_matched

    def clean(self):
        user = User.objects.first()
        if not user:
            return
        try:
            self.user_matches(user, ignore_invalid_queries=False)
        except FieldError as e:
            raise ValidationError({'user_queries': e.message})
        except TypeError:
            raise ValidationError(
                {'user_queries': 'JSON structure is incorrect.'})

    def __str__(self):
        return self.name
