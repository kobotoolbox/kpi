import React from 'react'
import bem, {makeBem} from 'js/bem'
import KoboRange from 'js/components/common/koboRange'
import LoadingSpinner from 'js/components/common/loadingSpinner'
import Button from 'js/components/common/button'
import 'js/components/common/audioPlayer.scss'

bem.AudioPlayer = makeBem(null, 'audio-player')
bem.AudioPlayer__controls = makeBem(bem.AudioPlayer, 'controls', 'div')
bem.AudioPlayer__progress = makeBem(bem.AudioPlayer, 'progress', 'div')
bem.AudioPlayer__time = makeBem(bem.AudioPlayer, 'time', 'div')
bem.AudioPlayer__timeCurrent = makeBem(bem.AudioPlayer, 'time-current', 'span')
bem.AudioPlayer__timeTotal = makeBem(bem.AudioPlayer, 'time-total', 'span')
bem.AudioPlayer__seek = makeBem(bem.AudioPlayer, 'seek', 'div')

type AudioPlayerProps = {
  mediaURL: string
}

type AudioPlayerState = {
  isLoading: boolean,
  isPlaying: boolean,
  currentTime: number,
  totalTime: number,
}

/** Custom audio player for viewing audio submissions in data table */
class AudioPlayer extends React.Component<AudioPlayerProps, AudioPlayerState> {
  audioInterface: HTMLAudioElement = new Audio()

  constructor(props: AudioPlayerProps) {
    super(props)

    this.state = {
      isLoading: true,
      isPlaying: false,
      currentTime: 0,
      totalTime: 0,
    }
  }

  componentDidMount() {
    this.prepareAudio()
  }

  componentWillUnmount() {
    this.audioInterface.pause()
  }

  prepareAudio() {
    this.audioInterface = new Audio(this.props.mediaURL)

    // Set up listeners for audio component
    this.audioInterface.onloadedmetadata = this.onAudioLoaded.bind(this)

    this.audioInterface.ontimeupdate = this.onAudioTimeUpdated.bind(this)
  }

  onAudioLoaded() {
    this.setState({
      isLoading: false,
      totalTime: this.audioInterface.duration,
    })
  }

  onAudioTimeUpdated() {
    // Pause the player when it reaches the end
    if (
      this.audioInterface.currentTime === this.state.totalTime &&
      this.state.isPlaying
    ) {
      this.onPlayStatusChange()
    }

    this.setState({currentTime: this.audioInterface.currentTime})
  }

  onPlayStatusChange() {
    if (!this.state.isPlaying) {
      this.audioInterface.play()
    } else {
      this.audioInterface.pause()
    }

    this.setState({
      isPlaying: !this.state.isPlaying,
    })
  }

  onSeekChange(newTime: string) {
    this.audioInterface.currentTime = parseInt(newTime)

    this.setState({
      currentTime: parseInt(newTime),
    })
  }

  render() {
    return (
      <bem.AudioPlayer>
        {this.state.isLoading &&
          <LoadingSpinner/>
        }
        {!this.state.isLoading &&
          <bem.AudioPlayer__controls>
            <Button
              type='bare'
              startIcon={this.state.isPlaying ? 'pause' : 'caret-right'}
              size='l'
              color='blue'
              onClick={this.onPlayStatusChange.bind(this)}
            />
          </bem.AudioPlayer__controls>
        }

        {!this.state.isLoading &&
          <KoboRange
            max={this.state.totalTime}
            value={this.state.currentTime}
            isTime={true}
            onChange={this.onSeekChange.bind(this)}
          />
        }
      </bem.AudioPlayer>
    )
  }
}

export default AudioPlayer
