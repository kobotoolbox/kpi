import React from "react";
import bem, {makeBem} from 'js/bem';
import envStore from 'js/envStore';
import Icon from 'js/components/common/icon';
import KoboRange, {KoboRangeColors} from 'js/components/common/koboRange';
import './planRoute.scss';

/*
 * TODO: Create a basic unified frame for account settings. Find somewhere to put the BEM declaration.
 * See: https://www.figma.com/file/dyA3ivXUxmSjjFruqmW4T4/Data-storage-and-billing-options?node-id=0%3A1
 * There will be repeated styles in elements such as the header, title, and the containing div for the component.
 * Every component except for `profile` should share this frame.
 */
bem.Plan = makeBem(null, 'plan');

// Plan details parent div
bem.Plan__info = makeBem(bem.Plan, 'info');
// Plan text description
bem.Plan__description = makeBem(bem.Plan, 'description');
// Data usage
bem.Plan__data = makeBem(bem.Plan, 'data');
// Component inside data usage that shows range
bem.DataRow = makeBem(null, 'data-row');
bem.DataRow__header = makeBem(bem.DataRow, 'header');
bem.DataRow__data = makeBem(bem.DataRow, 'data');

// Stripe table parent div
bem.Plan__stripe = makeBem(bem.Plan, 'stripe');

const MAX_MONTHLY_SUBMISSIONS = 10000; // Should come from enviorment?
const PLACEHOLDER = 3407; // TODO remove this once endpoint exists

export default class PlanRoute extends React.Component {

  constructor(props: any) {
    super(props);
    this.state = {
      isLoading: true,
    };
  }

  componentDidMount() {
    this.setState({
      isLoading: false,
    });
  }

  render() {
    const stripePublicKey = envStore.data.stripe_public_key;
    const stripePricingTableID = envStore.data.stripe_pricing_table_id;

    return (
      <bem.Plan>
        <bem.Plan__info>
          <bem.Plan__data>
            <bem.DataRow>
              <bem.DataRow__header>
                <div className='submissions-title-wrapper'>
                  <Icon name='user' size='m'/>
                  <label>{t('Submissions per month')}</label>
                </div>
              </bem.DataRow__header>

              <bem.DataRow__data>
                <KoboRange
                  max={MAX_MONTHLY_SUBMISSIONS - PLACEHOLDER}
                  value={PLACEHOLDER}
                  currentLabel={t('submissions collected this month')}
                  totalLabel={t('submissions left')}
                  // TODO: when endpoint exists, change this to warning after some percentage has passed
                  color={KoboRangeColors.teal}
                />
              </bem.DataRow__data>
            </bem.DataRow>
          </bem.Plan__data>

          <bem.Plan__description>
            <h2>{t('Data storage')}</h2>
            <p>{t('Users can collect up to 10,000 survey submissions with their projects each month and store up to 5GB (counted as up to 5,000 Megabytes) overall of survey attachments in their user account (photos, videos, audio recordings, PDF, etc.). If you are reaching any of these limits and you do not want to delete data, please consider upgrading your plan')}</p>
          </bem.Plan__description>
        </bem.Plan__info>

        <bem.Plan__stripe>
          {envStore.isReady && stripePublicKey && stripePricingTableID &&
            <stripe-pricing-table
              pricing-table-id={stripePricingTableID}
              publishable-key={stripePublicKey}
            />
          }
        </bem.Plan__stripe>
      </bem.Plan>
    )
  }
}
