import Button from './button';

import {render, screen} from '@testing-library/react';
import {describe, it, expect, jest} from '@jest/globals';
import userEvent from '@testing-library/user-event';

const user = userEvent.setup();

describe('Enabled button', () => {
  // Mock
  const handleClickFunction = jest.fn();

  beforeEach(() => {
    render(
      <Button
        type='primary'
        size='l'
        label='Button Label'
        onClick={handleClickFunction}
      />
    );
  });

  it('should render', async () => {
    // Assert
    expect(screen.getByLabelText('Button Label')).toBeInTheDocument();
  });

  it('should be clickable', async () => {
    // Act
    const button = screen.getByLabelText('Button Label');
    await user.click(button);

    expect(handleClickFunction).toHaveBeenCalledTimes(1);
  });
});

describe('Disabled button', () => {
  // Mock
  const handleClickFunction = jest.fn();

  beforeEach(() => {
    render(
      <Button
        type='primary'
        size='l'
        label='Button Label'
        onClick={handleClickFunction}
        isDisabled
      />
    );
  });

  it('should render', async () => {
    // Assert
    expect(screen.getByLabelText('Button Label')).toBeInTheDocument();
  });

  it('should not be clickable', async () => {
    // Act
    const button = screen.getByLabelText('Button Label');
    await user.click(button);

    expect(handleClickFunction).not.toHaveBeenCalled();
  });
});
