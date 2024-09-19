import Button from './button';

import {render, screen} from '@testing-library/react';
import {describe, it, expect, jest} from '@jest/globals';
import userEvent from '@testing-library/user-event';

describe('Button renders', () => {
  it('Should render and be clickable when enabled', async () => {
    const user = userEvent.setup();

    // Mock
    const handleClickFunction = jest.fn();

    // Render
    render(
      <Button
        type={'primary'}
        size={'l'}
        label='Button Label'
        onClick={handleClickFunction}
      />
    );

    // Act
    const button = screen.getByLabelText('Button Label');
    await user.click(button);

    // Assert
    expect(button).toBeInTheDocument();
    expect(handleClickFunction).toHaveBeenCalled();
  });

  it('Should render and not be clickable when disabled', async () => {
    const user = userEvent.setup();

    // Mock
    const handleClickFunction = jest.fn();

    // Render
    render(
      <Button
        type={'primary'}
        size={'l'}
        label='Button Label'
        onClick={handleClickFunction}
        isDisabled
      />
    );

    // Act
    const button = screen.getByLabelText('Button Label');
    await user.click(button);

    // Assert
    expect(button).toBeInTheDocument();
    expect(handleClickFunction).not.toHaveBeenCalled();
  });
});
