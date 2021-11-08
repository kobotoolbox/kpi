ACTION_NEEDED = 'ACTION_NEEDED'
PASSES = 'PASSES'

class BaseAction:
    ID = None
    _destination_field = '_supplementalDetails'

    def __init__(self, params):
        self.load_params(params)
    
    def load_params(self, params):
        raise NotImplementedError('subclass must define a load_params method')

    def run_change(self, params):
        raise NotImplementedError('subclass must define a run_change method')

    def check_submission_status(self, submission):
        return PASSES

    # def test_submission_passes_action(self, submission):
    #     try:
    #         validate(instance=submission, schema=self.ACT_ON)
    #     except ValidationError as err:
    #         return False
    #     return True
    # def assert_submission_passes_this_action(self, submission):
    #     assert self.test_submission_passes_action(submission)

    @classmethod
    def build_params(kls, *args, **kwargs):
        raise NotImplementedError(f'{kls.__name__} has not implemented a build_params method')

    @classmethod
    def build_params__valid(kls, *args, **kwargs):
        '''
        a shortcut for tests that builds params and then runs them through the action's
        param validator
        '''
        params = kls.build_params(*args, **kwargs)
        # check that they match schema
        return params
