// This is a collection of DRY wrappers for alertifyjs.
import alertify from 'alertifyjs';
import {KeyNames} from 'js/constants';
import type {IconName} from 'jsapp/fonts/k-icons';
import {escapeHtml} from 'js/utils';
import type {ReactElement} from 'react';
import ReactDOMServer from 'react-dom/server';

interface MultiConfirmButton {
  label: string;
  /** Defaults to gray. */
  color?: 'blue' | 'red';
  icon?: IconName;
  isDisabled?: boolean;
  callback: (() => void) | undefined;
}

interface AlertifyButton {
  text: string;
  className: string;
  /** primary is needed to not change for disabling below to work */
  scope: 'primary';
  element?: HTMLElement;
  index: number;
}

interface MultiConfirmButtonCloseEvent {
  index: number;
}

/**
 * Use this custom alertify modal to display multiple buttons with different
 * callbacks.
 */
export function multiConfirm(
  confirmId: string,
  title: string,
  message: string,
  buttons: MultiConfirmButton[]
) {
  // `confirmId` needs to be unique, as alertify requires the custom dialog to be
  // defined before it is being invoked.
  // We check if it haven't been already defined to avoid errors and unnecessary
  // calls.
  if (!alertify[confirmId]) {
    // define new alertify dialog
    alertify.dialog(
      confirmId,
      function () {
        return {
          setup: function () {
            const buttonsArray: AlertifyButton[] = [];
            buttons.forEach((button, i) => {
              let buttonLabel = button.label;
              if (button.icon) {
                buttonLabel = `
                  <span>
                    <i class="k-icon ${button.icon}"></i>
                    ${button.label}
                  </span>
                `;
              }

              let buttonClass = alertify.defaults.theme.input;
              if (button.color === 'blue') {
                buttonClass = alertify.defaults.theme.ok;
              } else if (button.color === 'red') {
                buttonClass = alertify.defaults.theme.cancel;
              }

              buttonsArray.push({
                text: buttonLabel,
                className: buttonClass,
                // primary is needed to not change for disabling below to work
                scope: 'primary',
                element: undefined,
                index: i,
              });
            });
            return {
              buttons: buttonsArray,
              options: {
                title: title,
                basic: false,
                movable: false,
                resizable: false,
                closable: true,
                maximizable: false,
                pinnable: false,
              },
            };
          },
          prepare: function() {
            if (message && this.setContent) {
              this.setContent(escapeHtml(message));
            }
          },
          settings: {
            onclick: Function.prototype,
          },
          callback: function (closeEvent: MultiConfirmButtonCloseEvent) {
            this.settings.onclick(closeEvent);
          },
        };
      },
      false,
      'confirm'
    );
  }

  const dialog = alertify[confirmId]();

  // set up closing modal on ESC key
  const killMe = (evt: KeyboardEvent) => {
    if (evt.key === KeyNames.Escape) {
      dialog.destroy();
    }
  };

  dialog.set({
    onclick: function (closeEvent: MultiConfirmButtonCloseEvent) {
      const foundButton = buttons[closeEvent.index];
      // button click operates on the button array indexes to know which
      // callback needs to be triggered
      if (foundButton?.callback !== undefined) {
        foundButton.callback();
      }
    },
    onshow: function () {
      document.addEventListener('keyup', killMe);
    },
    onclose: function () {
      document.removeEventListener('keyup', killMe);
    },
  });

  // This needs to be done here not during buttons creation as it would stay
  // disabled for all further dialogs.
  buttons.forEach((button, index) => {
    if (button.isDisabled) {
      const buttonEl = dialog.elements.buttons.primary.children[index];
      if (buttonEl) {
        buttonEl.classList.remove(alertify.defaults.theme.ok);
        buttonEl.classList.remove(alertify.defaults.theme.cancel);
        // disabled button is always gray
        buttonEl.classList.add(alertify.defaults.theme.input);
        buttonEl.classList.add('ajs-button-disabled');
      }
    }
  });

  dialog.show();
}

/**
 * A DRY dialog wrapper for `alertifyjs` that will display a simple confirmation
 * for destroying something. The fallback text is for deleting stuff, as most
 * common case.
 *
 * Usually you would only need to pass `okCallback` and `title`.
 */
export function destroyConfirm(
  okCallback: () => void,
  title: string = t('Delete?'),
  okLabel: string = t('Delete'),
  message: string = t('This action is not reversible'),
) {
  const dialog = alertify.dialog('confirm');

  dialog.elements.dialog.classList.add('custom-alertify-dialog--dangerous-destroy');

  dialog.setting('title', title);
  dialog.setting('message', message);
  dialog.setting('labels', {ok: okLabel, cancel: t('Cancel')});
  dialog.setting('onok', okCallback);
  dialog.setting('oncancel', dialog.destroy);
  dialog.setting('reverseButtons', true);
  dialog.setting('movable', false);
  dialog.setting('resizable', false);
  dialog.setting('closable', false);
  dialog.setting('closableByDimmer', false);
  dialog.setting('maximizable', false);
  dialog.setting('pinnable', false);

  dialog.show();

  return dialog;
}

/**
 * Useful to pass a complex JSX message into alertify (which accepts only
 * strings).
 */
export function renderJSXMessage(jsx: ReactElement) {
  return ReactDOMServer.renderToStaticMarkup(jsx);
}
