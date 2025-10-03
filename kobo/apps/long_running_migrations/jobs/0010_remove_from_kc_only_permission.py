from kpi.models.object_permission import ObjectPermission

PERM_FROM_KC_ONLY = 'from_kc_only'


def run():
    """
    Delete all permissions of type "from_kc_only" as it is no longer necessary given
    that the permission system in Kobocat was merged into the KPI permission system.
    """
    objects = ObjectPermission.objects.filter(
        permission__codename=PERM_FROM_KC_ONLY
    )
    print(f'Deleting {objects.count()} ObjectPermission objects')
    objects._raw_delete(using=objects.db)
