import React from 'react';
import singleProcessingStore from 'js/components/processing/singleProcessingStore';
import Button from 'js/components/common/button';
import type {LanguageCode} from 'js/components/languages/languagesStore';
import {
  hasTranscriptServicesAvailable,
  hasTranslationServicesAvailable,
} from 'js/components/languages/languagesUtils';
import envStore from 'js/envStore';

interface TransxAutomaticButtonProps {
  onClick: () => void;
  selectedLanguage?: LanguageCode;
  /** Which type of service the button should check availability for. */
  type: 'transcript' | 'translation';
}

interface TransxAutomaticButtonState {
  isLoading: boolean;
  isAvailable: boolean;
}

/**
 * Wrapper for "automatic" button being displayed in config step for transcript
 * and translations tabs. We need it separately for DRY async data fetching.
 */
export default class TransxAutomaticButton extends React.Component<
  TransxAutomaticButtonProps,
  TransxAutomaticButtonState
> {
  private unlisteners: Function[] = [];

  constructor(props: TransxAutomaticButtonProps) {
    super(props);
    this.state = {
      isLoading: false,
      isAvailable: false,
    };
  }

  componentDidMount() {
    this.unlisteners.push(
      singleProcessingStore.listen(this.onSingleProcessingStoreChange, this)
    );
    this.checkAvailability();
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {
      clb();
    });
  }

  componentDidUpdate(prevProps: TransxAutomaticButtonProps) {
    if (prevProps.selectedLanguage !== this.props.selectedLanguage) {
      this.checkAvailability();
    }
  }

  /**
   * Don't want to store a duplicate of store data here just for the sake of
   * comparison, so we need to make the component re-render itself when the
   * store changes :shrug:.
   */
  onSingleProcessingStoreChange() {
    this.forceUpdate();
  }

  async checkAvailability() {
    const languageCode = this.props.selectedLanguage;

    // If there is no language selected, we simply reset properties and stop.
    if (languageCode === undefined) {
      this.setState({
        isLoading: false,
        isAvailable: false,
      });
      return;
    }

    this.setState({
      isLoading: true,
      isAvailable: false,
    });

    let hasServicesAvailable = false;
    try {
      if (this.props.type === 'transcript') {
        hasServicesAvailable = await hasTranscriptServicesAvailable(
          languageCode
        );
      }
      if (this.props.type === 'translation') {
        hasServicesAvailable = await hasTranslationServicesAvailable(
          languageCode
        );
      }
    } catch (error) {
      console.error(`Language ${languageCode} not found 3`);
    } finally {
      // Safety check if props didn't change during the wait.
      if (languageCode === this.props.selectedLanguage) {
        this.setState({
          isLoading: false,
          isAvailable: hasServicesAvailable,
        });
      }
    }
  }

  render() {
    if (!envStore.data.asr_mt_features_enabled) {
      // We hide button for users that don't have access to the feature.
      return null;
    } else {
      return (
        <Button
          type='primary'
          size='m'
          label={t('automatic')}
          onClick={this.props.onClick}
          isDisabled={!this.state.isAvailable}
          isPending={
            singleProcessingStore.data.isFetchingData || this.state.isLoading
          }
        />
      );
    }
  }
}
