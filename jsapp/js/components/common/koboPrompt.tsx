import React from 'react';
import bem from 'js/bem';
import KoboModal from './koboModal';

interface KoboPromptProps {
  isOpen: boolean;
  onRequestClose: () => void;
  children?: any;
}

export default function KoboPrompt(props: KoboPromptProps) {
  return (
    <KoboModal
      isOpen={props.isOpen}
      onRequestClose={props.onRequestClose}
    >
      {props.children}
    </KoboModal>
  );
}
