class ManualInvoicingSetupError(Exception):
    pass


class DefaultCommunityPlanNotFoundError(ManualInvoicingSetupError):
    pass


class ManualInvoicingSubscriptionExistsError(ManualInvoicingSetupError):
    pass
