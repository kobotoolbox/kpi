import requests
from collections import OrderedDict
from django.conf import settings
from django.http import HttpResponse
from django.core.exceptions import PermissionDenied
from django.contrib import messages
from django.contrib.admin import helpers
from django.contrib.admin.utils import get_deleted_objects, model_ngettext
from django.contrib.admin.utils import NestedObjects
from django.db import router, transaction
from django.template.response import TemplateResponse
from django.utils.encoding import force_text
from django.utils.translation import ugettext_lazy, ugettext as _

from kpi.deployment_backends.kc_access.shadow_models import ShadowModel


def delete_related_objects(modeladmin, request, queryset):
    """
    Action that deletes related objects for the selected items.

    This action first displays a confirmation page whichs shows all the
    deleteable objects, or, if the user has no permission one of the related
    childs (foreignkeys), a "permission denied" message.

    Next, it deletes all related objects and redirects back to the change list.

    The code is mostly copied from django/contrib/admin/actions.py
    """
    opts = modeladmin.model._meta
    app_label = opts.app_label

    # Check that the user has delete permission for the actual model
    if not modeladmin.has_delete_permission(request):
        raise PermissionDenied

    using = router.db_for_write(modeladmin.model)

    first_level_related_objects = []
    collector = NestedObjects(using=using)
    collector.collect(queryset)
    for base_object_or_related_list in collector.nested():
        if type(base_object_or_related_list) is not list:
            # If it's not a list, it's a base object. Skip it.
            continue
        for obj in base_object_or_related_list:
            if type(obj) is list:
                # A list here contains related objects for the previous
                # element. We can skip it since delete() on the first
                # level of related objects will cascade.
                continue
            elif not isinstance(obj, ShadowModel):
                first_level_related_objects.append(obj)

    # Populate deletable_objects, a data structure of (string representations
    # of) all related objects that will also be deleted.
    deletable_objects, model_count, perms_needed, protected = get_deleted_objects(
        first_level_related_objects, opts, request.user,
        modeladmin.admin_site, using
    )

    # The user has already confirmed the deletion.
    # Do the deletion and return a None to display the change list view again.
    if request.POST.get('post'):
        if perms_needed:
            raise PermissionDenied
        n = 0
        with transaction.atomic(using):
            for obj in first_level_related_objects:
                obj_display = force_text(obj)
                modeladmin.log_deletion(request, obj, obj_display)
                obj.delete()
                n += 1
        modeladmin.message_user(
            request,
            _("Successfully deleted %(count)d related objects.") % {
                "count": n, "items": model_ngettext(modeladmin.opts, n)},
            messages.SUCCESS
        )
        # Return None to display the change list page again.
        return None

    if len(queryset) == 1:
        objects_name = force_text(opts.verbose_name)
    else:
        objects_name = force_text(opts.verbose_name_plural)

    if perms_needed or protected:
        title = _("Cannot delete %(name)s") % {"name": objects_name}
    else:
        title = _("Are you sure?")

    context = dict(
        modeladmin.admin_site.each_context(request),
        title=title,
        objects_name=objects_name,
        deletable_objects=[deletable_objects],
        model_count=dict(model_count).items(),
        queryset=queryset,
        perms_lacking=perms_needed,
        protected=protected,
        opts=opts,
        action_checkbox_name=helpers.ACTION_CHECKBOX_NAME,
    )

    request.current_app = modeladmin.admin_site.name

    # Display the confirmation page
    return TemplateResponse(
        request, "delete_related_for_selected_confirmation.html",
        context, current_app=modeladmin.admin_site.name)

delete_related_objects.short_description = ugettext_lazy(
    "Remove related objects for these %(verbose_name_plural)s "
    "(deletion step 1)")


def remove_from_kobocat(modeladmin, kpi_request, queryset):
    '''
    This is a hack to try and make administrators' lives less miserable when
    they need to delete users. It proxies the initial delete request to KoBoCAT
    and returns the confirmation response, mangling the HTML form action so
    that clicking "Yes, I'm sure" POSTs to KoBoCAT instead of KPI.
    '''
    if not kpi_request.user.is_superuser:
        raise PermissionDenied
    if kpi_request.method != 'POST':
        raise NotImplementedError
    post_data = dict(kpi_request.POST)
    post_data['action'] = 'delete_selected'
    kc_url = settings.KOBOCAT_URL + kpi_request.path
    kc_response = requests.post(kc_url, data=post_data,
                                cookies=kpi_request.COOKIES)
    our_response = HttpResponse()
    our_response.status_code = kc_response.status_code
    # I'm sorry. If something is going to break, it's probably this.
    find_text = '<form action="" '
    replace_text = '<form action="{kc_url}" ' \
                   'onsubmit="return confirm(\'{hint}\');" '
    hint = 'Confusion ahead! You will now be taken to the KoBoCAT admin ' \
           'interface. If you want to come back here, to the KPI admin ' \
           'interface, you must do so manually.'
    replace_text = replace_text.format(kc_url=kc_url, hint=hint)
    awful_content = kc_response.content.replace(find_text, replace_text)
    our_response.write(awful_content)
    return our_response

remove_from_kobocat.short_description = ugettext_lazy(
    "Remove these %(verbose_name_plural)s from KoBoCAT (deletion step 2)")
