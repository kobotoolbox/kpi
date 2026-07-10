from __future__ import annotations

from constance import config
from django.contrib import admin
from django.utils import timezone

from kobo.apps.markdownx_uploader.admin import MarkdownxModelAdminBase
from ..models import SitewideMessage


class SitewideMessageAdmin(MarkdownxModelAdminBase):

    model = SitewideMessage
    actions = ['require_terms_of_service_reacceptance']

    def changelist_view(self, request, extra_context=None):
        actions = self.get_actions(request)
        # cheating: since the require_terms_of_service_reacceptance doesn't apply to
        # individual SitewideMessages, always act as if all of them have been selected
        # to avoid 'Items must be selected in order to perform actions on them.' error
        if (
            actions
            and request.method == 'POST'
            and 'index' in request.POST
            and request.POST['action'] == 'require_terms_of_service_reacceptance'
        ):
            data = request.POST.copy()
            data['select_across'] = '1'
            request.POST = data
            response = self.response_action(
                request, queryset=self.get_queryset(request)
            )
            if response:
                return response
        return super().changelist_view(request, extra_context)

    @admin.action(description='Require all users to reaccept the Terms of Service')
    def require_terms_of_service_reacceptance(self, request, *args, **kwargs):
        tos_exists = SitewideMessage.objects.filter(slug='terms_of_service').exists()
        if tos_exists:
            setattr(
                config, 'LAST_TOS_UPDATE', timezone.now().strftime('%Y-%m-%dT%H:%M:%SZ')
            )
            self.message_user(
                request, 'All users will be prompted to re-accept the Terms of Service'
            )
        else:
            self.message_user(
                request,
                'Add a SitewideMessage with the slug terms_of_service'
                ' before requiring reacceptance',
            )
