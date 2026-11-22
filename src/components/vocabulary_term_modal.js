import React, { Component } from 'react'
import { connectModal } from 'redux-modal'
import PropTypes from 'prop-types'
import { Alert, Button, Form, Modal } from 'react-bootstrap'
import { create_vocabulary_term, update_vocabulary_term } from '../api'
import { apiErrorMessage } from '../utils'

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

// Add a term to a local vocabulary, or edit one (term given). IDs can't be
// changed once created.
class VocabularyTermModal extends Component {
  constructor(props) {
    super(props)

    const term = props.term || {}
    this.state = {
      id: term.id || '',
      prefLabel: term.prefLabel || '',
      altLabel: term.altLabel || '',
      definition: term.definition || '',
      broader: term.broader || [],
      deprecated: Boolean(term.deprecated),
      error: null,
      submitting: false
    }

    this.handleSubmit = this.handleSubmit.bind(this)
  }

  validate() {
    if (!this.props.term && !ID_PATTERN.test(this.state.id)) {
      return 'The ID may only use letters, digits, - and _ (up to 64)'
    }

    return this.state.prefLabel.trim() ? null : 'A label is required'
  }

  async handleSubmit(event) {
    event.preventDefault()

    const error = this.validate()
    if (error) {
      this.setState({ error })
      return
    }

    this.setState({ error: null, submitting: true })

    const { term, vocabulary } = this.props
    const fields = {
      prefLabel: this.state.prefLabel.trim(),
      altLabel: this.state.altLabel.trim(),
      definition: this.state.definition.trim(),
      broader: this.state.broader
    }

    const response = term
      ? await update_vocabulary_term(vocabulary.collection, term.id, { ...fields, deprecated: this.state.deprecated })
      : await create_vocabulary_term(vocabulary.collection, { id: this.state.id, ...fields })

    if (response.error) {
      this.setState({ error: apiErrorMessage(response.error), submitting: false })
      return
    }

    // Before hiding: redux-modal drops the props on hide
    this.props.handleDone(term ? `Updated ${term.id}.` : `Added ${this.state.id}.`)
    this.props.handleHide()
  }

  handleBroaderChange(event) {
    const broader = Array.from(event.target.selectedOptions).map((option) => option.value)
    this.setState({ broader, error: null })
  }

  renderBroader() {
    const { broaderOptions = [] } = this.props

    if (!broaderOptions.length) {
      return null
    }

    const labels = {}
    broaderOptions.forEach((group) => group.terms.forEach((item) => (labels[item.notation] = `${item.prefLabel} (${item.notation})`)))

    return (
      <Form.Group className='mb-2'>
        <Form.Label>Broader terms (optional)</Form.Label>
        <Form.Select multiple size='sm' htmlSize={8} value={this.state.broader} onChange={(e) => this.handleBroaderChange(e)}>
          {broaderOptions.map((group) => (
            <optgroup key={group.collection} label={`${group.collection} — ${group.title}`}>
              {group.terms.map((item) => (
                <option key={item.notation} value={item.notation}>
                  {item.prefLabel} ({item.id})
                </option>
              ))}
            </optgroup>
          ))}
        </Form.Select>
        <Form.Text>
          Groups this term with NVS categories, e.g. L05 &quot;CTD&quot; or L06 &quot;ROV&quot;. Ctrl/Cmd-click to choose more than one.
          {this.state.broader.length > 0 && (
            <div>Selected: {this.state.broader.map((notation) => labels[notation] || notation).join(', ')}</div>
          )}
        </Form.Text>
      </Form.Group>
    )
  }

  render() {
    const { show, handleHide, term, vocabulary } = this.props

    if (!vocabulary) {
      return null
    }

    const notation = `${vocabulary.prefix}:${vocabulary.collection}::${(term && term.id) || this.state.id || '<id>'}`

    return (
      <Modal size='lg' show={show} onHide={handleHide}>
        <Form onSubmit={this.handleSubmit}>
          <Modal.Header className='bg-light' closeButton>
            <Modal.Title>{term ? `Edit ${term.id}` : `Add Term to ${vocabulary.collection}`}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className='mb-2'>
              <Form.Label>ID</Form.Label>
              <Form.Control
                size='sm'
                value={this.state.id}
                disabled={Boolean(term)}
                placeholder='e.g. ROV-ODYSSEY'
                onChange={(e) => this.setState({ id: e.target.value.trim(), error: null })}
              />
              <Form.Text>
                The last part of the term&apos;s notation: <code>{notation}</code>.{!term && " The ID can't be changed later."}
              </Form.Text>
            </Form.Group>
            <Form.Group className='mb-2'>
              <Form.Label>Label</Form.Label>
              <Form.Control
                size='sm'
                value={this.state.prefLabel}
                onChange={(e) => this.setState({ prefLabel: e.target.value, error: null })}
              />
            </Form.Group>
            <Form.Group className='mb-2'>
              <Form.Label>Alternative label (optional)</Form.Label>
              <Form.Control
                size='sm'
                value={this.state.altLabel}
                onChange={(e) => this.setState({ altLabel: e.target.value, error: null })}
              />
            </Form.Group>
            <Form.Group className='mb-2'>
              <Form.Label>Definition (optional)</Form.Label>
              <Form.Control
                as='textarea'
                rows={2}
                size='sm'
                value={this.state.definition}
                onChange={(e) => this.setState({ definition: e.target.value, error: null })}
              />
            </Form.Group>
            {this.renderBroader()}
            {term && (
              <Form.Check
                id='term_deprecated'
                label='Deprecated'
                checked={this.state.deprecated}
                onChange={(e) => this.setState({ deprecated: e.target.checked, error: null })}
              />
            )}
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
              {term ? 'Save' : 'Add'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    )
  }
}

// Only missing while the modal animates closed
VocabularyTermModal.propTypes = {
  broaderOptions: PropTypes.array,
  handleDone: PropTypes.func,
  handleHide: PropTypes.func.isRequired,
  show: PropTypes.bool.isRequired,
  term: PropTypes.object,
  vocabulary: PropTypes.object
}

export default connectModal({ name: 'vocabularyTerm', destroyOnHide: true })(VocabularyTermModal)
