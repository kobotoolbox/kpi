from .manual_transcription import ManualTranscriptionAction


class AutomaticTranscriptionAction(ManualTranscriptionAction):
    ID = 'automatic_transcription'
    # this doesn't do shit except give me a way to test manual vs. automatic
    # transcripts for the same response and see if i can get the logic right for
    # arbitrating based on acceptance dates
    pass