import {fireEvent, render, screen} from '@testing-library/react';
import {describe, it, expect, jest} from '@jest/globals';
import userEvent from '@testing-library/user-event';
import type {KoboSelectOption} from './koboAccessibleSelect';
import KoboSelect3 from './koboAccessibleSelect';
import {useState} from 'react';

const options: KoboSelectOption[] = [
  {value: '1', label: 'Apple'},
  {value: '2', label: 'Banana'},
  {value: '3', label: 'Avocado'},
];

// A wrapper is needed for the component to retain value changes
const Wrapper = ({onChange}: {onChange: (newValue: string) => void}) => {
  const [value, setValue] = useState<string>('');

  const handleChange = (newValue: string | null = '') => {
    setValue(newValue || '');
    onChange(newValue || '');
  };

  return (
    <KoboSelect3
      name='testSelect'
      options={options}
      value={value}
      onChange={handleChange}
    />
  );
};


describe('KoboSelect3', () => {
  const user = userEvent.setup();

  // Mock
  const scrollIntoViewMock = jest.fn();
  window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;
  const onChangeMock = jest.fn();

  beforeEach(() => {
    render(<Wrapper onChange={onChangeMock} />);
  });

  it('should render with proper placeholder', async () => {
    const trigger = screen.getByRole('combobox');
    const triggerLabel = trigger.querySelector('label');
    expect(trigger).toBeInTheDocument();
    expect(triggerLabel).toHaveTextContent('Select…');
  });

  it('should have the list closed on start', async () => {
    const list = screen.getByRole('listbox');
    expect(list.dataset.expanded).toBe('false');
  });

  it('should have a list with the correct items count', async () => {
    const listOptions = screen.getAllByRole('option');
    expect(listOptions).toHaveLength(3);
  });

  it('should be selectable by mouse click', async () => {
      const trigger = screen.getByRole('combobox');
      const list = screen.getByRole('listbox');
      const listOptions = screen.getAllByRole('option');

      // Clicks the trigger
      await user.click(trigger);
      expect(list.dataset.expanded).toBe('true');

      // Select first option
      await user.click(listOptions[0]);

      // Onchange should be called with the correct value
      expect(onChangeMock).lastCalledWith(options[0].value);

      expect(list.dataset.expanded).toBe('false');
  });

  it('should be selectable by keyboard arrows', async () => {
      const trigger = screen.getByRole('combobox');
      const triggerLabel = trigger.querySelector('label');

      // No item selected
      expect(triggerLabel).toHaveTextContent('Select…');

      // Increase option on arrow down
      fireEvent.keyDown(trigger, {key: 'ArrowDown'});
      expect(onChangeMock).lastCalledWith(options[0].value);
      expect(triggerLabel).toHaveTextContent(options[0].label);

      // Increase option on arrow right
      fireEvent.keyDown(trigger, {key: 'ArrowRight'});
      expect(onChangeMock).lastCalledWith(options[1].value);
      expect(triggerLabel).toHaveTextContent(options[1].label);
      fireEvent.keyDown(trigger, {key: 'ArrowRight'});
      expect(onChangeMock).lastCalledWith(options[2].value);
      expect(triggerLabel).toHaveTextContent(options[2].label);

      // Don't go past the last one
      onChangeMock.mockReset();
      fireEvent.keyDown(trigger, {key: 'ArrowDown'});
      expect(onChangeMock).not.toHaveBeenCalled();
      expect(triggerLabel).toHaveTextContent(options[2].label);

      // Decrease option on arrow up
      fireEvent.keyDown(trigger, {key: 'ArrowUp'});
      expect(onChangeMock).lastCalledWith(options[1].value);
      expect(triggerLabel).toHaveTextContent(options[1].label);

      // Decrease option on arrow left
      fireEvent.keyDown(trigger, {key: 'ArrowLeft'});
      expect(onChangeMock).lastCalledWith(options[0].value);
      expect(triggerLabel).toHaveTextContent(options[0].label);

      // Don't go past the first one
      onChangeMock.mockReset();
      fireEvent.keyDown(trigger, {key: 'ArrowUp'});
      expect(onChangeMock).not.toHaveBeenCalled();
      expect(triggerLabel).toHaveTextContent(options[0].label);
  });

  it('should be selectable by typing', async () => {
      const trigger = screen.getByRole('combobox');
      const triggerLabel = trigger.querySelector('label');

      // No item selected
      expect(triggerLabel).toHaveTextContent('Select…');

      // Type 'b' to select Banana
      fireEvent.keyDown(trigger, {key: 'b'});
      expect(onChangeMock).lastCalledWith(options[1].value);
      expect(triggerLabel).toHaveTextContent(options[1].label);
  });
});
