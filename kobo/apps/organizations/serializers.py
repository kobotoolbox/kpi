from django.contrib.auth import get_user_model
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from django.utils.translation import gettext as t
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied, NotFound
from rest_framework.relations import HyperlinkedIdentityField
from rest_framework.reverse import reverse

from kobo.apps.organizations.models import (
    create_organization,
    Organization,
    OrganizationOwner,
    OrganizationUser,
    OrganizationInvitation,
    OrganizationInviteStatusChoices,
)
from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.project_ownership.models import InviteStatusChoices
from kpi.utils.cache import void_cache_for_request
from kpi.utils.object_permission import get_database_user
from kpi.utils.placeholders import replace_placeholders

from .constants import (
    ORG_EXTERNAL_ROLE,
    INVITE_OWNER_ERROR,
    INVITE_MEMBER_ERROR,
    USER_DOES_NOT_EXIST_ERROR,
    INVITE_ALREADY_ACCEPTED_ERROR,
    INVITE_NOT_FOUND_ERROR
)
from .tasks import transfer_member_data_ownership_to_org


class OrganizationUserSerializer(serializers.ModelSerializer):
    invite = serializers.SerializerMethodField()
    user = serializers.HyperlinkedRelatedField(
        queryset=get_user_model().objects.all(),
        lookup_field='username',
        view_name='user-kpi-detail',
    )
    role = serializers.CharField()
    user__has_mfa_enabled = serializers.BooleanField(
        source='has_mfa_enabled', read_only=True
    )
    url = serializers.SerializerMethodField()
    date_joined = serializers.DateTimeField(
        source='created', format='%Y-%m-%dT%H:%M:%SZ'
    )
    user__username = serializers.ReadOnlyField(source='user.username')
    user__extra_details__name = serializers.ReadOnlyField(
        source='user.extra_details.data.name'
    )
    user__email = serializers.ReadOnlyField(source='user.email')
    user__is_active = serializers.ReadOnlyField(source='user.is_active')

    class Meta:
        model = OrganizationUser
        fields = [
            'url',
            'user',
            'user__username',
            'user__email',
            'user__extra_details__name',
            'role',
            'user__has_mfa_enabled',
            'date_joined',
            'user__is_active',
            'invite'
        ]

    def get_url(self, obj):
        request = self.context.get('request')
        return reverse(
            'organization-members-detail',
            kwargs={
                'organization_id': obj.organization.id,
                'user__username': obj.user.username
            },
            request=request
        )

    def get_invite(self, obj):
        """
        Get the latest invite for the user if it exists
        """
        invite = OrganizationInvitation.objects.filter(
            invitee=obj.user
        ).order_by('-created').first()

        if invite:
            return OrgMembershipInviteSerializer(
                invite, context=self.context
            ).data
        return {}

    def to_representation(self, instance):
        """
        Handle representation of invite objects.

        For users who have been invited to an organization but have not yet
        registered, we include the invite object and show user object data as null.
        """
        if isinstance(instance, OrganizationInvitation):
            invite_serializer = OrgMembershipInviteSerializer(
                instance, context=self.context
            )
            response = {field: None for field in self.Meta.fields}
            response.update({
                'invite': invite_serializer.data,
            })
            return response
        else:
            representation = super().to_representation(instance)
            return representation

    def update(self, instance, validated_data):
        if role := validated_data.get('role', None):
            validated_data['is_admin'] = role == 'admin'
        return super().update(instance, validated_data)

    def validate_role(self, role):
        if role not in ['admin', 'member']:
            raise serializers.ValidationError(
                {'role': t("Invalid role. Only 'admin' or 'member' are allowed")}
            )
        return role


class OrganizationOwnerSerializer(serializers.ModelSerializer):
    organization_user = OrganizationUserSerializer()

    class Meta:
        model = OrganizationOwner
        fields = ['organization_user']


class OrganizationSerializer(serializers.ModelSerializer):

    assets = serializers.SerializerMethodField()
    asset_usage = serializers.SerializerMethodField()
    is_mmo = serializers.BooleanField(read_only=True)
    is_owner = serializers.SerializerMethodField()
    members = serializers.SerializerMethodField()
    request_user_role = serializers.SerializerMethodField()
    service_usage = serializers.SerializerMethodField()
    url = HyperlinkedIdentityField(lookup_field='id', view_name='organizations-detail')
    website = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Organization
        fields = [
            'id',
            'url',
            'name',
            'website',
            'organization_type',
            'created',
            'modified',
            'is_owner',
            'is_mmo',
            'request_user_role',
            'members',
            'assets',
            'service_usage',
            'asset_usage',
        ]
        read_only_fields = ['id']

    def create(self, validated_data):
        user = self.context['request'].user
        return create_organization(user, validated_data['name'])

    def get_assets(self, organization: Organization) -> str:
        return reverse(
            'organizations-assets',
            kwargs={'id': organization.id},
            request=self.context['request'],
        )

    def get_asset_usage(self, organization: Organization) -> str:
        return reverse(
            'organizations-asset-usage',
            kwargs={'id': organization.id},
            request=self.context['request'],
        )

    def get_members(self, organization: Organization) -> str:
        return reverse(
            'organization-members-list',
            kwargs={'organization_id': organization.id},
            request=self.context['request'],
        )

    def get_service_usage(self, organization: Organization) -> str:
        return reverse(
            'organizations-service-usage',
            kwargs={'id': organization.id},
            request=self.context['request'],
        )

    def get_is_owner(self, organization):

        # This method is deprecated.
        # Use `get_request_user_role` to retrieve the value instead.
        if request := self.context.get('request'):
            user = get_database_user(request.user)
            return organization.is_owner(user)

        return False

    def get_request_user_role(self, organization):

        if request := self.context.get('request'):
            user = get_database_user(request.user)
            return organization.get_user_role(user)

        return ORG_EXTERNAL_ROLE


class OrgMembershipInviteSerializer(serializers.ModelSerializer):
    created = serializers.DateTimeField(
        format='%Y-%m-%dT%H:%M:%SZ', read_only=True
    )
    modified = serializers.DateTimeField(
        format='%Y-%m-%dT%H:%M:%SZ', read_only=True
    )
    invitees = serializers.ListField(
        child=serializers.CharField(),
        write_only=True,
        required=True
    )
    invited_by = serializers.SerializerMethodField()
    role = serializers.ChoiceField(
        choices=['admin', 'member'], default='member', write_only=True
    )
    url = serializers.SerializerMethodField()

    class Meta:
        model = OrganizationInvitation
        fields = [
            'url',
            'invited_by',
            'invitees',
            'status',
            'role',
            'invitee_role',
            'created',
            'modified'
        ]

    def create(self, validated_data):
        """
        Create multiple invitations for the provided invitees.

        The `validated_data` is pre-processed by the `validate_invitees()`
        method, which separates invitees into two groups:
        - `users`: Registered and active users retrieved by email or username.
        - `emails`: External email addresses for non-registered invitees.

        Args:
            validated_data (dict): Data validated and pre-processed by the
            serializer.

        Returns:
            list: A list of created `OrganizationInvitation` instances.
        """
        invited_by = self.context['request'].user
        invitees = validated_data['invitees']
        role = validated_data['role']
        valid_users = invitees['users']
        external_emails = invitees['emails']

        invites = []

        # Create invites for existing users
        for user in valid_users:
            invite = OrganizationInvitation.objects.create(
                invited_by=invited_by,
                invitee=user,
                invitee_role=role,
                organization=invited_by.organization,
            )
            invites.append(invite)
            invite.send_invite_email()

        # Create invites for external emails
        for email in external_emails:
            invite = OrganizationInvitation.objects.create(
                invited_by=invited_by,
                invitee_identifier=email,
                invitee_role=role,
                organization=invited_by.organization,
            )
            invites.append(invite)
            invite.send_invite_email()

        return invites

    def update(self, instance, validated_data):
        status = validated_data.get('status')
        if status == 'accepted':
            self._handle_invitee_assignment(instance)
            self.validate_invitation_acceptance(instance)
            self._update_invitee_organization(instance)

            # Transfer ownership of invitee's assets to the organization
            transfer_member_data_ownership_to_org(instance.invitee.id)
        self._handle_status_update(instance, status)
        return instance

    def _handle_invitee_assignment(self, instance):
        """
        Assigns the invitee to the invite after the external user registers
        and accepts the invite
        """
        invitee_identifier = instance.invitee_identifier
        if invitee_identifier and not instance.invitee:
            try:
                instance.invitee = User.objects.get(email=invitee_identifier)
                instance.save(update_fields=['invitee'])
            except User.DoesNotExist:
                raise NotFound({'detail': t(INVITE_NOT_FOUND_ERROR)})

    def _handle_status_update(self, instance, status):
        instance.status = getattr(
            OrganizationInviteStatusChoices, status.upper()
        )
        instance.save(update_fields=['status'])
        self._send_status_email(instance, status)

    def _send_status_email(self, instance, status):
        status_map = {
            'accepted': instance.send_acceptance_email,
            'declined': instance.send_refusal_email,
            'resent': instance.send_invite_email
        }

        email_func = status_map.get(status)
        if email_func:
            email_func()

    @void_cache_for_request(keys=('organization',))
    def _update_invitee_organization(self, instance):
        """
        Update the organization of the invitee after accepting the invitation
        """
        org_user = OrganizationUser.objects.get(user=instance.invitee)
        Organization.objects.filter(organization_users=org_user).delete()
        org_user.organization = instance.invited_by.organization
        org_user.is_admin = instance.invitee_role == 'admin'
        org_user.save()

    def get_invited_by(self, invite):
        return reverse(
            'user-kpi-detail',
            args=[invite.invited_by.username],
            request=self.context['request']
        )

    def get_url(self, obj):
        """
        Return the detail URL for the invite
        """
        return reverse(
            'organization-invites-detail',
            kwargs={
                'organization_id': obj.invited_by.organization.id,
                'guid': obj.guid
            },
            request=self.context.get('request')
        )

    def to_representation(self, instance):
        """
        Handle representation of invite objects. Include `invitee` field
        in the response
        """
        representation = super().to_representation(instance)
        if instance.invitee:
            representation['invitee'] = instance.invitee.username
        elif instance.invitee_identifier:
            representation['invitee'] = instance.invitee_identifier
        else:
            representation['invitee'] = None
        return representation

    def validate_invitation_acceptance(self, instance):
        """
        Validate the acceptance of an invitation
        """
        request_user = self.context['request'].user

        # Check if the invitation has already been accepted
        if instance.status == InviteStatusChoices.ACCEPTED:
            raise PermissionDenied(
                {
                    'detail': t(INVITE_ALREADY_ACCEPTED_ERROR)
                }
            )

        # Validate email or username
        is_email_match = request_user.email == instance.invitee_identifier
        is_username_match = (
            instance.invitee and
            request_user.username == instance.invitee.username
        )
        if not (is_email_match or is_username_match):
            raise NotFound({'detail': t(INVITE_NOT_FOUND_ERROR)})

        # Check if the invitee is already a member of the organization
        if instance.invitee.organization.is_mmo:
            if instance.invitee.organization.is_owner(request_user):
                raise PermissionDenied(
                    {
                        'detail': replace_placeholders(
                            t(INVITE_OWNER_ERROR),
                            organization_name=instance.invitee.organization.name
                        )
                    }
                )
            else:
                raise PermissionDenied(
                    {
                        'detail': replace_placeholders(
                            t(INVITE_MEMBER_ERROR),
                            organization_name=instance.invitee.organization.name
                        )
                    }
                )

    def validate_invitees(self, value):
        """
        Check if usernames exist in the database, and emails are valid.
        """
        valid_users, external_emails = [], []
        for idx, invitee in enumerate(value):
            try:
                validate_email(invitee)
                users = User.objects.filter(email=invitee)
                if users:
                    user = users.filter(is_active=True).first()
                    if user:
                        valid_users.append(user)
                    else:
                        raise serializers.ValidationError(
                            USER_DOES_NOT_EXIST_ERROR.format(invitee=invitee)
                        )
                else:
                    external_emails.append(invitee)
            except ValidationError:
                user = User.objects.filter(
                    username=invitee, is_active=True
                ).first()
                if user:
                    valid_users.append(user)
                else:
                    raise serializers.ValidationError(
                        USER_DOES_NOT_EXIST_ERROR.format(invitee=invitee)
                    )
        return {'users': valid_users, 'emails': external_emails}
