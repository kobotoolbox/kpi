import React from 'react';
import bem, {makeBem} from 'js/bem';
import Button from 'js/components/common/button';
import Icon from 'js/components/common/icon';
import MiniAudioPlayer from 'js/components/common/miniAudioPlayer';
import {goToProcessing} from 'js/components/processing/routes.utils';
import type {SubmissionAttachment} from 'js/dataInterface';
import './audioCell.scss';

bem.AudioCell = makeBem(null, 'audio-cell');

interface AudioCellProps {
  assetUid: string;
  xpath: string;
  /* submissionEditId is meta/rootUuid || _uuid */
  submissionEditId: string;
  /** Required by the mini player. String passed is an error message */
  mediaAttachment: SubmissionAttachment | string;
}

/**
 * An alternative component to MediaCell for audio columns. It's a transitional
 * component created with Processing View in mind. It omits the modal.
 */
export default function AudioCell(props: AudioCellProps) {
  return (
    <bem.AudioCell>
      {typeof props.mediaAttachment === 'string' && (
        <span data-tip={props.mediaAttachment}>
          <Icon name='alert' color='mid-red' size='s' />
        </span>
      )}

      {typeof props.mediaAttachment === 'object' &&
        props.mediaAttachment?.download_url && (
          <MiniAudioPlayer mediaURL={props.mediaAttachment?.download_url} />
        )}

      <Button
        type='primary'
        size='s'
        endIcon='arrow-up-right'
        label={t('Open')}
        isDisabled={typeof props.mediaAttachment === 'string'}
        onClick={() => {
          goToProcessing(props.assetUid, props.xpath, props.submissionEditId);
        }}
      />
    </bem.AudioCell>
  );
}
