from __future__ import annotations

from django.contrib.auth import get_user_model

User = get_user_model()


class PasswordValidation(User):

    class Meta:
        proxy = True
        app_label = 'kobo_auth'  # hack to make it appear in the same action as Users
        verbose_name_plural = 'Password validation'
