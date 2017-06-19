import React from "react";
import bem from "../../bem";
import ui from "../../ui";
import { t } from "../../utils";
import Select from "react-select";

let FormGalleryFilter = React.createClass({
  render() {
    return (
      <bem.AssetGallery__heading>
        <div className="col6">
          <bem.AssetGallery__count>
            <strong>{this.props.attachments_count} {t("Images")}</strong>
          </bem.AssetGallery__count>
        </div>
        <div className="col6">
          <bem.AssetGallery__headingSearchFilter className="section">
            <input
              className="text-display"
              placeholder={this.props.currentFilter.label}
              onChange={this.props.setSearchTerm}
              value={this.props.searchTerm}
            />
            <Select
              ref="filterSelect"
              className="icon-button-select"
              options={this.props.filters}
              simpleValue
              name="selected-filter"
              value={this.props.currentFilter.source}
              onChange={this.props.switchFilter}
              autoBlur={true}
              searchable={false}
            />
          </bem.AssetGallery__headingSearchFilter>
        </div>
      </bem.AssetGallery__heading>
    );
  }
});

module.exports = FormGalleryFilter;
