import React from 'react';
import bem, {makeBem} from 'js/bem';

bem.KoboModal__content = makeBem(bem.KoboModal, 'content');

interface KoboModalContentProps {
  children: React.ReactNode;
}

export default function KoboModalContent(props: KoboModalContentProps) {
  return <bem.KoboModal__content>{props.children}</bem.KoboModal__content>;
}
