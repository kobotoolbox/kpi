import {fireEvent, render, screen} from '@testing-library/react';
import {describe, it, expect, jest} from '@jest/globals';
import userEvent from '@testing-library/user-event';
import type {KoboSelectOption} from './koboAccessibleSelect';
import KoboSelect3 from './koboAccessibleSelect';
import {useState} from 'react';

const options: KoboSelectOption[] = [
  {value: '1', label: 'Option 1'},
  {value: '2', label: 'Option 2'},
  {value: '3', label: 'Option 3'},
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
  it('Should respond to mouse interaction', async () => {
    const user = userEvent.setup();

    // Mock
    const scrollIntoViewMock = jest.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;
    const onChangeMock = jest.fn();

    // Render
    render(<Wrapper onChange={onChangeMock} />);

    // Actors
    const trigger = screen.getByRole('combobox');
    const triggerLabel = trigger.querySelector('label');
    const list = screen.getByRole('listbox');
    const listOptions = screen.getAllByRole('option');


    // Trigger should be present and have the correct placeholder
    expect(trigger).toBeInTheDocument();
    expect(triggerLabel).toHaveTextContent('Select…');


    // There should be 3 options
    expect(listOptions).toHaveLength(3);

    // List should not be expanded on creation
    expect(list.dataset.expanded).toBe('false');

    // Clicks the trigger
    await user.click(trigger);
    expect(scrollIntoViewMock).toHaveBeenCalled();

    // List should be expanded after click
    expect(list.dataset.expanded).toBe('true');

    // Select first option
    await user.click(listOptions[0]);

    // Onchange should be called with the correct value
    expect(onChangeMock).lastCalledWith('1');

    // List should be collapsed after selection
    expect(list.dataset.expanded).toBe('false');
  });

  it('Should respond to keyboard interaction', async () => {
    // Mock
    const onChangeMock = jest.fn();

    // Render
    render(<Wrapper onChange={onChangeMock} />);

    // Actors
    const trigger = screen.getByRole('combobox');
    const triggerLabel = trigger.querySelector('label');
    const list = screen.getByRole('listbox');
    const listOptions = screen.getAllByRole('option');


    // Trigger should be present and have the correct placeholder
    expect(trigger).toBeInTheDocument();
    expect(triggerLabel).toHaveTextContent('Select…');


    // There should be 3 options
    expect(listOptions).toHaveLength(3);

    // List should not be expanded on creation
    expect(list.dataset.expanded).toBe('false');

    // Increase option on arrow down
    fireEvent.keyDown(trigger, {key: 'ArrowDown'});
    expect(onChangeMock).lastCalledWith('1');
    fireEvent.keyDown(trigger, {key: 'ArrowDown'});
    expect(onChangeMock).lastCalledWith('2');
    fireEvent.keyDown(trigger, {key: 'ArrowDown'});
    expect(onChangeMock).lastCalledWith('3');

    // Decrease option on arrow up
    fireEvent.keyDown(trigger, {key: 'ArrowUp'});
    expect(onChangeMock).lastCalledWith('2');
    fireEvent.keyDown(trigger, {key: 'ArrowUp'});
    expect(onChangeMock).lastCalledWith('1');

    // Open list on Alt + ArrowDown
    fireEvent.keyDown(trigger, {key: 'ArrowDown', altKey: true});
    expect(list.dataset.expanded).toBe('true');

    // Close list on Escape
    fireEvent.keyDown(trigger, {key: 'Escape'});
    expect(list.dataset.expanded).toBe('false');

    // Toggle list on Alt + ArrowDown
    fireEvent.keyDown(trigger, {key: 'ArrowDown', altKey: true});
    expect(list.dataset.expanded).toBe('true');
    fireEvent.keyDown(trigger, {key: 'ArrowDown', altKey: true});
    expect(list.dataset.expanded).toBe('false');

    // Toggle list on Alt + ArrowUp
    fireEvent.keyDown(trigger, {key: 'ArrowUp', altKey: true});
    expect(list.dataset.expanded).toBe('true');
    fireEvent.keyDown(trigger, {key: 'ArrowUp', altKey: true});
    expect(list.dataset.expanded).toBe('false');

    // Open menu, navigate and select option on Enter
    fireEvent.keyDown(trigger, {key: 'ArrowDown', altKey: true});
    fireEvent.keyDown(trigger, {key: 'ArrowDown'});
    fireEvent.keyDown(trigger, {key: 'Enter'});
    expect(onChangeMock).lastCalledWith('2');

    // List should be collapsed after selection
    expect(list.dataset.expanded).toBe('false');
  });

});
