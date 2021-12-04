import React from 'react'
import bem, {makeBem} from 'js/bem'
import LoadingSpinner from 'js/components/common/loadingSpinner'
import './koboImage.scss'

bem.Image = makeBem(null, 'kobo-image', 'figure')

type KoboImageProps = {
  src: string
}

type KoboImageState = {
  isLoading: boolean
}

/**
 * An image component that handles loading spinner.
 */
class KoboImage extends React.Component<KoboImageProps, KoboImageState> {
  constructor(props: KoboImageProps){
    super(props)
    this.state = {
      isLoading: true
    }
  }

  componentDidMount() {
    // this.preloadImage()
  }

  componentWillReceiveProps() {
    // this.preloadImage()
  }

  preloadImage() {
    this.setState({isLoading: true})
    const tempImg = new Image()
    tempImg.src = this.props.src
    tempImg.onload = this.onImageLoad.bind(this)
  }

  onImageLoad() {
    this.setState({isLoading: false})
  }

  getImageStyle() {
    if (this.state.isLoading) {
      return {}
    } else {
      return {
        backgroundImage: `url(${this.props.src})`
      }
    }
  }

  render() {
    return (
      <bem.Image style={this.getImageStyle()}>
        {this.state.isLoading &&
          <LoadingSpinner hideMessage/>
        }
      </bem.Image>
    )
  }
}

export default KoboImage
