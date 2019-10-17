# coding: utf-8
from __future__ import (unicode_literals, print_function,
                        absolute_import, division)

from django.contrib import admin

from hub.models import ExtraUserDetail
from .models import AuthorizedApplication

# Register your models here.
admin.site.register(AuthorizedApplication)
admin.site.register(ExtraUserDetail)
