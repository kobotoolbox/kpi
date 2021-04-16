import alertify from 'alertifyjs';

export function groupDeleteConfirm(splitCallback, deleteCallback) {
  if (!alertify.multiConfirm) {
    // define new alertify dialog
    alertify.dialog('multiConfirm', function() {
      return {
        setup: function() {
          const buttons = [
            {
              text: t('Split apart'),
              className: alertify.defaults.theme.ok,
              scope: 'primary',
              element: undefined,
            },
            {
              text: t('Delete entirely'),
              className: alertify.defaults.theme.ok,
              scope: 'primary',
              element: undefined,
            },
            {
              text: t('Cancel'),
              className: alertify.defaults.theme.cancel,
              scope: 'primary',
              element: undefined,
            },
          ];

          return {
            buttons: buttons,
            options: {
              title: t('Delete group'),
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
          this.setContent(t('Do you want to split the group apart (and leave questions intact) or delete everything entirely?'));
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

  const dialog = alertify.multiConfirm();
  dialog.set({
    onclick: (closeEvent) => {
      if (closeEvent.index === 0) {
        splitCallback();
      } else if (closeEvent.index === 1) {
        deleteCallback();
      }
    },
  }).show();
}

groupDeleteConfirm(() => {console.log('split')}, () => {console.log('delete')});
