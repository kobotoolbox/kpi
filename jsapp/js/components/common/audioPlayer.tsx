import React from 'react';
import bem, {makeBem} from 'js/bem';
import KoboRange from 'js/components/common/koboRange';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import InlineMessage from 'js/components/common/inlineMessage';
import Button from 'js/components/common/button';
import 'js/components/common/audioPlayer.scss';

bem.AudioPlayer = makeBem(null, 'audio-player');
bem.AudioPlayer__controls = makeBem(bem.AudioPlayer, 'controls', 'div');
bem.AudioPlayer__progress = makeBem(bem.AudioPlayer, 'progress', 'div');
bem.AudioPlayer__time = makeBem(bem.AudioPlayer, 'time', 'div');
bem.AudioPlayer__timeCurrent = makeBem(bem.AudioPlayer, 'time-current', 'span');
bem.AudioPlayer__timeTotal = makeBem(bem.AudioPlayer, 'time-total', 'span');
bem.AudioPlayer__seek = makeBem(bem.AudioPlayer, 'seek', 'div');

interface AudioPlayerProps {
  mediaURL: string;
  'data-cy'?: string;
}

interface AudioPlayerState {
  isLoading: boolean;
  isPlaying: boolean;
  isBroken?: boolean;
  currentTime: number;
  totalTime: number;
}

/** Custom audio player for viewing audio submissions in data table */
class AudioPlayer extends React.Component<AudioPlayerProps, AudioPlayerState> {
  audioInterface: HTMLAudioElement = new Audio();

  private onAudioLoadedBound = this.onAudioLoaded.bind(this);
  private onAudioErrorBound = this.onAudioError.bind(this);
  private onAudioTimeUpdatedBound = this.onAudioTimeUpdated.bind(this);

  constructor(props: AudioPlayerProps) {
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
  }

  componentWillUnmount() {
    // Pausing makes it subject to garbage collection.
    this.audioInterface.pause();

    this.audioInterface.removeEventListener('loadedmetadata', this.onAudioLoadedBound);
    this.audioInterface.removeEventListener('error', this.onAudioErrorBound);
    this.audioInterface.removeEventListener('timeupdate', this.onAudioTimeUpdatedBound);
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
      this.onPlayStatusChange();
    }

    this.setState({currentTime: this.audioInterface.currentTime});
  }

  onPlayStatusChange() {
    if (!this.state.isPlaying) {
      this.audioInterface.play();
    } else {
      this.audioInterface.pause();
    }

    this.setState({
      isPlaying: !this.state.isPlaying,
    });
  }

  onSeekChange(newTime: string) {
    this.audioInterface.currentTime = parseInt(newTime);

    this.setState({
      currentTime: parseInt(newTime),
    });
  }

  renderPlayer() {
    return (
      <React.Fragment>
        <bem.AudioPlayer__controls>
          <Button
            type='bare'
            startIcon={this.state.isPlaying ? 'pause' : 'caret-right'}
            size='l'
            color='blue'
            onClick={this.onPlayStatusChange.bind(this)}
          />
        </bem.AudioPlayer__controls>

        <KoboRange
          max={this.state.totalTime}
          value={this.state.currentTime}
          isTime
          onChange={this.onSeekChange.bind(this)}
        />
      </React.Fragment>
    );
  }

  render() {
    return (
      <bem.AudioPlayer data-cy={this.props['data-cy']}>
        {this.state.isLoading &&
          <LoadingSpinner/>
        }
        {!this.state.isLoading && this.state.isBroken &&
          <InlineMessage
            type='error'
            message={t('Could not load media file')}
          />
        }
        {!this.state.isLoading && !this.state.isBroken &&
          this.renderPlayer()
        }
      </bem.AudioPlayer>
    );
  }
}

export default AudioPlayer;
