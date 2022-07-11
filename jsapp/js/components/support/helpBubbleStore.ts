import throttle from 'lodash.throttle';
import {makeAutoObservable} from 'mobx';
import type {
  InAppMessage,
  InAppMessagesResponse,
  FailResponse,
} from 'js/dataInterface';
import {notify} from 'js/utils';
import {ROOT_URL} from 'js/constants';

const FETCH_MESSAGES_LOOP_TIME = 1 * 60 * 1000; // 1 minute

class HelpBubbleStore {
  public messages: InAppMessage[] = [];
  public selectedMessageUid: string | null = null;
  public hasUnacknowledgedMessages = false;
  public locallyAcknowledgedMessageUids: Set<string> = new Set();
  public isOpen = false;
  public isOutsideCloseEnabled = true;
  public isLoading = false;
  /** This public function is throttled to not hit the backend to often. */
  public fetchMessages = throttle(
    this.fetchMessagesInternal.bind(this, true),
    FETCH_MESSAGES_LOOP_TIME,
  );

  constructor() {
    makeAutoObservable(this);
    this.fetchMessages();
  }

  get unreadCount() {
    let count = 0;
    this.messages.forEach((msg) => {
      if (!msg.interactions.readTime || msg.always_display_as_new) {
        count++;
      }
    });
    return count;
  }

  get unacknowledgedMessages() {
    return this.messages.filter(
      (msg) =>
        msg.interactions.acknowledged !== true || msg.always_display_as_new
    );
  }

  /**
   * Use `isSilent` to make the call in the background. Useful to check for new
   * messages periodically.
   */
  private fetchMessagesInternal(isSilent = false) {
    this.isLoading = !isSilent;
    $.ajax({
      dataType: 'json',
      method: 'GET',
      url: `${ROOT_URL}/help/in_app_messages/`,
    })
      .done(this.onFetchMessagesDone.bind(this))
      .fail(this.onFetchMessagesFail.bind(this));
  }

  private onFetchMessagesDone(response: InAppMessagesResponse) {
    this.isLoading = false;
    this.messages = response.results;
  }

  private onFetchMessagesFail(response: FailResponse) {
    this.isLoading = false;
    notify(response.responseText, 'error');
  }

  public selectMessage(messageUid: string) {
    this.selectedMessageUid = messageUid;
    if (!this.isMessageRead(messageUid)) {
      this.markMessageRead(messageUid);
    }
  }

  public unselectMessage() {
    this.selectedMessageUid = null;
  }

  public findMessage(messageUid: string) {
    return this.messages.find((message) => message.uid === messageUid);
  }

  public isMessageRead(messageUid: string) {
    const msg = this.findMessage(messageUid);
    return !!msg?.interactions.readTime && !msg.always_display_as_new;
  }

  public markMessageRead(messageUid: string) {
    const currentTime = new Date();
    this.patchMessage(messageUid, currentTime.toISOString());
  }

  public markMessageAcknowledged(messageUid: string) {
    this.patchMessage(messageUid);
  }

  private patchMessage(
    messageUid: string,
    readTime?: string
  ) {
    $.ajax({
      dataType: 'json',
      contentType: 'application/json',
      method: 'PATCH',
      url: `${ROOT_URL}/help/in_app_messages/${messageUid}/`,
      data: JSON.stringify({
        interactions: {
          readTime: readTime,
          acknowledged: true,
        },
      }),
    })
      .done(this.onPatchMessageDone.bind(this))
      .fail(this.onPatchMessageFail.bind(this));
  }

  private onPatchMessageDone(message: InAppMessage) {
    const newMessages = [...this.messages];
    for (let i = 0; i < newMessages.length; i++) {
      if (newMessages[i].uid === message.uid) {
        // update patched messages in the list of messages
        newMessages[i] = message;
      }
    }
    this.messages = newMessages;
  }

  private onPatchMessageFail(response: FailResponse) {
    notify(response.responseText, 'error');
  }
}

const helpBubbleStore = new HelpBubbleStore();

export default helpBubbleStore;
