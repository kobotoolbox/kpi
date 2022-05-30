import React from 'react';
import autoBind from 'react-autobind';
import bem, {makeBem} from 'js/bem';
import {KEY_CODES} from 'js/constants';
import './helpBubble.scss';

bem.HelpBubble = makeBem(null, 'help-bubble');
bem.HelpBubble__close = makeBem(bem.HelpBubble, 'close', 'button');
bem.HelpBubble__back = makeBem(bem.HelpBubble, 'back', 'button');
bem.HelpBubble__trigger = makeBem(bem.HelpBubble, 'trigger', 'button');
bem.HelpBubble__triggerCounter = makeBem(bem.HelpBubble, 'trigger-counter', 'span');
bem.HelpBubble__popup = makeBem(bem.HelpBubble, 'popup');
bem.HelpBubble__popupContent = makeBem(bem.HelpBubble, 'popup-content');
bem.HelpBubble__row = makeBem(bem.HelpBubble, 'row');
bem.HelpBubble__rowAnchor = makeBem(bem.HelpBubble, 'row', 'a');
bem.HelpBubble__rowWrapper = makeBem(bem.HelpBubble, 'row-wrapper');

const BUBBLE_OPENED_EVT_NAME = 'help-bubble-opened';

interface HelpBubbleState {
  messages?: Array<{
    uid: string;
  }>;
  isOpen: boolean;
  isOutsideCloseEnabled: boolean;
  hasUnacknowledgedMessages?: boolean;
  locallyAcknowledgedMessageUids: Set<string>;
}

export default class HelpBubble extends React.Component<{}, HelpBubbleState> {
  public bubbleName = '';
  public cancelOutsideCloseWatch = Function.prototype;
  public cancelHelpBubbleEventCloseWatch = Function.prototype;

  constructor(props: {}) {
    super(props);
    autoBind(this);
    this.state = {
      isOpen: false,
      isOutsideCloseEnabled: true,
      locallyAcknowledgedMessageUids: new Set(),
    };
  }

  open() {
    this.setState({isOpen: true});

    // tell all HelpBubbles that this one have just opened
    const bubbleOpenedEvt = new CustomEvent(BUBBLE_OPENED_EVT_NAME, {
      detail: this.bubbleName,
    });
    document.dispatchEvent(bubbleOpenedEvt);

    // if enabled we want to close this HelpBubble
    // whenever user clicks outside it or hits ESC key
    this.cancelOutsideCloseWatch();
    if (this.state.isOutsideCloseEnabled) {
      this.watchOutsideClose();
    }

    // we want to close all the other HelpBubbles whenever one opens
    this.cancelHelpBubbleEventCloseWatch();
    this.watchHelpBubbleEventClose();
  }

  close() {
    this.setState({isOpen: false});
    this.cancelOutsideCloseWatch();
  }

  toggle() {
    if (this.state.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  watchHelpBubbleEventClose() {
    const helpBubbleEventHandler = (evt: CustomEvent) => {
      if (evt.detail !== this.bubbleName) {
        this.close();
      }
    };

    document.addEventListener(BUBBLE_OPENED_EVT_NAME, helpBubbleEventHandler as EventListener);

    this.cancelHelpBubbleEventCloseWatch = () => {
      document.removeEventListener(
        BUBBLE_OPENED_EVT_NAME,
        helpBubbleEventHandler as EventListener
      );
    };
  }

  watchOutsideClose() {
    const outsideClickHandler = (evt: MouseEvent) => {
      if (evt.target) {
        const $targetEl = $(evt.target);
        if (
          $targetEl.parents('.help-bubble__back').length === 0 &&
          $targetEl.parents('.help-bubble__popup').length === 0 &&
          $targetEl.parents('.help-bubble__popup-content').length === 0 &&
          $targetEl.parents('.help-bubble__row').length === 0 &&
          $targetEl.parents('.help-bubble__row-wrapper').length === 0
        ) {
          this.close();
        }
      }
    };

    const escHandler = (evt: KeyboardEvent) => {
      if (evt.keyCode === KEY_CODES.ESC || evt.key === 'Escape') {
        this.close();
      }
    };

    this.cancelOutsideCloseWatch = () => {
      document.removeEventListener('click', outsideClickHandler);
      document.removeEventListener('keydown', escHandler);
    };

    document.addEventListener('click', outsideClickHandler);
    document.addEventListener('keydown', escHandler);
  }
}
