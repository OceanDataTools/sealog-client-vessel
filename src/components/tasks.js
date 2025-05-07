import React, { Component } from 'react'
import { compose } from 'redux'
import { connect } from 'react-redux'
import { Row, Col, Container, ListGroup } from 'react-bootstrap'
import PropTypes from 'prop-types'
import { delete_all_events } from '../api'
import ImportFromFileModal from './import_from_file_modal'
import DeleteModal from './delete_modal'
import { create_event_aux_data, create_event } from '../api'

import * as mapDispatchToProps from '../actions'

const importEventsDescription = (
  <div>
    <h5>Import Event Records</h5>
    <p>Add new event data records from a JSON-formated file.</p>
  </div>
)
const importAuxDataDescription = (
  <div>
    <h5>Import Aux Data Records</h5>
    <p>Add new aux data records from a JSON-formated file.</p>
  </div>
)
const dataResetDescription = (
  <div>
    <h5>Wipe Local Database</h5>
    <p>Delete all existing events from the local database.</p>
  </div>
)

class Tasks extends Component {
  constructor(props) {
    super(props)

    this.state = {
      description: ''
    }
  }

  async _insertEventItem({ id, ts, event_author, event_value, event_free_text = '', event_options = [] }) {
    let result = {
      skipped: false,
      imported: false,
      error: null
    }

    const response = await create_event({
      id,
      ts,
      event_author,
      event_value,
      event_free_text,
      event_options
    })

    if (response.success) {
      result.imported = true
      return result
    }

    if (response.error.response.data.statusCode == 400 && response.error.response.data.message == 'duplicate event ID') {
      result.skipped = true
      return result
    }

    result.error = { ...response.error.response.data, id: id || 'unknown' }
    return result
  }

  async _insertAuxDataItem({ id, event_id, data_source, data_array }) {
    let result = {
      skipped: false,
      imported: false,
      error: null
    }

    const response = await create_event_aux_data({
      id,
      event_id,
      data_source,
      data_array
    })

    if (response.success) {
      result.imported = true
      return result
    }

    result.error = { ...response.error.response.data, id: id || 'unknown' }
    return result
  }

  handleEventImport() {
    this.props.showModal('importFromFileModal', {
      handleHide: this.handleEventImportClose,
      insertItem: this._insertEventItem,
      title: 'Import Event Data'
    })
  }

  handleAuxDataImport() {
    this.props.showModal('importFromFileModal', {
      handleHide: this.handleAuxDataImportClose,
      insertItem: this._insertAuxDataItem,
      title: 'Import Auxiliary Data'
    })
  }

  async handleDataWipe() {
    this.props.showModal('deleteModal', {
      handleDelete: delete_all_events,
      message: 'all event and aux_data records'
    })
  }

  renderTaskTable() {
    return (
      <ListGroup>
        <ListGroup.Item
          onMouseEnter={() => this.setState({ description: importEventsDescription })}
          onMouseLeave={() => this.setState({ description: '' })}
          onClick={() => this.handleEventImport()}
        >
          Import Event Records
        </ListGroup.Item>
        <ListGroup.Item
          onMouseEnter={() => this.setState({ description: importAuxDataDescription })}
          onMouseLeave={() => this.setState({ description: '' })}
          onClick={() => this.handleAuxDataImport()}
        >
          Import Aux Data Records
        </ListGroup.Item>
        <ListGroup.Item
          onMouseEnter={() => this.setState({ description: dataResetDescription })}
          onMouseLeave={() => this.setState({ description: '' })}
          onClick={() => this.handleDataWipe()}
        >
          Wipe Local Database
        </ListGroup.Item>
      </ListGroup>
    )
  }

  render() {
    if (!this.props.roles) {
      return <div>Loading...</div>
    } else if (this.props.roles.includes('admin')) {
      return (
        <React.Fragment>
          <ImportFromFileModal />
          <DeleteModal />
          <Row className='d-flex justify-content-center py-2'>
            <Col sm={5} md={4} lg={3}>
              {this.renderTaskTable()}
            </Col>
            <Col sm={7} md={6} lg={5}>
              <Container>
                <Row>
                  <Col>{this.state.description}</Col>
                </Row>
              </Container>
            </Col>
          </Row>
        </React.Fragment>
      )
    } else {
      this.props.gotoHome()
    }
  }
}

Tasks.propTypes = {
  gotoHome: PropTypes.func.isRequired,
  roles: PropTypes.array,
  showModal: PropTypes.func.isRequired
}

const mapStateToProps = (state) => {
  return {
    roles: state.user.profile.roles
  }
}

export default compose(connect(mapStateToProps, mapDispatchToProps))(Tasks)
