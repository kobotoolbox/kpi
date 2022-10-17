import React from 'react';
import type {ReactElement} from 'react';
import Modal from 'react-modal';
import bem, {makeBem} from 'js/bem';
import './koboModal.scss';

bem.KoboModal = makeBem(null, 'kobo-modal');

interface KoboModalProps {
  isOpen: boolean;
  onRequestClose: () => void;
  children: ReactElement | ReactElement[];
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
