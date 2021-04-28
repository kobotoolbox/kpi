# -*- coding: utf-8 -*-
import logging

from django.conf import settings
from django.db.models import ForeignKey, SET_NULL
from django.utils.translation import ugettext_lazy as _

from django_userforeignkey.request import get_current_user

logger = logging.getLogger(__name__)


class UserForeignKey(ForeignKey):
    """Model field UserForeignKey

    Saves a reference to a user. By using the `django_userforeignkey.middleware.UserForeignKeyMiddleware`
    middleware, the field can save the reference automatically.
    """
    description = _(u"User")

    def __init__(self, auto_user=False, auto_user_add=False, **kwargs):
        self.auto_user, self.auto_user_add = auto_user, auto_user_add

        kwargs['to'] = settings.AUTH_USER_MODEL

        if auto_user or auto_user_add:
            kwargs['on_delete'] = SET_NULL
            kwargs['null'] = True
            kwargs['blank'] = True
            kwargs['editable'] = kwargs.get('editable', False)

        super(UserForeignKey, self).__init__(**kwargs)

    def pre_save(self, model_instance, add):
        object_user = self.value_from_object(model_instance)
        current_user = get_current_user()

        if current_user.pk and (self.auto_user or (self.auto_user_add and add and not object_user)):
            setattr(model_instance, self.name, current_user)
        elif not current_user.pk:
            # log if the current user cannot be referenced in DB (e.g. AnonymousUser)
            logger.info(u"Cannot save reference for non-persistent user")

        return super(UserForeignKey, self).pre_save(model_instance, add)
