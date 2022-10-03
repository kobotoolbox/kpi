import React from "react";
import bem, {makeBem} from 'js/bem';
import envStore from 'js/envStore';
import Icon from 'js/components/common/icon';
import KoboRange, {KoboRangeColors} from 'js/components/common/koboRange';
import {observer} from 'mobx-react';
import planRouteStore from './planRouteStore';
import './planRoute.scss';

/*
 * TODO: Create a basic unified frame for account settings. Find somewhere to put the BEM declaration.
 * See: https://www.figma.com/file/dyA3ivXUxmSjjFruqmW4T4/Data-storage-and-billing-options?node-id=0%3A1
 * There will be repeated styles in elements such as the header, title, and the containing div for the component.
 * Every component except for `profile` should share this frame.
 */
bem.Plan = makeBem(null, 'plan');

bem.Plan__header = makeBem(bem.Plan, 'header', 'h2');
bem.Plan__blurb = makeBem(bem.Plan, 'blurb', 'b');
// Plan details parent div
bem.Plan__info = makeBem(bem.Plan, 'info');
// Plan text description
bem.Description = makeBem(null, 'description');
bem.Description__header = makeBem(bem.Description, 'header');
bem.Description__blurb = makeBem(bem.Description, 'blurb');
// Data usage
bem.Plan__data = makeBem(bem.Plan, 'data');
// Component inside data usage that shows range
bem.DataRow = makeBem(null, 'data-row');
bem.DataRow__header = makeBem(bem.DataRow, 'header');
bem.DataRow__data = makeBem(bem.DataRow, 'data');

// Stripe table parent div
bem.Plan__stripe = makeBem(bem.Plan, 'stripe');

const MAX_MONTHLY_SUBMISSIONS = 2;
const MAX_GIGABYTES_STORAGE = 4;
const WARNING_PERCENT = 75;
// Semi-hack: display proper range with a percentage as math using
// MAX_MONTHLY_SUBMISSIONS is already done later
const MAX_PERCENTAGE = 100;

interface PlanRouteProps {
  // subscriotion info
}

interface PlanRouteState {
  isLoading: boolean;
}

class PlanRoute extends React.Component<PlanRouteProps, PlanRouteState> {
  private store = planRouteStore;

  constructor(props: any) {
    super(props);
    this.state = {
      isLoading: true,
    };

    this.store.fetchDataUsage();
  }

  componentDidMount() {
    this.setState({
      isLoading: false,
    });
  }

  private getOneDecimalDisplay(x: number): number {
    return(parseFloat(x.toFixed(1)));
  }

  private getUsageColor(): KoboRangeColors {
    if ((this.store.usageSubmissionsMonthly / MAX_MONTHLY_SUBMISSIONS) * 100 >= WARNING_PERCENT) {
      return KoboRangeColors.warning;
    } else {
      return KoboRangeColors.teal;
    }
  }

  render() {
    const stripePublicKey = envStore.data.stripe_public_key;
    const stripePricingTableID = envStore.data.stripe_pricing_table_id;

    const MONTHLY_USAGE_PERCENTAGE = (this.store.usageSubmissionsMonthly / MAX_MONTHLY_SUBMISSIONS) * 100;
    const GIGABYTES_USAGE_PERCENTAGE = (this.store.usageStorage / 1000000) / MAX_GIGABYTES_STORAGE * 100;

    return (
      <bem.Plan>
        <bem.Plan__header>{t('Current Plan')}</bem.Plan__header>
        <bem.Plan__info>
          <bem.Plan__data>
            <bem.DataRow>
              <bem.DataRow__data>
                <KoboRange
                  max={MAX_PERCENTAGE}
                  value={this.getOneDecimalDisplay(MONTHLY_USAGE_PERCENTAGE)}
                  currentLabel={'Monthly submissions'}
                  totalLabel={'%'}
                  color={this.getUsageColor()}
                  singleStat
                />
              </bem.DataRow__data>
            </bem.DataRow>

            <bem.DataRow>
              <bem.DataRow__data>
                <KoboRange
                  max={MAX_PERCENTAGE}
                  value={this.getOneDecimalDisplay(GIGABYTES_USAGE_PERCENTAGE)}
                  currentLabel={'Data storage'}
                  totalLabel={'%'}
                  color={this.getUsageColor()}
                  singleStat
                />
              </bem.DataRow__data>
            </bem.DataRow>
          </bem.Plan__data>

          <bem.Description>
            {/*TODO get info from subscriotion store*/}
            <bem.Description__header>
              {t('Community plan (free access)')}
            </bem.Description__header>
            <bem.Description__blurb>{t('Free access to all services. 5GB of media attachments per account, 10,000 submissions per month, as well as 25 minutes of automatic speech recognition and 20,000 characters of machine translation per month.')}</bem.Description__blurb>
          </bem.Description>
        </bem.Plan__info>

        <bem.Plan__header>{t('Upgrade')}</bem.Plan__header>
        <bem.Plan__blurb>{t('Add ons and upgrades to your plan')}</bem.Plan__blurb>
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

export default observer(PlanRoute);
