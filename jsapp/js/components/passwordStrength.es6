import React from 'react';
import autoBind from 'react-autobind';
import zxcvbn from 'zxcvbn';
import {bem} from '../bem';
import {t} from '../utils';

/*
Properties:
- password <string>: required
*/
class PasswordStrength extends React.Component {
  constructor(props){
    super(props);
    autoBind(this);
  }

  render() {
    const report = zxcvbn(this.props.password);
    const barModifier = `score-${report.score}`;
    return (
      <bem.PasswordStrength>
        <bem.PasswordStrength__title>
          {t('Password strength')}
        </bem.PasswordStrength__title>

        <bem.PasswordStrength__bar m={barModifier}>
          <bem.PasswordStrength__indicator/>
        </bem.PasswordStrength__bar>

        {(report.feedback.warning || report.feedback.suggestions.length > 0) &&
          <bem.PasswordStrength__messages>
            {report.feedback.warning &&
              <bem.PasswordStrength__message m='warning'>
                {t(report.feedback.warning)}
              </bem.PasswordStrength__message>
            }

            {report.feedback.suggestions.length > 0 &&
              report.feedback.suggestions.map((suggestion, index) => {
                return (
                  <bem.PasswordStrength__message key={index}>
                    {t(suggestion)}
                  </bem.PasswordStrength__message>
                )
              })
            }
          </bem.PasswordStrength__messages>
        }
      </bem.PasswordStrength>
    )
  }
}

export default PasswordStrength;
