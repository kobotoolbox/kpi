from constance import config
from django.db import transaction

from hub.models.extra_user_detail import ExtraUserDetail
from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.main.models import UserProfile


def apply_scim_user_metadata(user, scim_data):
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
    updated_profile_fields = set()
    matched_any = False

    extra_user_detail = None
    metadata = {}
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
                remainder = scim_mapping[len(matched_key) :]
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

        if profile is None:
            profile, _ = UserProfile.objects.get_or_create(user=user)

        # Apply value mapping if defined
        value_mapping = field_def.get('scim_value_mapping')
        if isinstance(value_mapping, dict) and str(value) in value_mapping:
            value = value_mapping[str(value)]

        # Determine where to save the field in UserProfile
        if field_name == 'bio':
            profile.description = value
            updated_profile_fields.add('description')
        elif field_name == 'organization_website':
            profile.home_page = value
            updated_profile_fields.add('home_page')
        elif field_name == 'phone_number':
            profile.phonenumber = value
            updated_profile_fields.add('phonenumber')
        elif field_name in user_profile_fields:
            setattr(profile, field_name, value)
            updated_profile_fields.add(field_name)

        # Always save to ExtraUserDetail.data for a complete metadata source
        metadata[field_name] = value
        extra_details_updated = True

    if extra_details_updated or updated_profile_fields:
        with transaction.atomic():
            if extra_details_updated:
                extra_user_detail.data = metadata
                extra_user_detail.save(update_fields=['data'])

            if updated_profile_fields:
                profile.save(update_fields=list(updated_profile_fields))

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
    counter = 1
    while True:
        username = f'{base_with_suffix}_{counter}'
        if not User.objects.filter(username__iexact=username).exists():
            return username
        counter += 1


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
            schemas[urn] = {
                'schemas': ['urn:ietf:params:scim:schemas:core:2.0:Schema'],
                'id': urn,
                'name': 'User Extension',
                'description': 'Custom user attributes mapped from Kobo USER_METADATA_FIELDS',
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
