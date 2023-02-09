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
  isLoading: boolean;
}

/**
 * Ultimately displays the same thing as `LanguageDisplayLabel`, but requires
 * only a single language code and fetches stuff in the background.
 * In reality it would rarely cause a backend call, as would mostly rely on
 * memoized data (an assumption).
 *
 * Displays provided `LanguageCode` as fallback mechanism.
 */
export class AsyncLanguageDisplayLabel extends React.Component<
  AsyncLanguageDisplayLabelProps,
  AsyncLanguageDisplayLabelState
> {
  constructor(props: AsyncLanguageDisplayLabelProps) {
    super(props);
    this.state = {isLoading: true};
  }

  componentDidMount() {
    this.getData();
  }

  async getData() {
    this.setState({isLoading: true});
    try {
      const name = await languagesStore.getLanguageName(this.props.code);
      this.setState({
        name: name,
        isLoading: false,
      });
    } catch (error) {
      console.error(`Language ${this.props.code} not found 5`);
      this.setState({isLoading: false});
    }
  }

  render() {
    if (this.state.isLoading) {
      return <span>…</span>;
    }
    if (this.state.name) {
      return <LanguageDisplayLabel code={this.props.code} name={this.state.name}/>;
    }
    // Display code as fallback mechanism.
    return this.props.code;
  }
}

/**
 * To be used when you need a string, and can't use `LanguageDisplayLabel` or
 * `AsyncLanguageDisplayLabel` (they both produce a `JSX.Element`).
 */
export function getLanguageDisplayLabel(name: string, code: LanguageCode) {
  return `${name} (${code})`;
}

/** Checks if given language has any automated transcription services available. */
export async function hasTranscriptServicesAvailable(code: LanguageCode): Promise<boolean> {
  try {
    const language = await languagesStore.getLanguage(code);
    if (language) {
      return Object.keys(language.transcription_services).length >= 1;
    } else {
      return false;
    }
  } catch (error) {
    return false;
  }
}

/** Checks if given language has any automated translation services available. */
export async function hasTranslationServicesAvailable(code: LanguageCode): Promise<boolean> {
  try {
    const language = await languagesStore.getLanguage(code);
    if (language) {
      return Object.keys(language.transcription_services).length >= 1;
    } else {
      return false;
    }
  } catch (error) {
    return false;
  }
}
