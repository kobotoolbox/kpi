from constance import config

from hub.models.extra_user_detail import ExtraUserDetail
from kobo.apps.openrosa.apps.main.models import UserProfile


def apply_scim_user_metadata(user, scim_data):
    """
    Applies custom IdP metadata from the SCIM payload to the Kobo user profile.
    It reads `constance.config.USER_METADATA_FIELDS` for mapping definitions.
    """
    metadata_fields = getattr(config, 'USER_METADATA_FIELDS', None)

    if not isinstance(metadata_fields, list):
        return

    # Fields that map directly to UserProfile model attributes
    user_profile_fields = {
        'name', 'city', 'country', 'organization', 'twitter', 'address'
    }

    extra_details_updated = False
    profile_updated = False

    extra_user_detail, _ = ExtraUserDetail.objects.get_or_create(user=user)
    metadata = extra_user_detail.data or {}

    profile, _ = UserProfile.objects.get_or_create(user=user)

    for field_def in metadata_fields:
        field_name = field_def.get('name')
        scim_mapping = field_def.get('scim_mapping')

        if not field_name or not scim_mapping:
            continue

        # First check if exact scim_mapping string is a key in scim_data (useful for flat patch operations)
        if scim_mapping in scim_data:
            value = scim_data[scim_mapping]
        else:
            value = None
            # Try to match a top-level key first (like an extension URN)
            matched_key = None
            if isinstance(scim_data, dict):
                for key in scim_data.keys():
                    if scim_mapping.startswith(key):
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

        # Apply value mapping if defined
        value_mapping = field_def.get('scim_value_mapping')
        if isinstance(value_mapping, dict) and str(value) in value_mapping:
            value = value_mapping[str(value)]

        # Determine where to save the field in UserProfile
        if field_name == 'bio':
            profile.description = value
            profile_updated = True
        elif field_name == 'organization_website':
            profile.home_page = value
            profile_updated = True
        elif field_name == 'phone_number':
            profile.phonenumber = value
            profile_updated = True
        elif field_name in user_profile_fields:
            setattr(profile, field_name, value)
            profile_updated = True

        # Always save to ExtraUserDetail.data for a complete metadata source
        metadata[field_name] = value
        extra_details_updated = True

    if extra_details_updated:
        extra_user_detail.data = metadata
        extra_user_detail.save(update_fields=['data'])

    if profile_updated:
        profile.save()
