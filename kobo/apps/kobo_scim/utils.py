from constance import config
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import status
from rest_framework.exceptions import ValidationError as DRFValidationError

from hub.models.extra_user_detail import ExtraUserDetail
from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.kobo_scim.exceptions import ScimException
from kobo.apps.openrosa.apps.main.models import UserProfile


def apply_scim_user_metadata(user, scim_data, enforce_strict_validation=False):
    """
    Applies custom IdP metadata from the SCIM payload to the Kobo user profile.
    It reads `constance.config.USER_METADATA_FIELDS` for mapping definitions.
    """
    metadata_fields = getattr(config, 'USER_METADATA_FIELDS', None)

    if not isinstance(metadata_fields, list):
        return False

    # Fields that map directly to UserProfile model attributes
    user_profile_fields = {
        'name',
        'city',
        'country',
        'organization',
        'twitter',
        'address',
    }

    extra_details_updated = False
    profile_updates = {}
    profile_field_to_metadata_key = {}
    matched_any = False

    extra_user_detail = None
    metadata = {}
    original_metadata = {}
    profile = None

    for field_def in metadata_fields:
        field_name = field_def.get('name')
        scim_mapping = field_def.get('scim_mapping')

        if not field_name or not scim_mapping:
            continue

        # First check if exact scim_mapping string is a key in scim_data
        # (useful for flat patch operations)
        if scim_mapping in scim_data:
            value = scim_data[scim_mapping]
        else:
            value = None
            # Try to match a top-level key first (like an extension URN)
            matched_key = None
            if isinstance(scim_data, dict):
                for key in scim_data.keys():
                    if (
                        scim_mapping == key
                        or scim_mapping.startswith(f'{key}.')
                        or scim_mapping.startswith(f'{key}:')
                    ):
                        # Ensure we match the longest prefix to avoid partial matches
                        if matched_key is None or len(key) > len(matched_key):
                            matched_key = key

            if matched_key:
                remainder = scim_mapping[len(matched_key):]
                if remainder.startswith('.') or remainder.startswith(':'):
                    remainder = remainder[1:]

                value = scim_data[matched_key]
                if remainder:
                    keys = remainder.replace(':', '.').split('.')
                    for k in keys:
                        if isinstance(value, dict):
                            value = value.get(k)
                        else:
                            value = None
                            break
            else:
                # Fallback to simple dot splitting if no top-level key matched
                keys = scim_mapping.split('.')
                value = scim_data
                for key in keys:
                    if isinstance(value, dict):
                        value = value.get(key)
                    else:
                        value = None
                        break

        if value is None:
            continue

        matched_any = True

        if extra_user_detail is None:
            extra_user_detail, _ = ExtraUserDetail.objects.get_or_create(user=user)
            metadata = extra_user_detail.data or {}
            # Snapshot original metadata to safely recover previously valid fields
            original_metadata = dict(metadata)

        if profile is None:
            profile, _ = UserProfile.objects.get_or_create(user=user)

        # Apply value mapping if defined
        value_mapping = field_def.get('scim_value_mapping')
        if isinstance(value_mapping, dict) and str(value) in value_mapping:
            value = value_mapping[str(value)]

        # Determine where to save the field in UserProfile
        if field_name == 'bio':
            profile.description = value
            profile_updates['description'] = value
            profile_field_to_metadata_key['description'] = field_name
        elif field_name == 'organization_website':
            profile.home_page = value
            profile_updates['home_page'] = value
            profile_field_to_metadata_key['home_page'] = field_name
        elif field_name == 'phone_number':
            profile.phonenumber = value
            profile_updates['phonenumber'] = value
            profile_field_to_metadata_key['phonenumber'] = field_name
        elif field_name in user_profile_fields:
            setattr(profile, field_name, value)
            profile_updates[field_name] = value
            profile_field_to_metadata_key[field_name] = field_name

        # Always save to ExtraUserDetail.data for a complete metadata source
        metadata[field_name] = value
        extra_details_updated = True

    if extra_details_updated or profile_updates:
        with transaction.atomic():
            if profile_updates:
                try:
                    profile.full_clean()
                    profile.save(update_fields=list(profile_updates.keys()))
                except DjangoValidationError as e:
                    if enforce_strict_validation:
                        raise DRFValidationError(e.message_dict)
                    else:
                        # Gracefully discard invalid fields and save the rest
                        profile.refresh_from_db()
                        valid_fields = []
                        for field, val in profile_updates.items():
                            if field not in e.error_dict:
                                setattr(profile, field, val)
                                valid_fields.append(field)
                            else:
                                metadata_key = profile_field_to_metadata_key.get(field)
                                if metadata_key and metadata_key in metadata:
                                    if metadata_key in original_metadata:
                                        metadata[metadata_key] = original_metadata[
                                            metadata_key
                                        ]
                                    else:
                                        del metadata[metadata_key]

                        if valid_fields:
                            profile.save(update_fields=valid_fields)

            if extra_details_updated:
                extra_user_detail.data = metadata
                extra_user_detail.save(update_fields=['data'])

    return matched_any


def generate_unique_scim_username(base_username, idp_slug):
    """
    Generates a unique username for SCIM provisioning.
    If the base_username is taken by another user, it appends the IdP slug.
    If that is also taken, it appends an incremental number.
    """
    prefix = base_username.split('@')[0]

    # Attempt 1: Base username
    if not User.objects.filter(username__iexact=base_username).exists():
        return base_username

    # Attempt 2: {prefix}_{idp_slug}
    base_with_suffix = f'{prefix}_{idp_slug}'
    if not User.objects.filter(username__iexact=base_with_suffix).exists():
        return base_with_suffix

    # Attempt 3+: {prefix}_{idp_slug}_{counter}
    max_attempts = 1000
    counter = 1
    while counter <= max_attempts:
        username = f'{base_with_suffix}_{counter}'
        if not User.objects.filter(username__iexact=username).exists():
            return username
        counter += 1
    raise ScimException(
        detail=(
            f'Could not generate a unique username for {base_username!r} after '
            f'{max_attempts} attempts.'
        ),
        status_code=status.HTTP_409_CONFLICT,
        error_code='unique_username_failed',
        reason=(
            'SCIM provisioning aborted because a unique username '
            'could not be generated'
        ),
    )


def get_scim_extension_schemas():
    """
    Parses constance.config.USER_METADATA_FIELDS and dynamically builds
    SCIM extension schemas for the API to advertise.
    """
    metadata_fields = getattr(config, 'USER_METADATA_FIELDS', None)
    if not isinstance(metadata_fields, list):
        return []

    schemas = {}
    for field in metadata_fields:
        scim_mapping = field.get('scim_mapping')
        if not scim_mapping:
            continue

        if '.' in scim_mapping:
            urn, attr_name = scim_mapping.rsplit('.', 1)
        elif ':' in scim_mapping:
            urn, attr_name = scim_mapping.rsplit(':', 1)
        else:
            continue

        if urn not in schemas:
            urn_name = urn.rsplit(':', 1)[-1] if ':' in urn else 'User'
            schemas[urn] = {
                'schemas': ['urn:ietf:params:scim:schemas:core:2.0:Schema'],
                'id': urn,
                'name': f'{urn_name} Extension',
                'description': f'Custom {urn_name} attributes mapped from Kobo USER_METADATA_FIELDS',  # noqa E501
                'attributes': [],
            }

        schemas[urn]['attributes'].append(
            {
                'name': attr_name,
                'type': 'string',
                'description': field.get('name', ''),
                'multiValued': False,
                'required': bool(field.get('required', False)),
                'caseExact': False,
                'mutability': 'readWrite',
                'returned': 'default',
                'uniqueness': 'none',
            }
        )

    return list(schemas.values())
