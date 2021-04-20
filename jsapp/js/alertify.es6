import alertify from 'alertifyjs';

/**
 * @namespace MultiButton
 * @param {string} label
 * @param {function} callback
 */

/**
 * @param {string} confirmId - needs to be unique
 * @param {string} title
 * @param {string} message
 * @param {MultiButton[]} buttons
 */
export function multiConfirm(confirmId, title, message, buttons) {
  if (!alertify[confirmId]) {
    // define new alertify dialog
    alertify.dialog(confirmId, function() {
      return {
        setup: function() {
          const buttonsArray = [];
          buttons.forEach((button, i) => {
            buttonsArray.push({
              text: button.label,
              className: alertify.defaults.theme.ok,
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
          onclick: null,
        },
        callback: function(closeEvent) {
          this.settings.onclick(closeEvent);
        },
      };
    }, false, 'confirm');
  }

  const dialog = alertify[confirmId]();
  dialog.set({
    onclick: (closeEvent) => {
      if (buttons[closeEvent.index] && buttons[closeEvent.index].callback) {
        buttons[closeEvent.index].callback();
      }
    },
  }).show();
}
