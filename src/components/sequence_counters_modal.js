import React, { Component } from 'react'
import { connectModal } from 'redux-modal'
import PropTypes from 'prop-types'
import { Alert, Button, Form, Modal, Table } from 'react-bootstrap'
import { get_sequence_counters, set_sequence_counter } from '../api'
import { apiErrorMessage } from '../utils'

// A sequence's counters, one per cruise or lowering (or one for a global
// sequence), with the next number each will issue, which can be set
class SequenceCountersModal extends Component {
  constructor(props) {
    super(props)

    this.state = {
      counters: null,
      // Edited next numbers, by scope key
      next: {},
      // A counter for a scope with none yet
      newKey: '',
      newNext: '',
      error: null,
      message: null
    }
  }

  componentDidMount() {
    this.load()
  }

  get global() {
    return this.props.sequence.scope === 'global'
  }

  async load() {
    const response = await get_sequence_counters(this.props.sequence.name)
    if (response.error) {
      this.setState({ counters: [], error: apiErrorMessage(response.error) })
      return
    }

    this.setState({ counters: response.data, next: {} })
  }

  async handleSet(scope_key, value) {
    const next = Number(value)
    if (!/^\d+$/.test(String(value).trim())) {
      this.setState({ error: 'The next number must be a whole number, 0 or more', message: null })
      return
    }

    this.setState({ error: null, message: null })
    const response = await set_sequence_counter(this.props.sequence.name, scope_key, next)
    if (response.error) {
      this.setState({ error: apiErrorMessage(response.error) })
      return
    }

    this.setState({ message: `The next number for ${scope_key || 'this sequence'} is ${next}.`, newKey: '', newNext: '' })
    this.load()
  }

  renderCounter(counter) {
    const value = this.state.next[counter.scope_key] !== undefined ? this.state.next[counter.scope_key] : String(counter.next)

    return (
      <tr key={counter.scope_key}>
        <td>{this.global ? <span className='text-muted'>all events</span> : counter.scope_key}</td>
        <td className='text-end'>{counter.last}</td>
        <td style={{ width: '220px' }}>
          <div className='d-flex'>
            <Form.Control
              size='sm'
              value={value}
              aria-label={`Next number for ${counter.scope_key || this.props.sequence.name}`}
              onChange={(e) => this.setState((state) => ({ next: { ...state.next, [counter.scope_key]: e.target.value } }))}
            />
            <Button
              size='sm'
              variant='outline-primary'
              className='ms-1'
              disabled={value === String(counter.next)}
              onClick={() => this.handleSet(counter.scope_key, value)}
            >
              Set
            </Button>
          </div>
        </td>
      </tr>
    )
  }

  // A counter for a cruise or lowering that has none yet (or the global one)
  renderNewCounter() {
    const { counters, newKey, newNext } = this.state
    if (this.global && counters && counters.length) {
      return null
    }

    const label = this.global ? 'all events' : `${this.props.sequence.scope}_id`
    return (
      <tr>
        <td>
          {this.global ? (
            <span className='text-muted'>all events</span>
          ) : (
            <Form.Control
              size='sm'
              value={newKey}
              placeholder={`another ${label}`}
              onChange={(e) => this.setState({ newKey: e.target.value.trim() })}
            />
          )}
        </td>
        <td className='text-end text-muted'>-</td>
        <td>
          <div className='d-flex'>
            <Form.Control
              size='sm'
              value={newNext}
              placeholder='next number'
              aria-label='Next number for a new counter'
              onChange={(e) => this.setState({ newNext: e.target.value })}
            />
            <Button
              size='sm'
              variant='outline-primary'
              className='ms-1'
              disabled={(!this.global && !newKey) || !newNext}
              onClick={() => this.handleSet(this.global ? '' : newKey, newNext)}
            >
              Set
            </Button>
          </div>
        </td>
      </tr>
    )
  }

  render() {
    const { show, handleHide, sequence } = this.props
    const { counters, error, message } = this.state

    // redux-modal drops the props while the modal animates closed
    if (!sequence) {
      return null
    }

    return (
      <Modal size='lg' show={show} onHide={handleHide}>
        <Modal.Header className='bg-light' closeButton>
          <Modal.Title>{sequence.name} counters</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className='small text-muted'>
            <code>{sequence.format}</code>, numbered per {sequence.scope}. Setting the next number to one already issued would issue it
            again.
          </p>
          <Table size='sm' bordered striped className='mb-2'>
            <thead>
              <tr>
                <th>{this.global ? 'Scope' : sequence.scope === 'cruise' ? 'Cruise' : 'Lowering'}</th>
                <th className='text-end'>Last issued</th>
                <th>Next number</th>
              </tr>
            </thead>
            <tbody>
              {counters === null && (
                <tr>
                  <td colSpan={3}>Loading...</td>
                </tr>
              )}
              {counters && !counters.length && (
                <tr>
                  <td colSpan={3} className='text-muted'>
                    No IDs issued yet; the first will be {sequence.start}.
                  </td>
                </tr>
              )}
              {counters && counters.map((counter) => this.renderCounter(counter))}
              {counters && this.renderNewCounter()}
            </tbody>
          </Table>
          {error && (
            <Alert variant='danger' className='mb-0 py-2'>
              <strong>Oops!</strong> {error}
            </Alert>
          )}
          {message && (
            <Alert variant='success' className='mb-0 py-2'>
              <strong>Success!</strong> {message}
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button size='sm' variant='secondary' onClick={handleHide}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    )
  }
}

// sequence is only missing while the modal animates closed
SequenceCountersModal.propTypes = {
  handleHide: PropTypes.func.isRequired,
  sequence: PropTypes.object,
  show: PropTypes.bool.isRequired
}

export default connectModal({ name: 'sequenceCounters', destroyOnHide: true })(SequenceCountersModal)
