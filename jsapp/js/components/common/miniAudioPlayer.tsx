import React, {createRef} from 'react';
import bem, {makeBem} from 'js/bem';
import Icon from 'js/components/common/icon';
import Button from 'js/components/common/button';
import {formatSeconds, generateUuid, notify} from 'js/utils';
import 'js/components/common/miniAudioPlayer.scss';

bem.MiniAudioPlayer = makeBem(null, 'mini-audio-player');
bem.MiniAudioPlayer__time = makeBem(bem.MiniAudioPlayer, 'time', 'time');

interface MiniAudioPlayerProps {
  /** Not adviseable when you display multiple players at once. */
  preload?: boolean;
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
class MiniAudioPlayer extends React.Component<
  MiniAudioPlayerProps,
  MiniAudioPlayerState
> {
  audioRef = createRef<HTMLAudioElement>();
  /** Useful for stopping. */
  uid = generateUuid();

  private onAudioLoadedBound = this.onAudioLoaded.bind(this);
  private onAudioErrorBound = this.onAudioError.bind(this);
  private onAudioTimeUpdatedBound = this.onAudioTimeUpdated.bind(this);
  private onAnyPlayerStartedBound = this.onAnyPlayerStarted.bind(this);

  constructor(props: MiniAudioPlayerProps) {
    super(props);

    this.state = {
      // If we don't preload, there is nothing to load
      isLoading: !!this.props.preload,
      isPlaying: false,
      currentTime: 0,
      totalTime: 0,
    };
  }

  componentDidUpdate(prevProps: MiniAudioPlayerProps) {
    if (prevProps.mediaURL !== this.props.mediaURL) {
      // If the URL changed, and `preload` is not enabled, we need to clear the
      // time from previous file.
      if (!this.props.preload) {
        this.setState({
          currentTime: 0,
          totalTime: 0,
        });
      }
    }
  }

  componentDidMount() {
    // Set up listener for custom event
    document.addEventListener(
      PLAYER_STARTED_EVENT,
      this.onAnyPlayerStartedBound
    );
  }

  componentWillUnmount() {
    // We know that audioRef will be ready each time we use audioRef.current
    /* eslint-disable @typescript-eslint/no-non-null-assertion */
    // (But you may wish to re-enable this rule while working on this file.)

    // Pausing makes it subject to garbage collection.
    this.audioRef.current!.pause();

    document.removeEventListener(
      PLAYER_STARTED_EVENT,
      this.onAnyPlayerStartedBound
    );
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
      isBroken: false,
      totalTime: this.audioRef.current!.duration,
    });
  }

  onAudioTimeUpdated() {
    // Pause the player when it reaches the end
    if (
      this.audioRef.current!.currentTime === this.state.totalTime &&
      this.state.isPlaying
    ) {
      this.stop();
    }

    this.setState({currentTime: this.audioRef.current!.currentTime});
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
    const playPromise = this.audioRef.current!.play();
    playPromise.then(() => {
      const event = new CustomEvent(PLAYER_STARTED_EVENT, {detail: this.uid});
      document.dispatchEvent(event);
    }).catch((reason) => {
      notify.error(reason.name + ' ' + reason.message);
    });
  }

  stop() {
    // Setting time to 0 and pausing is a silly way to "stop" audio.
    this.audioRef.current!.currentTime = 0;
    this.audioRef.current!.pause();
    this.setState({
      currentTime: 0,
      isPlaying: false,
    });
  }

  renderPlayer() {
    return (
      <React.Fragment>
        <Button
          type='text'
          startIcon={this.state.isPlaying ? 'stop' : 'play'}
          size='s'
          onClick={this.onButtonClick.bind(this)}
          data-cy='mini audio player playstop'
        />

        {this.state.totalTime > 0 && (
          <bem.MiniAudioPlayer__time dateTime={this.state.totalTime}>
            {this.state.isPlaying && formatSeconds(this.state.currentTime)}
            {!this.state.isPlaying && formatSeconds(this.state.totalTime)}
          </bem.MiniAudioPlayer__time>
        )}
      </React.Fragment>
    );
  }

  renderLoading() {
    return (
      <React.Fragment>
        <Button
          type='text'
          startIcon='play'
          size='s'
          onClick={() => null}
          isDisabled
        />

        <bem.MiniAudioPlayer__time>--:--</bem.MiniAudioPlayer__time>
      </React.Fragment>
    );
  }

  renderError() {
    return (
      <React.Fragment>
        <Icon name='alert' size='s' />

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

    const additionalProps = {
      'data-tip': this.state.isBroken
        ? t('Could not load media file')
        : undefined,
    };

    return (
      <bem.MiniAudioPlayer
        data-cy={this.props['data-cy']}
        m={modifiers}
        {...additionalProps}
      >
        <audio
          ref={this.audioRef}
          src={this.props.mediaURL}
          // NOTE: 'metadata' causes an immediate download of part of the file
          // (to get the metadata), usually requires around 30-50KB, but it may
          // vary. Some browser may simply download whole file.
          preload={this.props.preload ? 'metadata' : 'none'}
          onLoadedMetadata={this.onAudioLoadedBound}
          onTimeUpdate={this.onAudioTimeUpdatedBound}
          onError={this.onAudioErrorBound}
        />
        {this.state.isLoading && this.renderLoading()}
        {!this.state.isLoading && this.state.isBroken && this.renderError()}
        {!this.state.isLoading && !this.state.isBroken && this.renderPlayer()}
      </bem.MiniAudioPlayer>
    );
  }
}

export default MiniAudioPlayer;
