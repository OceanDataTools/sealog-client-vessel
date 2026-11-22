import React, { Component } from 'react'
import { connectModal } from 'redux-modal'
import PropTypes from 'prop-types'
import { Alert, Button, Form, Modal } from 'react-bootstrap'
import { create_vocabulary_term, update_vocabulary_term } from '../api'
import { apiErrorMessage } from '../utils'

const ID_PATTERN = /^[A-Z0-9_-]{1,64}$/

// 'ROV Odyssey (Sikuliaq)' -> 'ROV-ODYSSEY-SIKULIAQ'
const idFromLabel = (label) => {
  return label
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

// Add a term to a local vocabulary, or edit one (term given). A new term's
// ID is derived from its label unless edited; IDs can't be changed once
// created.
class VocabularyTermModal extends Component {
  constructor(props) {
    super(props)

    const term = props.term || {}
    this.state = {
      id: term.id || '',
      editingId: false,
      prefLabel: term.prefLabel || '',
      altLabel: term.altLabel || '',
      definition: term.definition || '',
      broader: term.broader || [],
      deprecated: Boolean(term.deprecated),
      // Open when an existing term already uses these fields
      showMore: Boolean(term.altLabel || (term.broader && term.broader.length)),
      error: null,
      submitting: false
    }

    this.handleSubmit = this.handleSubmit.bind(this)
  }

  validate() {
    if (!this.state.prefLabel.trim()) {
      return 'A label is required'
    }

    if (!this.props.term && !ID_PATTERN.test(this.state.id)) {
      return 'The ID may only use letters, digits, - and _ (up to 64)'
    }

    return null
  }

  handleLabelChange(prefLabel) {
    const changes = { prefLabel, error: null }

    // Keep deriving the ID until it's edited by hand
    if (!this.props.term && !this.state.editingId) {
      changes.id = idFromLabel(prefLabel)
    }

    this.setState(changes)
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

  renderNotation() {
    const { term, vocabulary } = this.props
    const notation = `${vocabulary.prefix}:${vocabulary.collection}::${this.state.id || '<ID>'}`

    if (term) {
      return (
        <Form.Text className='d-block mb-2'>
          Notation: <code>{notation}</code> (can&apos;t be changed)
        </Form.Text>
      )
    }

    if (this.state.editingId) {
      return (
        <Form.Group className='mb-2'>
          <Form.Label>ID</Form.Label>
          <Form.Control
            size='sm'
            value={this.state.id}
            onChange={(e) => this.setState({ id: e.target.value.toUpperCase().trim(), error: null })}
          />
          <Form.Text>
            Notation: <code>{notation}</code>. Letters, digits, - and _. The ID can&apos;t be changed later.
          </Form.Text>
        </Form.Group>
      )
    }

    return (
      <Form.Text className='d-block mb-2'>
        Notation: <code>{notation}</code>{' '}
        <Button variant='link' size='sm' className='p-0 align-baseline' onClick={() => this.setState({ editingId: true })}>
          Edit ID
        </Button>
      </Form.Text>
    )
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
        <Form.Label>Broader terms</Form.Label>
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
          Groups this term with NVS categories, e.g. L05 &quot;CTD&quot; or L06 &quot;ROV&quot;, so it shows up under them in category
          filters. Ctrl/Cmd-click to choose more than one.
          {this.state.broader.length > 0 && (
            <div>Selected: {this.state.broader.map((notation) => labels[notation] || notation).join(', ')}</div>
          )}
        </Form.Text>
      </Form.Group>
    )
  }

  handleBroaderChange(event) {
    const broader = Array.from(event.target.selectedOptions).map((option) => option.value)
    this.setState({ broader, error: null })
  }

  renderMore() {
    if (!this.state.showMore) {
      return (
        <Button variant='link' size='sm' className='p-0' onClick={() => this.setState({ showMore: true })}>
          More options (alternative label, broader terms)
        </Button>
      )
    }

    return (
      <React.Fragment>
        <Form.Group className='mb-2'>
          <Form.Label>Alternative label</Form.Label>
          <Form.Control
            size='sm'
            value={this.state.altLabel}
            placeholder='e.g. an abbreviation; also matched by searches'
            onChange={(e) => this.setState({ altLabel: e.target.value, error: null })}
          />
        </Form.Group>
        {this.renderBroader()}
      </React.Fragment>
    )
  }

  render() {
    const { show, handleHide, term, vocabulary } = this.props

    if (!vocabulary) {
      return null
    }

    return (
      <Modal size='lg' show={show} onHide={handleHide}>
        <Form onSubmit={this.handleSubmit}>
          <Modal.Header className='bg-light' closeButton>
            <Modal.Title>{term ? `Edit ${term.id}` : `Add Term to ${vocabulary.collection}`}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className='mb-1'>
              <Form.Label>Label</Form.Label>
              <Form.Control size='sm' autoFocus value={this.state.prefLabel} onChange={(e) => this.handleLabelChange(e.target.value)} />
            </Form.Group>
            {this.renderNotation()}
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
            {term && (
              <Form.Check
                id='term_deprecated'
                className='mb-2'
                label='Deprecated'
                checked={this.state.deprecated}
                onChange={(e) => this.setState({ deprecated: e.target.checked, error: null })}
              />
            )}
            {this.renderMore()}
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
