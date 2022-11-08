from kpi.deployment_backends.kc_access.shadow_models import (
    ReadOnlyKobocatMonthlyXFormSubmissionCounter,
)


class SuperuserStatsModel(ReadOnlyKobocatMonthlyXFormSubmissionCounter):
    """
    Spoiler: Kludgy!

    The purpose of this model is only to provide an obvious name for
    the superuser section in Django Admin.
    Django needs a model to register an admin model, so it extends a shadow
    model (as a proxy) to avoid creating new migrations.
    It extends `ReadOnlyKobocatMonthlyXFormSubmissionCounter` but it could have
    been anyone of the (shadow) models since we do not add/update/delete objects
    from the admin interface. The HTML template only lists the available reports.
    """
    class Meta:
        app_label = 'superuser_stats'
        verbose_name_plural = 'Reports'
        proxy = True
