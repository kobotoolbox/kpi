import React from "react";
import bem, {makeBem} from 'js/bem';
import envStore from 'js/envStore';

bem.PlanSection = makeBem(null, 'plan-section');
bem.PlanRow = makeBem(null, 'plan-row');
bem.PlanRow__header = makeBem(bem.PlanRow, 'header');

export default class PlanRoute extends React.Component {
  render() {
    const stripePublicKey = envStore.data.stripe_public_key;
    const stripePricingTableID = envStore.data.stripe_pricing_table_id;

    return (
      <bem.SecuritySection>
        <bem.SecurityRow>
          <bem.SecurityRow__header>
            <bem.SecurityRow__title>
              {t('Current Plan')}
            </bem.SecurityRow__title>
          </bem.SecurityRow__header>
        </bem.SecurityRow>
        {envStore.isReady && stripePublicKey && stripePricingTableID &&
          <stripe-pricing-table pricing-table-id={stripePricingTableID} publishable-key={stripePublicKey}/>
        }

      </bem.SecuritySection>
    )
  }
}