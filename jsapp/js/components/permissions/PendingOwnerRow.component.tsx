import React from 'react';
import bem from 'js/bem';
import {stringToColor} from 'js/utils';

// Simple row for displaying a pending project owner who does not yet have any permissions

interface PendingOwnerRowProps {
  username: string;
}

export default class PendingOwnerRow extends React.Component<PendingOwnerRowProps> {
  constructor(props: PendingOwnerRowProps) {
    super(props);
  }

  render() {
    const initialsStyle = {
      background: `#${stringToColor(this.props.username)}`,
    };

    return (
      <bem.UserRow>
        <bem.UserRow__info>
          <bem.UserRow__avatar>
            <bem.AccountBox__initials style={initialsStyle}>
              {this.props.username.charAt(0)}
            </bem.AccountBox__initials>
          </bem.UserRow__avatar>

          <bem.UserRow__name>{this.props.username}</bem.UserRow__name>

          <bem.UserRow__perms>{t('Pending owner')}</bem.UserRow__perms>
        </bem.UserRow__info>
      </bem.UserRow>
    );
  }
}
