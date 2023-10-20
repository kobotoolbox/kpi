import React from 'react';
import {observer} from 'mobx-react';
import bem, {makeBem} from 'js/bem';
import sessionStore from 'js/stores/session';
import {replaceBracketsWithLink} from 'js/utils';

import envStore from 'js/envStore';
import './somethingWrong.scss';

bem.SomethingWrong = makeBem(null, 'something-wrong');
bem.SomethingWrong__body = makeBem(bem.SomethingWrong, 'body', 'section');
bem.SomethingWrong__header = makeBem(bem.SomethingWrong, 'header', 'header');
bem.SomethingWrong__text = makeBem(bem.SomethingWrong, 'text', 'section');

export interface SomethingWrongProps {
  errorMessage?: string;
}
const SomethingWrong = (props: SomethingWrongProps) => {
  
  let messageText = t(
      `Please try again later, or [contact the support team] if this happens repeatedly.`
    );
  

  let messageHtml = replaceBracketsWithLink(
    messageText,
    envStore.data.support_url
  );

  return (
    <bem.SomethingWrong>
      <bem.SomethingWrong__body>
        <bem.SomethingWrong__header>
          {t('Something went wrong')}
        </bem.SomethingWrong__header>

        <bem.SomethingWrong__text>
          {t(
            "We're sorry, but the server encountered an error while trying to serve this page."
          )}

          <p dangerouslySetInnerHTML={{__html: messageHtml}} />
        </bem.SomethingWrong__text>

        {props.errorMessage && (
          <bem.SomethingWrong__text>
            {t('Additional details:')}

            <code>{props.errorMessage}</code>
          </bem.SomethingWrong__text>
        )}
      </bem.SomethingWrong__body>
    </bem.SomethingWrong>
  );
};

export default observer(SomethingWrong);
