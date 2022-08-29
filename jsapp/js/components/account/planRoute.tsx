import React from "react";
import bem, {makeBem} from 'js/bem';

bem.PlanSection = makeBem(null, 'plan-section');
bem.PlanRow = makeBem(null, 'plan-row');
bem.PlanRow__header = makeBem(bem.PlanRow, 'header');

export default class PlanRoute extends React.Component {
  render() {
    return (
      <bem.SecuritySection>
        <bem.SecurityRow>
          <bem.SecurityRow__header>
            <bem.SecurityRow__title>
              {t('Current Plan')}
            </bem.SecurityRow__title>
          </bem.SecurityRow__header>
        </bem.SecurityRow>
        <stripe-pricing-table pricing-table-id="prctbl_1LXtWCAR39rDI89s1EcrJUHk" publishable-key="pk_live_7JRQ5elvhnmz4YuWdlSRNmMj00lhvqZz8P"/>

      </bem.SecuritySection>
    )
  }
}