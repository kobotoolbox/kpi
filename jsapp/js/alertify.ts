// This is a collection of DRY wrappers for alertifyjs.
import alertify from 'alertifyjs';
import {KEY_CODES} from 'js/constants';
import {IconName} from 'jsapp/fonts/k-icons'

interface MultiConfirmButton {
  label: string
  /** Defaults to gray. */
  color?: 'blue' | 'red'
  icon?: IconName
  isDisabled?: boolean
  callback: Function
}

interface AlertifyButton {
  text: string
  className: string
  /** primary is needed to not change for disabling below to work */
  scope: 'primary'
  element: any
  index: number
}

interface MultiConfirmButtonCloseEvent {
  index: number
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
      function() {
        return {
          setup: function() {
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
              this.setContent(message);
            }
          },
          settings: {
            onclick: Function.prototype,
          },
          callback: function(closeEvent: MultiConfirmButtonCloseEvent) {
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
  const killMe = (evt: JQuery.KeyUpEvent) => {
    if (evt.keyCode === KEY_CODES.ESC) {
      dialog.destroy();
    }
  };

  dialog.set({
    onclick: function(closeEvent: MultiConfirmButtonCloseEvent) {
      // button click operates on the button array indexes to know which
      // callback needs to be triggered
      if (buttons[closeEvent.index] && buttons[closeEvent.index].callback) {
        buttons[closeEvent.index].callback();
      }
    },
    onshow: function() {
      $(document).on('keyup', killMe)
    },
    onclose: function() {
      $(document).off('keyup', killMe);
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

/** A simple DRY confirmation wrapper function. */
export function simpleConfirm(
  title: string,
  message: string,
  okLabel: string,
  okCallback: Function
) {
  const dialog = alertify.dialog('confirm')
  const opts = {
    title: title,
    message: message,
    labels: {ok: okLabel, cancel: t('Cancel')},
    onok: okCallback,
    oncancel: dialog.destroy
  }
  dialog.set(opts).show()
}
