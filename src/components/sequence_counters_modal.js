import React, { Component } from 'react'
import { connectModal } from 'redux-modal'
import PropTypes from 'prop-types'
import moment from 'moment'
import { Alert, Button, Form, Modal, Table } from 'react-bootstrap'
import { get_cruises, get_sequence_counters, set_sequence_counter } from '../api'
import { apiErrorMessage } from '../utils'

const formatDate = (ts) => (ts ? moment.utc(ts).format('YYYY-MM-DD') : '?')

// A sequence's counters: one per cruise (or one for a global sequence),
// with the next number each will issue. Cruises run one after another and
// take no events once over, so only the one in progress can be set; past
// ones are history.
class SequenceCountersModal extends Component {
  constructor(props) {
    super(props)

    this.state = {
      counters: null,
      // The cruises: { key, start, stop }
      scopes: [],
      // Edited next numbers, by scope key
      next: {},
      // The first number for an upcoming cruise
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

  get perCruise() {
    return this.props.sequence.scope === 'cruise'
  }

  async load() {
    const response = await get_sequence_counters(this.props.sequence.name)
    if (response.error) {
      this.setState({ counters: [], error: apiErrorMessage(response.error) })
      return
    }

    const scopes = this.perCruise
      ? (await get_cruises()).map((cruise) => ({ key: cruise.cruise_id, start: cruise.start_ts, stop: cruise.stop_ts }))
      : []

    this.setState({ counters: response.data, scopes, next: {} })
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

    this.setState({ message: `The next number for ${scope_key || this.props.sequence.name} is ${next}.`, newKey: '', newNext: '' })
    this.load()
  }

  // The cruise in progress, else the most recent one; and
  // whether it's in progress
  currentScope() {
    const now = new Date()
    const started = this.state.scopes.filter((scope) => new Date(scope.start) <= now).sort((a, b) => new Date(b.start) - new Date(a.start))
    const active = started.find((scope) => new Date(scope.stop) >= now)
    return active ? { scope: active, active: true } : { scope: started[0] || null, active: false }
  }

  counterFor(key) {
    return (this.state.counters || []).find((counter) => counter.scope_key === key)
  }

  renderSetNext(key, counter) {
    const current = String(counter ? counter.next : this.props.sequence.start)
    const value = this.state.next[key] !== undefined ? this.state.next[key] : current

    return (
      <div className='d-flex'>
        <Form.Control
          size='sm'
          value={value}
          aria-label={`Next number for ${key || this.props.sequence.name}`}
          onChange={(e) => this.setState((state) => ({ next: { ...state.next, [key]: e.target.value } }))}
        />
        <Button
          size='sm'
          variant='outline-primary'
          className='ms-1'
          disabled={value === current}
          onClick={() => this.handleSet(key, value)}
        >
          Set
        </Button>
      </div>
    )
  }

  renderGlobal() {
    const counter = this.counterFor('')

    return (
      <Table size='sm' bordered className='mb-2'>
        <thead>
          <tr>
            <th className='text-end'>Last issued</th>
            <th>Next number</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className='text-end'>{counter ? counter.last : <span className='text-muted'>none yet</span>}</td>
            <td style={{ width: '260px' }}>{this.renderSetNext('', counter)}</td>
          </tr>
        </tbody>
      </Table>
    )
  }

  renderCurrent() {
    const { scope, active } = this.currentScope()

    if (!scope) {
      return <p className='mb-2'>No cruise has started yet.</p>
    }

    const counter = this.counterFor(scope.key)
    return (
      <React.Fragment>
        <h6 className='mb-1'>{active ? 'Cruise in progress' : 'No cruise in progress. Most recent:'}</h6>
        <Table size='sm' bordered className='mb-2'>
          <thead>
            <tr>
              <th>Cruise</th>
              <th className='text-end'>Last issued</th>
              <th>Next number</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                {scope.key}{' '}
                <span className='small text-muted'>
                  {formatDate(scope.start)} to {formatDate(scope.stop)}
                </span>
              </td>
              <td className='text-end'>{counter ? counter.last : <span className='text-muted'>none yet</span>}</td>
              <td style={{ width: '260px' }}>
                {active ? this.renderSetNext(scope.key, counter) : <span className='text-muted'>{counter ? counter.next : '-'}</span>}
              </td>
            </tr>
          </tbody>
        </Table>
      </React.Fragment>
    )
  }

  // The counters other than the current scope's, with their cruise or
  // cruise, split into upcoming ones (set ahead of their start) and
  // previous ones; each newest first
  otherCounters() {
    const { scope } = this.currentScope()
    const scopes = new Map(this.state.scopes.map((item) => [item.key, item]))
    const now = new Date()
    const others = (this.state.counters || [])
      .filter((counter) => !scope || counter.scope_key !== scope.key)
      .map((counter) => ({ counter, scope: scopes.get(counter.scope_key) }))
      .sort((a, b) => new Date((b.scope && b.scope.start) || 0) - new Date((a.scope && a.scope.start) || 0))

    const upcoming = (item) => item.scope && new Date(item.scope.start) > now
    return { upcoming: others.filter(upcoming), previous: others.filter((item) => !upcoming(item)) }
  }

  // Counters of finished cruises
  renderPrevious() {
    const { previous } = this.otherCounters()

    if (!previous.length) {
      return null
    }

    return (
      <details className='mb-2'>
        <summary>Previous cruises ({previous.length})</summary>
        <Table size='sm' bordered striped className='mt-1 mb-0'>
          <tbody>
            {previous.map(({ counter, scope: item }) => (
              <tr key={counter.scope_key}>
                <td>
                  {counter.scope_key}{' '}
                  {item && (
                    <span className='small text-muted'>
                      {formatDate(item.start)} to {formatDate(item.stop)}
                    </span>
                  )}
                </td>
                <td className='text-end'>last issued {counter.last}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </details>
    )
  }

  // The first number for an upcoming cruise, before its first event
  renderUpcoming() {
    const { newKey, newNext } = this.state
    const { upcoming } = this.otherCounters()

    return (
      <details className='mb-2' open={upcoming.length > 0}>
        <summary>Start an upcoming cruise at a different number</summary>
        {upcoming.map(({ counter, scope }) => (
          <div key={counter.scope_key} className='small mt-1'>
            {counter.scope_key} <span className='text-muted'>(starts {formatDate(scope.start)})</span> will start at {counter.next}.
          </div>
        ))}
        <div className='d-flex mt-1'>
          <Form.Control
            size='sm'
            value={newKey}
            placeholder='cruise_id'
            aria-label='Upcoming cruise_id'
            onChange={(e) => this.setState({ newKey: e.target.value.trim() })}
          />
          <Form.Control
            size='sm'
            className='ms-1'
            value={newNext}
            placeholder='first number'
            aria-label='First number for the upcoming cruise'
            onChange={(e) => this.setState({ newNext: e.target.value })}
          />
          <Button
            size='sm'
            variant='outline-primary'
            className='ms-1'
            disabled={!newKey || !newNext}
            onClick={() => this.handleSet(newKey, newNext)}
          >
            Set
          </Button>
        </div>
        <div className='small text-muted'>Otherwise it starts at {this.props.sequence.start} with its first event.</div>
      </details>
    )
  }

  // A sequence with another scope (set up elsewhere): its counters as a list
  renderOtherScope() {
    const counters = this.state.counters || []
    if (!counters.length) {
      return <p className='mb-2'>No IDs issued yet; the first will be {this.props.sequence.start}.</p>
    }

    return (
      <Table size='sm' bordered striped className='mb-2'>
        <thead>
          <tr>
            <th>Counter</th>
            <th className='text-end'>Last issued</th>
            <th>Next number</th>
          </tr>
        </thead>
        <tbody>
          {counters.map((counter) => (
            <tr key={counter.scope_key}>
              <td>{counter.scope_key}</td>
              <td className='text-end'>{counter.last}</td>
              <td style={{ width: '260px' }}>{this.renderSetNext(counter.scope_key, counter)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    )
  }

  render() {
    const { show, handleHide, sequence } = this.props
    const { counters, error, message } = this.state

    // redux-modal drops the props while the modal animates closed
    if (!sequence) {
      return null
    }

    let body = <p>Loading...</p>
    if (counters) {
      if (this.global) {
        body = this.renderGlobal()
      } else if (this.perCruise) {
        body = (
          <React.Fragment>
            {this.renderCurrent()}
            {this.renderUpcoming()}
            {this.renderPrevious()}
          </React.Fragment>
        )
      } else {
        body = this.renderOtherScope()
      }
    }

    return (
      <Modal size='lg' show={show} onHide={handleHide}>
        <Modal.Header className='bg-light' closeButton>
          <Modal.Title>{sequence.name} counters</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className='small text-muted'>
            <code>{sequence.format}</code>, numbered {this.global ? 'across all events' : `per ${sequence.scope}`}. Setting the next number
            to one already issued would issue it again.
          </p>
          {body}
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
