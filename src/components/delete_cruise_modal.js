import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Button, Modal } from 'react-bootstrap';
import { connectModal } from 'redux-modal';
import { CUSTOM_CRUISE_NAME } from '../client_config';

class DeleteCruiseModal extends Component {

  constructor (props) {
    super(props);

    this.state = {
      cruise_name: (CUSTOM_CRUISE_NAME)? CUSTOM_CRUISE_NAME[0] : "cruise"
    }

    this.handleConfirm = this.handleConfirm.bind(this);
  }

  static propTypes = {
    id: PropTypes.string,
    handleDelete: PropTypes.func,
    handleHide: PropTypes.func.isRequired
  };

  handleConfirm() {
    this.props.handleDelete(this.props.id);
    this.props.handleHide();
  }

  render() {

    const { show, handleHide, id } = this.props

    if(id) {
      return (
        <Modal show={show} onHide={handleHide}>
          <Modal.Header className="bg-light" closeButton>
            <Modal.Title>Confirm Deletion</Modal.Title>
          </Modal.Header>

          <Modal.Body>
            {`Are you sure you want to delete this ${this.state.cruise_name}?`}
          </Modal.Body>

          <Modal.Footer>
            <Button size="sm" variant="secondary" onClick={handleHide}>Cancel</Button>
            <Button size="sm" variant="danger" onClick={this.handleConfirm}>Yup!</Button>
          </Modal.Footer>
        </Modal>
      );
    }
    else {
      return null;
    }
  }
}

export default connectModal({ name: 'deleteCruise' })(DeleteCruiseModal)