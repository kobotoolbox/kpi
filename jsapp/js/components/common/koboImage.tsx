import './koboImage.scss'

import React from 'react'

import bem, { makeBem } from '#/bem'
import LoadingSpinner from '#/components/common/loadingSpinner'

bem.KoboImage = makeBem(null, 'kobo-image', 'figure')
bem.KoboImage__image = makeBem(bem.KoboImage, 'image', 'img')

interface KoboImageProps {
  src: string
}

interface KoboImageState {
  isLoading: boolean
}

/**
 * An image component that handles loading the image with a spinner.
 */
class KoboImage extends React.Component<KoboImageProps, KoboImageState> {
  constructor(props: KoboImageProps) {
    super(props)
    this.state = {
      isLoading: true,
    }
  }

  componentDidMount() {
    this.preloadImage()
  }

  componentWillReceiveProps() {
    this.preloadImage()
  }

  preloadImage() {
    this.setState({ isLoading: true })
    const tempImg = new Image()
    tempImg.src = this.props.src
    tempImg.onload = this.onImageLoaded.bind(this)
  }

  onImageLoaded() {
    this.setState({ isLoading: false })
  }

  render() {
    return (
      <bem.KoboImage>
        {this.state.isLoading && <LoadingSpinner message={false} />}

        {!this.state.isLoading && <bem.KoboImage__image src={this.props.src} />}
      </bem.KoboImage>
    )
  }
}

export default KoboImage
