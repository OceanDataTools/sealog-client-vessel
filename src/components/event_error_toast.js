import React, { Component } from 'react'
import { connect } from 'react-redux'
import PropTypes from 'prop-types'
import { Toast, ToastContainer } from 'react-bootstrap'
import * as mapDispatchToProps from '../actions'

class EventErrorToast extends Component {
  handleClose() {
    this.props.clearEventError()
  }

  render() {
    return (
      <ToastContainer position='top-end' containerPosition='fixed' className='p-3' style={{ zIndex: 1100 }}>
        <Toast
          key={this.props.event_error_id}
          show={Boolean(this.props.event_error)}
          onClose={this.handleClose.bind(this)}
          delay={6000}
          autohide
          bg='danger'
        >
          <Toast.Header>
            <strong className='me-auto'>Event Submission Failed</strong>
          </Toast.Header>
          <Toast.Body className='text-white'>{this.props.event_error}</Toast.Body>
        </Toast>
      </ToastContainer>
    )
  }
}

EventErrorToast.propTypes = {
  event_error: PropTypes.string,
  event_error_id: PropTypes.number,
  clearEventError: PropTypes.func.isRequired
}

const mapStateToProps = (state) => {
  return {
    event_error: state.event.event_error,
    event_error_id: state.event.event_error_id
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(EventErrorToast)
