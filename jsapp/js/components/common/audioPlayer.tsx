import React from 'react'
import autoBind from 'react-autobind'
import bem, {makeBem} from 'js/bem'
import KoboRange from 'js/components/common/koboRange'
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

/**
 * Custom audio player for viewing audio submissions in data table
 *
 * @param {string} mediaURL
 */
class AudioPlayer extends React.Component<AudioPlayerProps, AudioPlayerState> {
  audioInterface: HTMLAudioElement

  constructor(props: AudioPlayerProps) {
    super(props)

    this.state = {
      isLoading: false,
      isPlaying: false,
      currentTime: 0,
      totalTime: 0,
    }

    this.audioInterface = new Audio(this.props.mediaURL)

    // Set up listeners for audio component
    this.audioInterface.onloadedmetadata = () => {
      this.setState({
        totalTime: this.audioInterface.duration,
      })
    }

    this.audioInterface.ontimeupdate = () => {
      // Pause the player when it reaches the end
      if (
        this.audioInterface.currentTime === this.state.totalTime &&
        this.state.isPlaying
      ) {
        this.onPlayStatusChange()
      }

      this.setState({
        currentTime: this.audioInterface.currentTime,
      })
    }

    autoBind(this)
  }

  componentWillUnmount() {
    this.audioInterface.pause()
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

  /* We deal internally with un-converted time for easier computing. Only use
   * this when it's time to display
   *
   * @param {float} time - HTMLElementAudio.duration returns a float in seconds
   */

  convertToClock(time: number) {
    let minutes = Math.floor(time / 60)
    // The duration is given in decimal seconds, so we have to do ceiling here
    let seconds = Math.ceil(time - minutes * 60)

    let finalSeconds: string;
    if (seconds < 10) {
      finalSeconds = '0' + seconds
    } else {
      finalSeconds = String(seconds)
    }

    return minutes + ':' + finalSeconds
  }

  getControlIcon(isPlaying: boolean) {
    const iconClassNames = ['k-icon']

    if (isPlaying) {
      iconClassNames.push('k-icon-pause')
    } else {
      iconClassNames.push('k-icon-caret-right')
    }

    return iconClassNames.join(' ')
  }

  render() {
    return (
      <bem.AudioPlayer>
        <bem.AudioPlayer__controls>
          <i
            className={this.getControlIcon(this.state.isPlaying)}
            onClick={this.onPlayStatusChange}
          />
        </bem.AudioPlayer__controls>

        <KoboRange
          max={this.state.totalTime}
          value={this.state.currentTime}
          isTime={true}
          onChange={this.onSeekChange}
        />
      </bem.AudioPlayer>
    )
  }
}

export default AudioPlayer
