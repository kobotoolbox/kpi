import alertify from 'alertifyjs';
import { KEY_CODES } from 'js/constants';

/**
 * @namespace MultiButton
 * @param {string} label
 * @param {string} [color] "blue" or "red", if not given button will be gray
 * @param {string} [icon] one of k-icons
 * @param {boolean} [isDisabled]
 * @param {function} callback
 */

/**
 * Use this custom alertify modal to display multiple buttons with different
 * callbacks.
 *
 * @param {string} confirmId needs to be unique
 * @param {string} [title] optional
 * @param {string} [message] optional
 * @param {MultiButton[]} buttons
 */
export function multiConfirm(confirmId, title, message, buttons) {
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
            const buttonsArray = [];
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
            if (message) {
              this.setContent(message);
            }
          },
          settings: {
            onclick: Function.prototype,
          },
          callback: function(closeEvent) {
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
  const killMe = (evt) => {
    if (evt.keyCode === KEY_CODES.ESC) {
      dialog.destroy();
    }
  };

  dialog.set({
    onclick: function(closeEvent) {
      // button click operates on the button array indexes to know which
      // callback needs to be triggered
      if (buttons[closeEvent.index] && buttons[closeEvent.index].callback) {
        buttons[closeEvent.index].callback();
      }
    },
    onshow: function() {
      $(document).on('keyup', killMe);
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
