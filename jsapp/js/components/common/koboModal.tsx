import React from 'react';
import Modal from 'react-modal';
import bem, {makeBem} from 'js/bem';

bem.KoboModal = makeBem(null, 'kobo-modal');

interface KoboModalProps {
  isOpen: boolean;
  onRequestClose: () => void;
  children?: any;
}

export default function KoboModal(props: KoboModalProps) {
  return (
    <bem.KoboModal>
      <Modal
        ariaHideApp={false}
        isOpen={props.isOpen}
        onRequestClose={props.onRequestClose}
      >
        {props.children}
      </Modal>
    </bem.KoboModal>
  );
}
