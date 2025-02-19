from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
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
from kpi.exceptions import RetryAfterAPIException
from kpi.utils.cache import void_cache_for_request
from kpi.utils.object_permission import get_database_user
from kpi.utils.placeholders import replace_placeholders
from .constants import (
    ORG_ADMIN_ROLE,
    ORG_MEMBER_ROLE,
    ORG_EXTERNAL_ROLE,
    INVITE_OWNER_ERROR,
    INVITE_MEMBER_ERROR,
    USER_DOES_NOT_EXIST_ERROR,
    INVITE_ALREADY_ACCEPTED_ERROR,
    INVITE_NOT_FOUND_ERROR,
    INVITE_ALREADY_EXISTS_ERROR,
    INVITEE_ALREADY_MEMBER_ERROR
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
        try:
            invites_per_member = self.context['invites_per_member']
        except KeyError:
            invite = OrganizationInvitation.objects.filter(
                organization=obj.organization,
                invitee=obj.user
            ).order_by('-created').first()
        else:
            invite = invites_per_member.get(obj.user_id)

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
            validated_data['is_admin'] = role == ORG_ADMIN_ROLE
        return super().update(instance, validated_data)

    def validate_role(self, role):
        if role not in [ORG_ADMIN_ROLE, ORG_MEMBER_ROLE]:
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
    organization_name = serializers.ReadOnlyField(source='organization.name')
    role = serializers.ChoiceField(
        choices=[ORG_ADMIN_ROLE, ORG_MEMBER_ROLE],
        default=ORG_MEMBER_ROLE,
        write_only=True,
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
            'organization_name',
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
        valid_emails = invitees['emails']

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
        for email in valid_emails:
            invite = OrganizationInvitation.objects.create(
                invited_by=invited_by,
                invitee_identifier=email,
                invitee_role=role,
                organization=invited_by.organization,
            )
            invites.append(invite)
            invite.send_invite_email()

        return invites

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
        valid_users, valid_emails = [], []
        organization = self.context['request'].user.organization
        for invitee in value:
            is_email = self._is_valid_email(invitee)

            # Check if the invitee is already invited and has not responded yet
            search_filter = (
                {'invitee_identifier': invitee}
                if is_email
                else {'invitee__username': invitee}
            )
            self._check_existing_invites(organization, search_filter, invitee)

            if is_email:
                # Allow multiple invitations for shared email or external users
                valid_emails.append(invitee)
            else:
                user = self._get_valid_user(invitee)
                self._check_existing_member(organization, user, invitee)
                valid_users.append(user)
        return {'users': valid_users, 'emails': valid_emails}

    def validate_role(self, value):
        if self.instance:
            request = self.context['request']
            user = get_database_user(request.user)
            organization = self.instance.invited_by.organization

            if not organization.is_admin(user):
                raise serializers.ValidationError(
                    'You have not enough permissions to perform this action'
                )

            if self.instance.status == InviteStatusChoices.ACCEPTED:
                raise serializers.ValidationError(
                    'Role cannot be changed after acceptance'
                )
        return value

    def validate_status(self, value):

        if value in OrganizationInviteStatusChoices.get_calculated_choices():
            raise serializers.ValidationError(
                f'`{value}` is reserved and cannot be set'
            )

        if not self.instance:
            if (
                value in OrganizationInviteStatusChoices.get_admin_choices()
                or value in OrganizationInviteStatusChoices.get_member_choices()
            ):
                raise serializers.ValidationError(
                    f'`{value}` cannot be set a newly created invitation'
                )

        else:
            request = self.context['request']
            user = get_database_user(request.user)
            organization = self.instance.invited_by.organization

            if (
                value in OrganizationInviteStatusChoices.get_admin_choices()
                and not organization.is_admin(user)
            ):
                raise serializers.ValidationError(
                    'You have not enough permissions to perform this action'
                )

            # if value equals 'resent', all the validations have been already
            # performed to ensure, only an admin can call this.
            if value == OrganizationInviteStatusChoices.RESENT:
                if self.instance.status != OrganizationInviteStatusChoices.PENDING:
                    raise serializers.ValidationError(
                        'Invitation cannot be resent'
                    )

                retry_after = self.instance.modified + timedelta(
                    seconds=settings.ORG_INVITATION_RESENT_RESET_AFTER
                )
                now = timezone.now()
                if retry_after > now:
                    remaining_delta = retry_after - now
                    remaining_seconds = int(remaining_delta.total_seconds())
                    raise RetryAfterAPIException(
                        f'Invitation was resent too quickly, '
                        f'wait for {remaining_seconds} seconds before retrying',
                        retry_after=remaining_seconds,
                    )

        return value

    def update(self, instance, validated_data):

        transfer_data = False

        with transaction.atomic():
            if 'role' in validated_data:
                # Organization owner or admin can update the role of the invitee
                instance.invitee_role = validated_data['role']
                instance.save(update_fields=['invitee_role'])

            if 'status' in validated_data:
                status = validated_data.get('status')
                if status == OrganizationInviteStatusChoices.ACCEPTED:
                    self._handle_invitee_assignment(instance)
                    self.validate_invitation_acceptance(instance)
                    self._update_invitee_organization(instance)
                    transfer_data = True

                self._handle_status_update(instance, status)

        if transfer_data:
            # Transfer ownership of invitee's assets to the organization
            transaction.on_commit(
                lambda: transfer_member_data_ownership_to_org.delay(
                    instance.invitee.id
                )
            )

        return instance

    def _check_existing_member(self, organization, user, invitee):
        """
        Raise an error if the user is already a member of the organization
        """
        if OrganizationUser.objects.filter(
            organization=organization, user=user
        ).exists():
            raise serializers.ValidationError(
                replace_placeholders(
                    t(INVITEE_ALREADY_MEMBER_ERROR), invitee=invitee
                )
            )

    def _check_existing_invites(self, organization, search_filter, invitee):
        """
        Raise an error if an active invitation already exists
        """
        if OrganizationInvitation.objects.filter(
            **search_filter,
            organization=organization,
            status=OrganizationInviteStatusChoices.PENDING
        ).exists():
            raise serializers.ValidationError(
                replace_placeholders(
                    t(INVITE_ALREADY_EXISTS_ERROR), invitee=invitee
                )
            )

    def _get_valid_user(self, username):
        """
        Fetch a valid user by username, ensuring they exist and are active
        """
        user = User.objects.filter(username=username, is_active=True).first()
        if not user:
            raise serializers.ValidationError(
                replace_placeholders(
                    t(USER_DOES_NOT_EXIST_ERROR), invitee=username
                )
            )
        return user

    def _handle_invitee_assignment(self, instance):
        """
        Assigns the invitee to the invite after the external user registers
        and accepts the invite
        """
        invitee_identifier = instance.invitee_identifier
        if invitee_identifier and not instance.invitee:
            try:
                instance.invitee = self.context['request'].user
                instance.save(update_fields=['invitee'])
            except User.DoesNotExist:
                raise NotFound({'detail': t(INVITE_NOT_FOUND_ERROR)})

    def _handle_status_update(self, instance, status):
        if status == OrganizationInviteStatusChoices.RESENT:
            instance.status = OrganizationInviteStatusChoices.PENDING
        else:
            instance.status = OrganizationInviteStatusChoices[status.upper()]
        instance.save(update_fields=['status', 'modified'])
        self._send_status_email(instance, status)

    def _is_valid_email(self, invitee):
        """
        Check if invitee is a valid email
        """
        try:
            validate_email(invitee)
            return True
        except ValidationError:
            return False

    def _send_status_email(self, instance, status):
        status_map = {
            OrganizationInviteStatusChoices.ACCEPTED:
                instance.send_acceptance_email,
            OrganizationInviteStatusChoices.DECLINED:
                instance.send_refusal_email,
            OrganizationInviteStatusChoices.RESENT:
                instance.send_invite_email,
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
        org_user.is_admin = instance.invitee_role == ORG_ADMIN_ROLE
        org_user.save()
