import React from "react";
import ReactDOM from "react-dom";
import autoBind from 'react-autobind';
import bem from "../../bem";
import classNames from 'classnames';
import Select from 'react-select';
import { t } from "../../utils";

class CopyTeamPermissions extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
    this.state = {
      isCopyFormVisible: false,
      hasUserInput: false,
      teamPermissionsInput: null
    };
  }
  
  showCopyForm() {
    this.setState({isCopyFormVisible: !this.state.isCopyFormVisible});
  }
  
  updateTeamPermissionsInput() {
    console.log("updateTeamPermissionsInput");
  }

  render() {
    const importButtonCssClasses = classNames(
      'mdl-button',
      'mdl-js-button', 
      'mdl-button--raised', 
      this.state.hasUserInput ? 'mdl-button--colored' : 'mdl-button--disabled'
    );

    const availableOptions = [
      {value: 'option_1', label: t('Option one')},
      {value: 'option_2', label: t('Second option')},
      {value: 'option_3', label: t('This is the fourth option available')},
      {value: 'option_4', label: t('Third')},
      {value: 'option_5', label: t('Option one')},
      {value: 'option_6', label: t('Second option')},
      {value: 'option_7', label: t('This is the fourth option available')},
      {value: 'option_8', label: t('Third')}
    ];

    return (
      <bem.FormView__cell>
        { !this.state.isCopyFormVisible &&
          <bem.FormModal__item m="copy-team-permissions-opener" onClick={this.showCopyForm}>
            {t("Copy team from another project")}
          </bem.FormModal__item>
        }
        { this.state.isCopyFormVisible &&
          <bem.FormView__cell>
            <bem.FormView__cell m='label'>
              {t("Copy team and permissions from another project")}
            </bem.FormView__cell>
            <bem.FormModal__item>
              {t("This will overwrite any existing sharing settings defined in this project.")}
            </bem.FormModal__item>
            <bem.FormModal__item m={['gray-row', 'copy-team-permissions']}>
              <Select
                id='teamPermissions'
                ref='teamPermissionsInput'
                value={this.state.teamPermissionsInput}
                clearable={false}
                options={availableOptions}
                onChange={this.updateTeamPermissionsInput}
              />
              <button className={importButtonCssClasses}>
                {t('import')}
              </button>
            </bem.FormModal__item>
          </bem.FormView__cell>
        }
      </bem.FormView__cell>
    );
  }
}

export default CopyTeamPermissions;
