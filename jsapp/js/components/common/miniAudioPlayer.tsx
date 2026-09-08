import '#/components/common/miniAudioPlayer.scss'

import React, { createRef } from 'react'

import { IconAlertCircleFilled, IconPlayerPlayFilled, IconPlayerStopFilled } from '@tabler/icons-react'
import bem, { makeBem } from '#/bem'
import ActionIcon from '#/components/common/ActionIcon'
import KoboIcon from '#/components/common/KoboIcon'
import { formatSeconds, generateUuid, notify } from '#/utils'

bem.MiniAudioPlayer = makeBem(null, 'mini-audio-player')
bem.MiniAudioPlayer__time = makeBem(bem.MiniAudioPlayer, 'time', 'time')

interface MiniAudioPlayerProps {
  /** Not adviseable when you display multiple players at once. */
  preload?: boolean
  mediaURL: string
  /**
   * Backend-calculated duration in whole seconds. When provided, it is shown
   * instead of the browser-decoded duration so the value matches the bulk
   * processing feature exactly. The browser value is still used for seeking
   * and the playhead while playing.
   */
  durationSeconds?: number
}

interface MiniAudioPlayerState {
  isLoading: boolean
  isPlaying: boolean
  isBroken?: boolean
  currentTime: number
  totalTime: number
}

const PLAYER_STARTED_EVENT = 'MiniAudioPlayer:started'
/** Shown while the real duration (backend or browser-decoded) isn't known yet. */
const DURATION_PLACEHOLDER = '00:00:00'
/** Shown when playback is broken. */
const ERROR_PLAYBACK_PLACEHOLDER = '--:--:--'

/** Custom audio player to be placed inline in small containers. */
class MiniAudioPlayer extends React.Component<MiniAudioPlayerProps, MiniAudioPlayerState> {
  audioRef = createRef<HTMLAudioElement>()
  /** Useful for stopping. */
  uid = generateUuid()

  private onAudioLoadedBound = this.onAudioLoaded.bind(this)
  private onAudioErrorBound = this.onAudioError.bind(this)
  private onAudioTimeUpdatedBound = this.onAudioTimeUpdated.bind(this)
  private onAnyPlayerStartedBound = this.onAnyPlayerStarted.bind(this)

  constructor(props: MiniAudioPlayerProps) {
    super(props)

    this.state = {
      // If we don't preload, there is nothing to load
      isLoading: !!this.props.preload,
      isPlaying: false,
      currentTime: 0,
      totalTime: 0,
    }
  }

  componentDidUpdate(prevProps: MiniAudioPlayerProps) {
    if (prevProps.mediaURL !== this.props.mediaURL) {
      // If the URL changed, and `preload` is not enabled, we need to clear the
      // time from previous file.
      if (!this.props.preload) {
        this.setState({
          currentTime: 0,
          totalTime: 0,
        })
      }
    }
  }

  componentDidMount() {
    // Set up listener for custom event
    document.addEventListener(PLAYER_STARTED_EVENT, this.onAnyPlayerStartedBound)
  }

  componentWillUnmount() {
    // We know that audioRef will be ready each time we use audioRef.current

    // (But you may wish to re-enable this rule while working on this file.)

    // Pausing makes it subject to garbage collection.
    this.audioRef.current!.pause()

    document.removeEventListener(PLAYER_STARTED_EVENT, this.onAnyPlayerStartedBound)
  }

  onAnyPlayerStarted(evt: CustomEventInit<string>) {
    if (this.state.isPlaying && evt.detail !== this.uid) {
      this.stop()
    }
  }

  onAudioError() {
    this.setState({
      isLoading: false,
      isBroken: true,
    })
  }

  onAudioLoaded() {
    this.setState({
      isLoading: false,
      isBroken: false,
      totalTime: this.audioRef.current!.duration,
    })
  }

  onAudioTimeUpdated() {
    // Pause the player when it reaches the end
    if (this.audioRef.current!.currentTime === this.state.totalTime && this.state.isPlaying) {
      this.stop()
    }

    this.setState({ currentTime: this.audioRef.current!.currentTime })
  }

  onButtonClick() {
    if (this.state.isPlaying) {
      this.stop()
    } else {
      this.start()
    }

    this.setState({
      isPlaying: !this.state.isPlaying,
    })
  }

  start() {
    const playPromise = this.audioRef.current!.play()
    playPromise
      .then(() => {
        const event = new CustomEvent(PLAYER_STARTED_EVENT, { detail: this.uid })
        document.dispatchEvent(event)
      })
      .catch((reason) => {
        notify.error(reason.name + ' ' + reason.message)
      })
  }

  stop() {
    // Setting time to 0 and pausing is a silly way to "stop" audio.
    this.audioRef.current!.currentTime = 0
    this.audioRef.current!.pause()
    this.setState({
      currentTime: 0,
      isPlaying: false,
    })
  }

  renderPlayer() {
    // Prefer the backend-calculated duration for the idle display so it matches
    // the bulk processing feature. Fall back to the browser-decoded duration
    // when the backend value isn't available.
    const totalTime = this.props.durationSeconds ?? this.state.totalTime

    // A backend duration of 0 is a real answer: the backend truncates, so any
    // recording under a second comes back as 0. We only hide the label while the
    // duration is still unknown, which for the browser-decoded value means 0.
    const isTotalTimeKnown = this.props.durationSeconds !== undefined || this.state.totalTime > 0

    return (
      <React.Fragment>
        <ActionIcon
          variant='transparent'
          icon={this.state.isPlaying ? IconPlayerStopFilled : IconPlayerPlayFilled}
          size='sm'
          onClick={this.onButtonClick.bind(this)}
        />

        <bem.MiniAudioPlayer__time dateTime={isTotalTimeKnown ? totalTime : undefined}>
          {isTotalTimeKnown
            ? this.state.isPlaying
              ? formatSeconds(this.state.currentTime)
              : formatSeconds(totalTime)
            : DURATION_PLACEHOLDER}
        </bem.MiniAudioPlayer__time>
      </React.Fragment>
    )
  }

  renderLoading() {
    return (
      <React.Fragment>
        <ActionIcon variant='transparent' icon={IconPlayerPlayFilled} size='sm' disabled />

        <bem.MiniAudioPlayer__time>{DURATION_PLACEHOLDER}</bem.MiniAudioPlayer__time>
      </React.Fragment>
    )
  }

  renderError() {
    return (
      <React.Fragment>
        <KoboIcon icon={IconAlertCircleFilled} size='sm' />

        <bem.MiniAudioPlayer__time>{ERROR_PLAYBACK_PLACEHOLDER}</bem.MiniAudioPlayer__time>
      </React.Fragment>
    )
  }

  render() {
    const modifiers = []

    if (this.state.isLoading) {
      modifiers.push('is-loading')
    }

    if (this.state.isBroken) {
      modifiers.push('is-broken')
    }

    const additionalProps = {
      'data-tip': this.state.isBroken ? t('Could not load media file') : undefined,
    }

    return (
      <bem.MiniAudioPlayer m={modifiers} {...additionalProps}>
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
    )
  }
}

export default MiniAudioPlayer
