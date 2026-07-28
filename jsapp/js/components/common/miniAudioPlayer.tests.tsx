import { act, render, screen } from '@testing-library/react'
import React from 'react'
import MiniAudioPlayer from './miniAudioPlayer'

// jsdom doesn't implement playback, and `componentWillUnmount` calls `pause()`.
beforeAll(() => {
  jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  jest.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve())
})

/**
 * Renders the player and reports the duration it displays, or `null` when the
 * label is hidden. `preload` is on so the player skips its loading state.
 */
function renderPlayerTime(durationSeconds?: number) {
  render(<MiniAudioPlayer mediaURL='audio.mp3' durationSeconds={durationSeconds} preload />)

  // The player starts in its loading state, which shows a placeholder. Fire
  // `loadedmetadata` so it renders the real player, as the browser would.
  const audio = document.querySelector('audio') as HTMLAudioElement
  Object.defineProperty(audio, 'duration', { value: 0.4, configurable: true })
  act(() => {
    audio.dispatchEvent(new Event('loadedmetadata'))
  })

  return screen.queryByText(/^\d\d:\d\d$/)?.textContent ?? null
}

describe('MiniAudioPlayer', () => {
  it('shows 00:00 for a backend duration of 0 instead of hiding the label', () => {
    // The backend truncates, so any recording under a second comes back as 0.
    // That's a real duration and must still be displayed.
    chai.expect(renderPlayerTime(0)).to.equal('00:00')
  })

  it('shows the backend duration in preference to the browser-decoded one', () => {
    chai.expect(renderPlayerTime(8)).to.equal('00:08')
  })

  it('falls back to the browser-decoded duration when no backend duration is given', () => {
    // 0.4s decoded by the browser rounds to 00:00, which is still a duration we
    // know, so the label stays visible.
    chai.expect(renderPlayerTime(undefined)).to.equal('00:00')
  })
})
