# coding: utf-8
from django.contrib import admin

from .models.region import (
    Region,
    RegionAdmin,
)
from .models.assignments import (
        Assignment,
        AssignmentAdmin,
        )

admin.site.register(Region, RegionAdmin)
admin.site.register(Assignment, AssignmentAdmin)
