import React from "react";
import ReactDOM from "react-dom";
import autoBind from 'react-autobind';
import bem from "../bem";
import { t } from "../utils";

class CopyTeamPermissions extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
    this.state = {
      isCopyFormVisible: false
    };
  }
  
  toggleCopyForm() {
    this.setState({isCopyFormVisible: !this.state.isCopyFormVisible});
  }

  render() {
    return (
      <bem.FormModal__item m="copy">
        { !this.state.isCopyFormVisible &&
          <bem.FormModal__item m="copy-opener" onClick={this.toggleCopyForm}>
            {t("Copy team from another project")}
          </bem.FormModal__item>
        }
        { this.state.isCopyFormVisible &&
          <bem.FormModal__item m="copy-form" onClick={this.toggleCopyForm}>
            copy form [x]
          </bem.FormModal__item>
        }
      </bem.FormModal__item>
    );
  }
}

export default CopyTeamPermissions;
