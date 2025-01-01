from dataclasses import dataclass


@dataclass
class SubmissionUpdate:
    status: str
    action: str
    username: str
    id: int

    @staticmethod
    def from_submission(submission):
        pass
