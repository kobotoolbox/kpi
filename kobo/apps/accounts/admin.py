from allauth.account.models import EmailAddress
from allauth.socialaccount.admin import SocialAccountAdmin as BaseSocialAccountAdmin
from allauth.socialaccount.admin import SocialAppAdmin, SocialAppForm
from allauth.socialaccount.models import SocialAccount, SocialApp
from django import forms
from django.contrib import admin
from django.contrib.admin.utils import unquote
from django.core.exceptions import PermissionDenied, ValidationError
from django.db.models import Q
from django.forms.formsets import all_valid
from django.template.response import TemplateResponse
from django.urls import reverse
from django.utils.translation import gettext_lazy as _

from kobo.apps.accounts.models import (
    EmailAddressAdmin,
    EmailContent,
    SocialAppCustomData,
    SocialAppManagedDomain,
)
from kobo.apps.accounts.utils import user_is_managed_by_sso, users_needing_update


@admin.register(EmailContent)
class EmailContentView(admin.ModelAdmin):
    list_display = ('email_name', 'section_name')


admin.site.unregister(EmailAddress)
admin.site.register(EmailAddress, EmailAddressAdmin)


class RequireProviderIdSocialAppForm(SocialAppForm):
    def __init__(self, *args, **kwargs):
        super(SocialAppForm, self).__init__(*args, **kwargs)
        # require the provider_id in the admin, since we can't make it required on allauth's model
        self.fields['provider_id'].required = True

    def clean_provider_id(self):
        reserved_keywords = ['kobo']
        provider_id = self.cleaned_data.get('provider_id')
        """
        Don't allow `kobo` to be set as the `provider_id` value in `SOCIALACCOUNT_PROVIDERS`
        settings because it breaks the login page redirect when language is changed.
        """
        if provider_id in reserved_keywords:
            raise ValidationError(
                f'`{provider_id}` is not a valid value for the `provider_id` setting.'
            )

        """
        By default, django-allauth only supports showing one provider on the login screen.
        But OIDC providers allow multiple subproviders, so kpi has some additional code to display multiple providers.
        Because of that, we need to make sure that the `provider` and `provider_id` fields are unique.
        django-allauth (as of 0.57.0) technically enforces this on the model level, but in practice it's flawed.
        """
        if SocialApp.objects.filter(
            Q(provider_id=provider_id) |
            Q(provider=provider_id)
        ).exclude(pk=self.instance.pk).exists():
            raise ValidationError(
                """The Provider ID value must be unique and cannot match an existing Provider name.
                Please use a different value."""
            )
        return provider_id


class RequireProviderIdSocialAppAdmin(SocialAppAdmin):
    form = RequireProviderIdSocialAppForm

    class Meta:
        proxy = True


class DomainInline(admin.TabularInline):
    model = SocialAppManagedDomain
    extra = 1


@admin.register(SocialAppCustomData)
class SocialAppCustomDataAdmin(admin.ModelAdmin):
    inlines = [DomainInline]

    def _get_affected_accounts_counts(self, social_app, submitted_domains, is_managed):
        """
        Count the accounts `tasks.update_users()` would act on, per track:
        - Track 1: accounts linked to the SocialApp that still have another
          login method (usable password or other social account).
        - Track 2: accounts on a submitted domain that are not linked yet and
          have not been notified already.

        Both tracks come from `users_needing_update()` so the numbers match
        what the task will actually do.
        """
        if not is_managed:
            return 0, 0

        track_1_count = 0
        track_2_count = 0
        for domain in submitted_domains:
            users = users_needing_update(social_app, domain)
            track_1_count += users.filter(managed_account__gt=0).count()
            track_2_count += users.filter(managed_account=0).count()
        return track_1_count, track_2_count

    def changeform_view(self, request, object_id=None, form_url='', extra_context=None):
        if request.method == 'POST' and request.POST.get('_confirmed') != '1':
            add = object_id is None
            to_field = request.POST.get('_to_field', request.GET.get('_to_field'))
            if add:
                if not self.has_add_permission(request):
                    raise PermissionDenied
                obj = None
                initial_managed = False
                initial_domains = set()
            else:
                obj = self.get_object(request, unquote(object_id), to_field)
                if not self.has_change_permission(request, obj):
                    raise PermissionDenied
                if obj is None:
                    return self._get_obj_does_not_exist_redirect(
                        request, self.opts, object_id
                    )
                initial_managed = obj.managed
                initial_domains = set(obj.domains.values_list('domain', flat=True))

            ModelForm = self.get_form(request, obj, change=not add)
            form = ModelForm(request.POST, request.FILES, instance=obj)
            if form.is_valid():
                new_object = form.save(commit=False)
                formsets = []
                for FormSet, inline in self.get_formsets_with_inlines(
                    request, new_object
                ):
                    formsets.append(
                        FormSet(
                            data=request.POST,
                            files=request.FILES,
                            instance=new_object,
                            queryset=inline.get_queryset(request),
                        )
                    )

                if all_valid(formsets):
                    new_managed = form.cleaned_data.get('managed', False)

                    submitted_domains = set()
                    for formset in formsets:
                        if formset.model == SocialAppManagedDomain:
                            for inline_form in formset.forms:
                                if (
                                    inline_form.cleaned_data
                                    and not inline_form.cleaned_data.get(
                                        'DELETE', False
                                    )
                                ):
                                    domain = inline_form.cleaned_data.get('domain')
                                    if domain:
                                        submitted_domains.add(domain.strip().lower())

                    added_domains = submitted_domains - initial_domains
                    removed_domains = initial_domains - submitted_domains
                    managed_toggled_on = not initial_managed and new_managed
                    managed_toggled_off = initial_managed and not new_managed

                    requires_confirmation = (
                        managed_toggled_on
                        or managed_toggled_off
                        or (new_managed and bool(added_domains))
                    )

                    if requires_confirmation:
                        social_app = (
                            new_object.social_app
                            if getattr(new_object, 'social_app', None)
                            else form.cleaned_data.get('social_app')
                        )
                        track_1_count, track_2_count = (
                            self._get_affected_accounts_counts(
                                social_app, submitted_domains, new_managed
                            )
                        )

                        post_data = [
                            (key, value)
                            for key in request.POST
                            if key not in ('csrfmiddlewaretoken', '_confirmed')
                            for value in request.POST.getlist(key)
                        ]

                        if obj and obj.pk:
                            cancel_url = reverse(
                                'admin:accounts_socialappcustomdata_change',
                                args=[obj.pk],
                            )
                        else:
                            cancel_url = reverse(
                                'admin:accounts_socialappcustomdata_changelist'
                            )

                        context = {
                            **self.admin_site.each_context(request),
                            'title': _('Confirm Managed SSO Changes for %s')
                            % social_app.name,
                            'opts': self.opts,
                            'app_label': self.opts.app_label,
                            'original': obj,
                            'object_id': object_id,
                            'social_app': social_app,
                            'track_1_count': track_1_count,
                            'track_2_count': track_2_count,
                            'submitted_domains': sorted(submitted_domains),
                            'added_domains': sorted(added_domains),
                            'removed_domains': sorted(removed_domains),
                            'managed_toggled_on': managed_toggled_on,
                            'managed_toggled_off': managed_toggled_off,
                            'new_managed': new_managed,
                            'post_data': post_data,
                            'cancel_url': cancel_url,
                            'media': self.media,
                        }
                        if extra_context:
                            context.update(extra_context)
                        return TemplateResponse(
                            request,
                            'admin/accounts/socialappcustomdata/confirmation.html',
                            context,
                        )

        return super().changeform_view(
            request, object_id=object_id, form_url=form_url, extra_context=extra_context
        )


class SocialAccountForm(forms.ModelForm):
    class Meta:
        model = SocialAccount
        fields = '__all__'

    def clean_user(self):
        user = self.cleaned_data['user']
        if user_is_managed_by_sso(user):
            raise ValidationError('Cannot add a new SSO account for SSO-managed user')
        return user


class SocialAccountAdmin(BaseSocialAccountAdmin):

    def get_form(self, request, obj=None, **kwargs):
        if obj is None:
            return SocialAccountForm
        return super().get_form(request, obj, **kwargs)

    def get_readonly_fields(self, request, obj=None):
        if obj is not None:
            user = obj.user
            if user_is_managed_by_sso(user):
                return [
                    'provider',
                ]
        return []


admin.site.unregister(SocialApp)
admin.site.unregister(SocialAccount)

admin.site.register(SocialApp, RequireProviderIdSocialAppAdmin)
admin.site.register(SocialAccount, SocialAccountAdmin)
