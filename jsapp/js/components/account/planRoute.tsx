import React from "react";
import bem, {makeBem} from 'js/bem';
import envStore from 'js/envStore';
import './planRoute.scss';

// TODO: Create a basic unified frame for account settings. Find somewhere to put the BEM declaration.
// See: https://www.figma.com/file/dyA3ivXUxmSjjFruqmW4T4/Data-storage-and-billing-options?node-id=0%3A1
// There will be repeated styles in elements such as the header, title, and the containing div for the component.
// Every component except for `profile` should share this frame.
bem.PlanSection = makeBem(null, 'plan-section');
bem.PlanRow = makeBem(null, 'plan-row');
bem.PlanRow__header = makeBem(bem.PlanRow, 'header');
bem.PlanRow__title = makeBem(bem.PlanRow, 'title', 'h2');

export default class PlanRoute extends React.Component {
  render() {
    const stripePublicKey = envStore.data.stripe_public_key;
    const stripePricingTableID = envStore.data.stripe_pricing_table_id;

    return (
      <bem.PlanSection>
        <bem.PlanRow>
          <bem.PlanRow__header>
            <bem.PlanRow__title>
              {t('Current Plan')}
            </bem.PlanRow__title>
          </bem.PlanRow__header>
        </bem.PlanRow>

        {envStore.isReady && stripePublicKey && stripePricingTableID &&
          <stripe-pricing-table pricing-table-id={stripePricingTableID} publishable-key={stripePublicKey}/>
        }

      </bem.PlanSection>
    )
  }
}
