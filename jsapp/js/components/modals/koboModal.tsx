import React from 'react';
import Modal from 'react-modal';
import cx from 'classnames';
import bem, {makeBem} from 'js/bem';
import './koboModal.scss';

bem.KoboModal = makeBem(null, 'kobo-modal');

type KoboModalSize = 'large' | 'medium';

const DEFAULT_SIZE: KoboModalSize = 'medium';

interface KoboModalProps {
  /** For displaying the modal. */
  isOpen: boolean;
  /** Request from the inside for the modal parent to close it. */
  onRequestClose: () => void;
  size?: KoboModalSize;
  children: React.ReactNode;
  /**
   * Whether it should close when user hits Esc or clicks on overlay.
   * NOTE: disabling Esc key may introduce an accessibility issue.
   */
  isDismissableByDefaultMeans?: boolean;
  'data-cy'?: string;
}

export default function KoboModal(props: KoboModalProps) {
  const modalSize: KoboModalSize = props.size || DEFAULT_SIZE;

  return (
    <Modal
      ariaHideApp
      isOpen={props.isOpen}
      onRequestClose={props.onRequestClose}
      className={cx('kobo-modal', `kobo-modal--size-${modalSize}`)}
      overlayClassName='kobo-modal-overlay'
      shouldCloseOnOverlayClick={props.isDismissableByDefaultMeans}
      shouldCloseOnEsc={props.isDismissableByDefaultMeans}
      data={{'cy': props['data-cy']}}
      preventScroll
    >
      {props.children}
    </Modal>
  );
}
