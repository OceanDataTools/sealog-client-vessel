import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Modal, Image } from 'react-bootstrap'
import { connectModal } from 'redux-modal'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { handle_image_file_download } from '../api'
import { handleMissingImage, getImageUrl } from '../utils'

class ImagePreviewModal extends Component {
  constructor(props) {
    super(props)

    this.handleClose = this.handleClose.bind(this)
  }

  handleClose() {
    this.props.handleHide()
  }

  render() {
    const { show, handleHide, name } = this.props

    if (name) {
      return (
        <Modal size='xl' show={show} onHide={handleHide}>
          <Modal.Header className='bg-light' closeButton>
            <Modal.Title as='h5'>
              Image Preview - {this.props.name}{' '}
              <FontAwesomeIcon
                onClick={() => handle_image_file_download(this.props.filepath)}
                className='text-primary'
                icon='download'
                fixedWidth
              />
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className='text-center'>
              <Image fluid src={getImageUrl(this.props.filepath)} onError={handleMissingImage} />
            </div>
          </Modal.Body>
        </Modal>
      )
    } else {
      return null
    }
  }
}

ImagePreviewModal.propTypes = {
  name: PropTypes.string,
  filepath: PropTypes.string,
  handleHide: PropTypes.func.isRequired,
  show: PropTypes.bool.isRequired
}

export default connectModal({ name: 'imagePreview' })(ImagePreviewModal)
