import type {ButtonProps} from 'js/components/common/button';
import Button from 'js/components/common/button';
import React from 'react';
import {button} from './planButton.module.scss';

export default function PlanButton(props: Partial<ButtonProps>) {
  return (
    <Button
      type='full'
      color='blue'
      size='l'
      {...props}
      classNames={props.classNames ? [button, ...props.classNames] : [button]}
    />
  );
}
