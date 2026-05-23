class ManualInvoicingSetupError(Exception):
    pass


class DefaultCommunityPlanNotFoundError(ManualInvoicingSetupError):
    pass


class ManualSubscriptionExistsError(ManualInvoicingSetupError):
    pass
