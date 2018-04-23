import React from "react";
import reactMixin from 'react-mixin';
import autoBind from "react-autobind";
import bem from "../../bem";
import classNames from "classnames";
import Select from "react-select";
import alertify from 'alertifyjs';
import stores from "../../stores";
import { t } from "../../utils";

class CopyTeamPermissions extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isCopyFormVisible: false,
      sourceAssetUid: null
    };
    this.store = stores.allAssets;
    autoBind(this);
  }

  showCopyForm() {
    this.setState({ isCopyFormVisible: !this.state.isCopyFormVisible });
  }

  updateTeamPermissionsInput(asset) {
    this.setState({ sourceAssetUid: asset.value });
  }
  
  safeCopyPermissionsFrom() {
    if (this.state.sourceAssetUid) {
      const sourceName = stores.allAssets.byUid[this.state.sourceAssetId].name;
      const targetName = stores.allAssets.byUid[this.currentAssetID()].name;
      const dialog = alertify.dialog("confirm");
      let dialogOptions = {
        title: t('Are you sure you want to copy permissions?'),
        message: t(`You are about to copy permissions from ${sourceName} to ${targetName}. This action cannot be undone.`),
        labels: {ok: t('Import'), cancel: t('Cancel')},
        onok: () => {
          console.log("TODO start importing!");
          // dataInterface.copyPermissionsFrom()
          // actions.permissions.copyPermissionsFrom();
        },
        oncancel: () => {dialog.destroy()}
      };
      dialog.set(dialogOptions).show();
    }
  }

  render() {
    const importButtonCssClasses = classNames(
      "mdl-button",
      "mdl-js-button",
      "mdl-button--raised",
      this.state.sourceAssetUid ? "mdl-button--colored" : "mdl-button--disabled"
    );

    const availableOptions = [];
    for (const assetUid in stores.allAssets.byUid) {
      if (stores.allAssets.byUid.hasOwnProperty(assetUid)) {
        availableOptions.push({
          value: assetUid,
          label: stores.allAssets.byUid[assetUid].name
        });
      }
    }

    return (
      <bem.FormView__cell>
        {!this.state.isCopyFormVisible && (
          <bem.FormModal__item
            m="copy-team-permissions-opener"
            onClick={this.showCopyForm}
          >
            {t("Copy team from another project")}
          </bem.FormModal__item>
        )}
        {this.state.isCopyFormVisible && (
          <bem.FormView__cell>
            <bem.FormView__cell m="label">
              {t("Copy team and permissions from another project")}
            </bem.FormView__cell>
            <bem.FormModal__item>
              {t("This will overwrite any existing sharing settings defined in this project.")}
            </bem.FormModal__item>
            <bem.FormModal__item m={["gray-row", "copy-team-permissions"]}>
              <Select
                id="teamPermissions"
                ref="sourceAssetUid"
                value={this.state.sourceAssetUid}
                clearable={false}
                placeholder={t("Select source project…")}
                options={availableOptions}
                onChange={this.updateTeamPermissionsInput}
              />
              <button 
                className={importButtonCssClasses}
                onClick={this.safeCopyPermissionsFrom}
              >{t("import")}</button>
            </bem.FormModal__item>
          </bem.FormView__cell>
        )}
      </bem.FormView__cell>
    );
  }
}

reactMixin(CopyTeamPermissions.prototype, mixins.contextRouter);

export default CopyTeamPermissions;
