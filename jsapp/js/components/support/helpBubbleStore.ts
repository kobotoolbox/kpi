import type {
  InAppMessage,
  InAppMessagesResponse,
  FailResponse,
} from 'js/dataInterface';
import {
  makeAutoObservable,
  // runInAction,
  // reaction,
} from 'mobx';
import {ROOT_URL} from 'js/constants';

class HelpBubbleStore {
  messages: InAppMessage[] = [];
  selectedMessageUid: string | null = null;
  hasUnacknowledgedMessages = false;
  locallyAcknowledgedMessageUids: Set<string> = new Set();
  isOpen = false;
  isOutsideCloseEnabled = true;
  isLoading = false;

  constructor() {
    console.log('HelpBubbleStore constructor');
    makeAutoObservable(this);
    this.fetchMessages();
  }

  fetchMessages() {
    this.isLoading = true;
    $.ajax({
      dataType: 'json',
      method: 'GET',
      url: `${ROOT_URL}/help/in_app_messages/`,
    })
      .done(this.onFetchMessagesDone.bind(this))
      .fail(this.onFetchMessagesFail.bind(this));
  }

  onFetchMessagesDone(response: InAppMessagesResponse) {
    console.log('onFetchMessagesDone', response);
    this.isLoading = false;
    this.messages = response.results;
    this.checkForUnacknowledgedMessages(response.results);
  }

  onFetchMessagesFail(response: FailResponse) {
    console.log('onFetchMessagesFail', response);
    this.isLoading = false;
  }

  /** Whenever new messages are fetched, this calculates some properties. */
  checkForUnacknowledgedMessages(newMessages: InAppMessage[]) {
    const unacknowledgedMessages = newMessages.filter(
      (msg) =>
        msg.interactions.acknowledged !== true || msg.always_display_as_new
    );
    this.hasUnacknowledgedMessages = unacknowledgedMessages.length >= 1;
    this.isOutsideCloseEnabled = unacknowledgedMessages.length === 0;
  }

  hi() {
    console.log('HelpBubbleStore hi!');
  }
}

const helpBubbleStore = new HelpBubbleStore();

export default helpBubbleStore;
