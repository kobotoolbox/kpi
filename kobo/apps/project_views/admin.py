# coding: utf-8
from django.contrib import admin

from .models.assignment import (
   Assignment,
   AssignmentAdmin,
)
from .models.project_view import (
    ProjectView,
    ProjectViewAdmin,
)

admin.site.register(ProjectView, ProjectViewAdmin)
admin.site.register(Assignment, AssignmentAdmin)
