# coding: utf-8
from django.contrib import admin

from .models.assignment import (
   Assignment,
   AssignmentAdmin,
)
from .models.region import (
    Region,
    RegionAdmin,
)

admin.site.register(Region, RegionAdmin)
admin.site.register(Assignment, AssignmentAdmin)
