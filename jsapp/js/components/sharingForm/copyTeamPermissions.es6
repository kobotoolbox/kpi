import React from "react";
import ReactDOM from "react-dom";
import autoBind from "react-autobind";
import bem from "../../bem";
import classNames from "classnames";
import Select from "react-select";
import stores from "../../stores";
import { t } from "../../utils";

class CopyTeamPermissions extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isCopyFormVisible: false,
      hasUserInput: false,
      teamPermissionsInput: null
    };
    this.store = stores.allAssets;
    autoBind(this);
  }

  showCopyForm() {
    this.setState({ isCopyFormVisible: !this.state.isCopyFormVisible });
  }

  updateTeamPermissionsInput(asset) {
    console.log("updateTeamPermissionsInput", asset, this);
    this.setState({ teamPermissionsInput: asset.value });
  }

  render() {
    const importButtonCssClasses = classNames(
      "mdl-button",
      "mdl-js-button",
      "mdl-button--raised",
      this.state.hasUserInput ? "mdl-button--colored" : "mdl-button--disabled"
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
                ref="teamPermissionsInput"
                value={this.state.teamPermissionsInput}
                clearable={false}
                placeholder={t("Select source project…")}
                options={availableOptions}
                onChange={this.updateTeamPermissionsInput}
              />
              <button className={importButtonCssClasses}>{t("import")}</button>
            </bem.FormModal__item>
          </bem.FormView__cell>
        )}
      </bem.FormView__cell>
    );
  }
}

export default CopyTeamPermissions;
