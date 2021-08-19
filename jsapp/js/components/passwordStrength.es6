import React from 'react';
import autoBind from 'react-autobind';
import zxcvbn from 'zxcvbn';
import bem from 'js/bem';
import './passwordStrength.scss';

/*
Properties:
- password <string>: required
*/
class PasswordStrength extends React.Component {
  constructor(props){
    super(props);
    autoBind(this);
    this.feedbackTranslations = {
      // strings for zxcvbn 4.4.2 package
      // copied from https://github.com/dropbox/zxcvbn/blob/master/src/feedback.coffee
      // not the most concise approach, but hopefully the most intuitive; could
      // be removed if https://github.com/dropbox/zxcvbn/pull/124 is ever merged
      'Use a few words, avoid common phrases':
        t('Use a few words, avoid common phrases'),
      'No need for symbols, digits, or uppercase letters':
        t('No need for symbols, digits, or uppercase letters'),
      'Add another word or two. Uncommon words are better.':
        t('Add another word or two. Uncommon words are better.'),
      'Straight rows of keys are easy to guess':
        t('Straight rows of keys are easy to guess'),
      'Short keyboard patterns are easy to guess':
        t('Short keyboard patterns are easy to guess'),
      'Use a longer keyboard pattern with more turns':
        t('Use a longer keyboard pattern with more turns'),
      'Repeats like "aaa" are easy to guess':
        t('Repeats like "aaa" are easy to guess'),
      'Repeats like "abcabcabc" are only slightly harder to guess than "abc"':
        t('Repeats like "abcabcabc" are only slightly harder to guess than "abc"'),
      'Avoid repeated words and characters':
        t('Avoid repeated words and characters'),
      'Sequences like abc or 6543 are easy to guess':
        t('Sequences like abc or 6543 are easy to guess'),
      'Avoid sequences':
        t('Avoid sequences'),
      'Recent years are easy to guess':
        t('Recent years are easy to guess'),
      'Avoid recent years':
        t('Avoid recent years'),
      'Avoid years that are associated with you':
        t('Avoid years that are associated with you'),
      'Dates are often easy to guess':
        t('Dates are often easy to guess'),
      'Avoid dates and years that are associated with you':
        t('Avoid dates and years that are associated with you'),
      'This is a top-10 common password':
        t('This is a top-10 common password'),
      'This is a top-100 common password':
        t('This is a top-100 common password'),
      'This is a very common password':
        t('This is a very common password'),
      'This is similar to a commonly used password':
        t('This is similar to a commonly used password'),
      'A word by itself is easy to guess':
        t('A word by itself is easy to guess'),
      'Names and surnames by themselves are easy to guess':
        t('Names and surnames by themselves are easy to guess'),
      'Common names and surnames are easy to guess':
        t('Common names and surnames are easy to guess'),
      "Capitalization doesn't help very much":
        t("Capitalization doesn't help very much"),
      'All-uppercase is almost as easy to guess as all-lowercase':
        t('All-uppercase is almost as easy to guess as all-lowercase'),
      "Reversed words aren't much harder to guess":
        t("Reversed words aren't much harder to guess"),
      "Predictable substitutions like '@' instead of 'a' don't help very much":
        t("Predictable substitutions like '@' instead of 'a' don't help very much")
    };
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
                {this.feedbackTranslations[report.feedback.warning]}
              </bem.PasswordStrength__message>
            }

            {report.feedback.suggestions.length > 0 &&
              report.feedback.suggestions.map((suggestion, index) => {
                return (
                  <bem.PasswordStrength__message key={index}>
                    {this.feedbackTranslations[suggestion]}
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
