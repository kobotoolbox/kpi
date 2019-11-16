# coding: utf-8
from __future__ import (division, print_function, absolute_import,
                        unicode_literals)

from django.contrib import admin

from .models import CorsModel

admin.site.register(CorsModel)
