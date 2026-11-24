import React, { Component } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { connect } from 'react-redux'
import { Button, Card, Col, OverlayTrigger, Row, Table, Tooltip } from 'react-bootstrap'
import PropTypes from 'prop-types'
import { Client } from '@hapi/nes/lib/client'
import DeleteModal from './delete_modal'
import SequenceModal from './sequence_modal'
import SequenceCountersModal from './sequence_counters_modal'
import { renderAlert, renderMessage } from './form_elements'
import { delete_sequence, export_sequences, get_sequences, import_sequences } from '../api'
import { sequenceExample } from '../sequences'
import { apiErrorMessage, connectWSClient } from '../utils'
import { WS_ROOT_URL } from '../client_settings'
import * as mapDispatchToProps from '../actions'

// ID sequences (sealog-server lib/sequences.js): the formats that sequence
// options in event templates take their IDs from. Admin only.
class Sequences extends Component {
  constructor(props) {
    super(props)

    this.state = {
      sequences: [],
      fetching: true,
      importing: false,
      error: null,
      message: null
    }

    this.client = new Client(`${WS_ROOT_URL}`)
    this.importInput = React.createRef()

    this.fetchSequences = this.fetchSequences.bind(this)
    this.handleImport = this.handleImport.bind(this)
  }

  componentDidMount() {
    this.fetchSequences()
    connectWSClient(this.client, { '/ws/status/updateSequences': this.fetchSequences })
  }

  componentWillUnmount() {
    this.client.disconnect()
  }

  async fetchSequences() {
    const sequences = await get_sequences()
    this.setState({ sequences, fetching: false })
  }

  showResult(error, message) {
    this.setState({ error, message })
  }

  handleEdit(sequence = null) {
    this.showResult(null, null)
    this.props.showModal('sequence', {
      sequence,
      handleDone: (message) => {
        this.showResult(null, message)
        this.fetchSequences()
      }
    })
  }

  handleCounters(sequence) {
    this.showResult(null, null)
    this.props.showModal('sequenceCounters', { sequence })
  }

  handleDelete(name) {
    this.props.showModal('deleteModal', {
      id: name,
      handleDelete: async (id) => {
        this.showResult(null, null)
        const response = await delete_sequence(id)
        if (response.error) {
          this.showResult(`Could not delete ${id}: ${apiErrorMessage(response.error)}`, null)
        } else {
          this.showResult(null, `Deleted ${id} and its counters.`)
        }

        this.fetchSequences()
      },
      message: `the sequence ${name} and its counters (IDs already on events are unchanged)`
    })
  }

  async handleExport() {
    this.showResult(null, null)
    const response = await export_sequences()
    if (response.error) {
      this.showResult(`Could not export: ${apiErrorMessage(response.error)}`, null)
    }
  }

  async handleImport(event) {
    const file = event.target.files[0]
    event.target.value = ''
    if (!file) {
      return
    }

    this.showResult(null, null)
    this.setState({ importing: true })
    const response = await import_sequences(file)
    this.setState({ importing: false })

    if (response.error) {
      this.showResult(`Could not import ${file.name}: ${apiErrorMessage(response.error)}`, null)
      return
    }

    const { created, updated } = response.data
    const parts = [created.length && `created ${created.join(', ')}`, updated.length && `updated ${updated.join(', ')}`].filter(Boolean)
    this.showResult(null, `Imported ${file.name}: ${parts.join('; ')}. Counters are unchanged.`)
    this.fetchSequences()
  }

  renderActions(sequence) {
    const action = (key, tooltip, icon, className, onClick) => (
      <OverlayTrigger key={key} placement='top' overlay={<Tooltip id={`${key}_${sequence.name}`}>{tooltip}</Tooltip>}>
        <FontAwesomeIcon className={className} onClick={onClick} icon={icon} fixedWidth role='button' />
      </OverlayTrigger>
    )

    return [
      action('edit', 'Edit this sequence', 'pencil-alt', 'text-warning', () => this.handleEdit(sequence)),
      action('counters', 'Counters: see and set the next number', 'calculator', 'text-primary', () => this.handleCounters(sequence)),
      action('delete', 'Delete this sequence', 'trash', 'text-danger', () => this.handleDelete(sequence.name))
    ]
  }

  renderSequences() {
    if (this.state.fetching) {
      return (
        <tr>
          <td colSpan={5}>Loading...</td>
        </tr>
      )
    }

    if (!this.state.sequences.length) {
      return (
        <tr>
          <td colSpan={5}>No sequences yet.</td>
        </tr>
      )
    }

    return this.state.sequences.map((sequence) => (
      <tr key={sequence.name}>
        <td>
          <strong>{sequence.name}</strong>
          {sequence.description && <div className='small'>{sequence.description}</div>}
        </td>
        <td>
          <code>{sequence.format}</code>
        </td>
        <td className='small'>{sequenceExample(sequence)}</td>
        <td>
          {sequence.scope}
          {sequence.start !== 1 && <div className='small text-muted'>from {sequence.start}</div>}
        </td>
        <td className='text-center text-nowrap'>{this.renderActions(sequence)}</td>
      </tr>
    ))
  }

  renderButtons() {
    return (
      <div className='float-end my-2'>
        <input ref={this.importInput} type='file' accept='.json,application/json' hidden onChange={this.handleImport} />
        <Button
          className='me-1'
          variant='outline-primary'
          size='sm'
          disabled={this.state.importing}
          onClick={() => this.importInput.current.click()}
        >
          {this.state.importing ? 'Importing…' : 'Import From File'}
        </Button>
        <Button
          className='me-1'
          variant='outline-primary'
          size='sm'
          disabled={!this.state.sequences.length}
          onClick={() => this.handleExport()}
        >
          Export All
        </Button>
        <Button variant='outline-primary' size='sm' onClick={() => this.handleEdit()}>
          New Sequence
        </Button>
      </div>
    )
  }

  render() {
    if (!this.props.roles) {
      return <div>Loading...</div>
    }

    if (!this.props.roles.includes('admin')) {
      return <div>What are YOU doing here?</div>
    }

    return (
      <React.Fragment>
        <DeleteModal />
        <SequenceModal />
        <SequenceCountersModal />
        <Row className='py-2 px-1 d-flex justify-content-center'>
          <Col className='px-1' sm={12} lg={10} xl={8}>
            <Card className='border-secondary'>
              <Card.Header>ID Sequences</Card.Header>
              <Card.Body className='pb-1'>
                <p className='small text-muted'>
                  A <strong>sequence</strong> option in an event template takes its ID from one of these: the server fills in the next one
                  when an event is saved. Loggers can type their own instead.
                </p>
                <Table className='mb-2' bordered striped size='sm' responsive>
                  <thead>
                    <tr>
                      <th>Sequence</th>
                      <th>Format</th>
                      <th>Example</th>
                      <th>Numbered per</th>
                      <th className='text-center' style={{ width: '90px' }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>{this.renderSequences()}</tbody>
                </Table>
                {renderAlert(this.state.error)}
                {renderMessage(this.state.message)}
              </Card.Body>
            </Card>
            {this.renderButtons()}
          </Col>
        </Row>
      </React.Fragment>
    )
  }
}

Sequences.propTypes = {
  roles: PropTypes.array,
  showModal: PropTypes.func.isRequired
}

const mapStateToProps = (state) => {
  return {
    roles: state.user.profile.roles
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(Sequences)
