import React from 'react';
import bem, {makeBem} from 'js/bem';
import Icon from 'js/components/common/icon';
import Button from 'js/components/common/button';
import {
  formatSeconds,
  generateUid,
} from 'js/utils';
import 'js/components/common/miniAudioPlayer.scss';

bem.MiniAudioPlayer = makeBem(null, 'mini-audio-player');
bem.MiniAudioPlayer__time = makeBem(bem.MiniAudioPlayer, 'time', 'time');

interface MiniAudioPlayerProps {
  mediaURL: string;
  'data-cy'?: string;
}

interface MiniAudioPlayerState {
  isLoading: boolean;
  isPlaying: boolean;
  isBroken?: boolean;
  currentTime: number;
  totalTime: number;
}

const PLAYER_STARTED_EVENT = 'MiniAudioPlayer:started';

/** Custom audio player to be placed inline in small containers. */
class MiniAudioPlayer extends React.Component<MiniAudioPlayerProps, MiniAudioPlayerState> {
  audioInterface: HTMLAudioElement = new Audio();
  /** Useful for stopping. */
  uid = generateUid();

  private onAudioLoadedBound = this.onAudioLoaded.bind(this);
  private onAudioErrorBound = this.onAudioError.bind(this);
  private onAudioTimeUpdatedBound = this.onAudioTimeUpdated.bind(this);
  private onAnyPlayerStartedBound = this.onAnyPlayerStarted.bind(this);

  constructor(props: MiniAudioPlayerProps) {
    super(props);

    this.state = {
      isLoading: true,
      isPlaying: false,
      currentTime: 0,
      totalTime: 0,
    };
  }

  componentDidMount() {
    // Prepare audio.
    this.audioInterface = new Audio(this.props.mediaURL);

    // Set up listeners for audio component.
    this.audioInterface.addEventListener('loadedmetadata', this.onAudioLoadedBound);
    this.audioInterface.addEventListener('error', this.onAudioErrorBound);
    this.audioInterface.addEventListener('timeupdate', this.onAudioTimeUpdatedBound);
    document.addEventListener(PLAYER_STARTED_EVENT, this.onAnyPlayerStartedBound);
  }

  componentWillUnmount() {
    // Pausing makes it subject to garbage collection.
    this.audioInterface.pause();

    this.audioInterface.removeEventListener('loadedmetadata', this.onAudioLoadedBound);
    this.audioInterface.removeEventListener('error', this.onAudioErrorBound);
    this.audioInterface.removeEventListener('timeupdate', this.onAudioTimeUpdatedBound);
    document.removeEventListener(PLAYER_STARTED_EVENT, this.onAnyPlayerStartedBound);
  }

  onAnyPlayerStarted(evt: CustomEventInit<string>) {
    if (this.state.isPlaying && evt.detail !== this.uid) {
      this.stop();
    }
  }

  onAudioError() {
    this.setState({
      isLoading: false,
      isBroken: true,
    });
  }

  onAudioLoaded() {
    this.setState({
      isLoading: false,
      totalTime: this.audioInterface.duration,
    });
  }

  onAudioTimeUpdated() {
    // Pause the player when it reaches the end
    if (
      this.audioInterface.currentTime === this.state.totalTime &&
      this.state.isPlaying
    ) {
      this.stop();
    }

    this.setState({currentTime: this.audioInterface.currentTime});
  }

  onButtonClick() {
    if (!this.state.isPlaying) {
      this.start();
    } else {
      this.stop();
    }

    this.setState({
      isPlaying: !this.state.isPlaying,
    });
  }

  start() {
    this.audioInterface.play();
    const event = new CustomEvent(PLAYER_STARTED_EVENT, {detail: this.uid});
    document.dispatchEvent(event);
  }

  stop() {
    // Setting time to 0 and pausing is a silly way to "stop" audio.
    this.audioInterface.currentTime = 0;
    this.audioInterface.pause();
    this.setState({
      currentTime: 0,
      isPlaying: false,
    });
  }

  renderPlayer() {
    return (
      <React.Fragment>
        <Button
          type='bare'
          startIcon={this.state.isPlaying ? 'stop' : 'play'}
          size='s'
          color='blue'
          onClick={this.onButtonClick.bind(this)}
          data-cy='mini audio player playstop'
        />

        <bem.MiniAudioPlayer__time dateTime={this.state.totalTime}>
          {this.state.isPlaying && formatSeconds(this.state.currentTime)}
          {!this.state.isPlaying && formatSeconds(this.state.totalTime)}
        </bem.MiniAudioPlayer__time>
      </React.Fragment>
    );
  }

  renderLoading() {
    return (
      <React.Fragment>
        <Button
          type='bare'
          startIcon='play'
          size='s'
          color='blue'
          onClick={() => null}
          isDisabled
        />

        <bem.MiniAudioPlayer__time>--:--</bem.MiniAudioPlayer__time>
      </React.Fragment>
    );
  }

  renderError() {
    return (
      <React.Fragment data-tip={t('Could not load media file')}>
        <Icon name='alert' size='l'/>

        <bem.MiniAudioPlayer__time>--:--</bem.MiniAudioPlayer__time>
      </React.Fragment>
    );
  }

  render() {
    const modifiers = [];

    if (this.state.isLoading) {
      modifiers.push('is-loading');
    }

    if (this.state.isBroken) {
      modifiers.push('is-broken');
    }

    return (
      <bem.MiniAudioPlayer data-cy={this.props['data-cy']} m={modifiers}>
        {this.state.isLoading &&
          this.renderLoading()
        }
        {!this.state.isLoading && this.state.isBroken &&
          this.renderError()
        }
        {!this.state.isLoading && !this.state.isBroken &&
          this.renderPlayer()
        }
      </bem.MiniAudioPlayer>
    );
  }
}

export default MiniAudioPlayer;
