import React, { Component } from 'react'
import { connectModal } from 'redux-modal'
import PropTypes from 'prop-types'
import { Alert, Button, Col, Form, Modal, Row } from 'react-bootstrap'
import { create_sequence, update_sequence } from '../api'
import { SEQUENCE_SCOPES, sequenceExample } from '../sequences'
import { apiErrorMessage } from '../utils'

const NAME_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

// Create a sequence, or edit one (sequence given); its name can't change
class SequenceModal extends Component {
  constructor(props) {
    super(props)

    const { sequence } = props
    this.state = {
      name: sequence ? sequence.name : '',
      format: sequence ? sequence.format : '',
      scope: sequence ? sequence.scope : 'cruise',
      start: sequence ? String(sequence.start) : '1',
      description: sequence ? sequence.description || '' : '',
      error: null,
      submitting: false
    }

    this.handleSubmit = this.handleSubmit.bind(this)
  }

  validate() {
    const { name, format, start } = this.state

    if (!this.props.sequence && !NAME_PATTERN.test(name)) {
      return 'The name must be letters, digits, - or _, e.g. sample_id'
    }

    if ((format.match(/\{n(:\d+)?\}/g) || []).length !== 1) {
      return 'The format needs the counter {n} exactly once, e.g. {cruise_id}-C{n:03}'
    }

    if (!/^\d+$/.test(start)) {
      return 'The first number must be a whole number, 0 or more'
    }

    return null
  }

  async handleSubmit(event) {
    event.preventDefault()

    const error = this.validate()
    if (error) {
      this.setState({ error })
      return
    }

    const { sequence } = this.props
    const fields = {
      format: this.state.format.trim(),
      scope: this.state.scope,
      start: Number(this.state.start),
      description: this.state.description.trim()
    }

    this.setState({ submitting: true, error: null })
    const response = sequence ? await update_sequence(sequence.name, fields) : await create_sequence({ name: this.state.name, ...fields })

    if (response.error) {
      this.setState({ submitting: false, error: apiErrorMessage(response.error) })
      return
    }

    // Before hiding: redux-modal drops the props on hide
    this.props.handleDone(sequence ? `Updated ${sequence.name}.` : `Created ${this.state.name}.`)
    this.props.handleHide()
  }

  renderExample() {
    const { format, start } = this.state
    if (!format) {
      return null
    }

    return (
      <Form.Text className='d-block'>
        e.g. <code>{sequenceExample({ format, start: Number(start) || 0 })}</code> (with a placeholder cruise ID and today&apos;s date)
      </Form.Text>
    )
  }

  render() {
    const { show, handleHide, sequence } = this.props
    const set = (field) => (e) => this.setState({ [field]: e.target.value, error: null })

    return (
      <Modal size='lg' show={show} onHide={handleHide}>
        <Form onSubmit={this.handleSubmit}>
          <Modal.Header className='bg-light' closeButton>
            <Modal.Title>{sequence ? `Edit ${sequence.name}` : 'New Sequence'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Row>
              <Form.Group as={Col} sm={6} className='mb-2'>
                <Form.Label>Name</Form.Label>
                <Form.Control
                  size='sm'
                  value={this.state.name}
                  placeholder='e.g. sample_id'
                  disabled={Boolean(sequence)}
                  onChange={set('name')}
                />
                {sequence && <Form.Text>Templates refer to it by name, so it can&apos;t change.</Form.Text>}
              </Form.Group>
              <Form.Group as={Col} sm={6} className='mb-2'>
                <Form.Label>Numbered per</Form.Label>
                <Form.Select size='sm' value={this.state.scope} onChange={set('scope')}>
                  {/* A scope this client doesn't offer stays selectable on edit */}
                  {[...new Set([...SEQUENCE_SCOPES, this.state.scope])].map((scope) => (
                    <option key={scope} value={scope}>
                      {scope}
                    </option>
                  ))}
                </Form.Select>
                <Form.Text>
                  The count restarts for each {this.state.scope === 'global' ? 'server (it never restarts)' : this.state.scope}.
                  {sequence && ' It can’t change once IDs have been issued.'}
                </Form.Text>
              </Form.Group>
            </Row>
            <Form.Group className='mb-2'>
              <Form.Label>Format</Form.Label>
              <Form.Control size='sm' value={this.state.format} placeholder='e.g. {cruise_id}-C{n:03}' onChange={set('format')} />
              <Form.Text className='d-block'>
                Fixed text with <code>{'{cruise_id}'}</code>, the event&apos;s date as <code>{'{yyyy}'}</code> <code>{'{yy}'}</code>{' '}
                <code>{'{mm}'}</code> <code>{'{dd}'}</code> <code>{'{doy}'}</code> (UTC), and the counter <code>{'{n}'}</code> exactly once
                (<code>{'{n:03}'}</code> pads it to 3 digits).
                {sequence && ' Changing it leaves IDs already issued as they are.'}
              </Form.Text>
              {this.renderExample()}
            </Form.Group>
            <Row>
              <Form.Group as={Col} sm={4} className='mb-2'>
                <Form.Label>First number</Form.Label>
                <Form.Control size='sm' value={this.state.start} onChange={set('start')} />
              </Form.Group>
              <Form.Group as={Col} sm={8} className='mb-2'>
                <Form.Label>Description (optional)</Form.Label>
                <Form.Control size='sm' value={this.state.description} onChange={set('description')} />
              </Form.Group>
            </Row>
            {this.state.error && (
              <Alert variant='danger' className='mb-0 mt-2 py-2'>
                {this.state.error}
              </Alert>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button size='sm' variant='secondary' onClick={handleHide}>
              Cancel
            </Button>
            <Button size='sm' variant='primary' type='submit' disabled={this.state.submitting}>
              {sequence ? 'Save' : 'Create'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    )
  }
}

// handleDone is only missing while the modal animates closed
SequenceModal.propTypes = {
  handleDone: PropTypes.func,
  handleHide: PropTypes.func.isRequired,
  sequence: PropTypes.object,
  show: PropTypes.bool.isRequired
}

export default connectModal({ name: 'sequence', destroyOnHide: true })(SequenceModal)
