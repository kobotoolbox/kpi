import React from "react";
import Reflux from "reflux";
import reactMixin from "react-mixin";
import autoBind from "react-autobind";
import bem from "../../bem";
import classNames from "classnames";
import Select from "react-select";
import alertify from "alertifyjs";
import stores from "../../stores";
import actions from "../../actions";
import mixins from "../../mixins";
import {dataInterface} from '../../dataInterface';
import { t, notify } from "../../utils";

class TemplatesList extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isLoading: true,
      templates: null,
      templatesCount: null,
      selectedTemplateUid: null
    };
    this.store = stores.allAssets;
    autoBind(this);
  }

  componentDidMount() {
    this.fetchTemplates();
  }

  fetchTemplates() {
    dataInterface.listTemplates().then((data) => {
      console.log('fetchTemplates success', data);
      this.setState({
        templates: data.results,
        templatesCount: data.count,
        isLoading: false
      });
    });
  }

  render() {
    if (this.state.isLoading) {
      return (
        <bem.Loading>
          <bem.Loading__inner>
            <i />
            {t('loading...')}
          </bem.Loading__inner>
        </bem.Loading>
      )
    } else if (this.state.templatesCount === 0) {
      return (
        <bem.FormView__cell>
          {t('You have no templates. Go to Library and create some.')}
        </bem.FormView__cell>
      )
    } else {
      return (
        <bem.FormView__cell>
          {this.state.templatesCount}
        </bem.FormView__cell>
      );
    }
  }
}

reactMixin(TemplatesList.prototype, Reflux.ListenerMixin);

export default TemplatesList;
