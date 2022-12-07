# coding: utf-8
from django.contrib import admin

from .models.assignment import (
   Assignment,
   AssignmentAdmin,
)
from .models.custom_project import (
    CustomProject,
    CustomProjectAdmin,
)

admin.site.register(CustomProject, CustomProjectAdmin)
admin.site.register(Assignment, AssignmentAdmin)
