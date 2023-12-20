

class TestAPI:

    def test_can_create_invite_as_asset_owner(self):
        pass

    def test_cannot_create_invite_as_regular_user(self):
        pass

    def test_can_cancel_invite_as_sender(self):
        pass

    def test_cannot_cancel_invite_as_regular_sender(self):
        pass

    def test_cannot_cancel_invite_as_recipient(self):
        pass

    def test_can_accept_invite_as_recipient(self):
        pass

    def test_can_decline_invite_as_recipient(self):
        pass

    def test_cannot_accept_invite_as_sender(self):
        pass

    def test_cannot_decline_invite_as_sender(self):
        pass

    def test_cannot_change_in_progress_invite(self):
        pass

    def test_cannot_change_complete_invite(self):
        pass

    def test_cannot_change_failed_invite(self):
        pass

    def test_cannot_change_expired_invite(self):
        pass


class InAppMessage:

    def test_shared_users_receive_in_app_message(self):
        pass

    def test_other_users_do_not_receive_in_app_message(self):
        pass

    def test_previous_owner_do_not_receive_in_app_message(self):
        pass

    def test_new_owner_do_not_receive_in_app_message(self):
        pass
