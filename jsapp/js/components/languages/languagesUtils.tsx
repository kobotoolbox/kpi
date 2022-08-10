import React from 'react';
import languagesStore from './languagesStore';
import type {LanguageCode} from './languagesStore';

interface LanguageDisplayLabelProps {
  code: LanguageCode;
  name: string;
}

/**
 * A simpler alternative to `AsyncLanguageDisplayLabel` for situations when you
 * already possess all necessary data.
 */
export class LanguageDisplayLabel extends React.Component<LanguageDisplayLabelProps> {
  render() {
    return <span>{this.props.name}&nbsp;<small>({this.props.code})</small></span>;
  }
}

interface AsyncLanguageDisplayLabelProps {
  code: LanguageCode;
}
interface AsyncLanguageDisplayLabelState {
  name?: string;
}

/**
 * Ultimately displays the same thing as `LanguageDisplayLabel`, but requires
 * only a single language code and fetches stuff in the background.
 * In reality it would rarely cause a backend call, as would mostly rely on
 * memoized data (an assumption).
 */
export class AsyncLanguageDisplayLabel extends React.Component<
  AsyncLanguageDisplayLabelProps,
  AsyncLanguageDisplayLabelState
> {
  constructor(props: AsyncLanguageDisplayLabelProps) {
    super(props);
    this.state = {};
  }

  componentDidMount() {
    this.getData();
  }

  async getData() {
    const name = await languagesStore.getLanguageName(this.props.code);
    this.setState({name: name});
  }

  render() {
    if (!this.state.name) {
      return <span>…</span>;
    }
    return <LanguageDisplayLabel code={this.props.code} name={this.state.name}/>;
  }
}

/**
 * To be used when you need a string, and can't use `LanguageDisplayLabel` or
 * `AsyncLanguageDisplayLabel` (they both produce a `JSX.Element`).
 */
export function getLanguageDisplayLabel(name: string, code: LanguageCode) {
  return `${name} (${code})`;
}
