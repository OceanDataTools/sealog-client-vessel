import React, { Component } from 'react'
import { connectModal } from 'redux-modal'
import PropTypes from 'prop-types'
import { Alert, Button, Form, Modal } from 'react-bootstrap'
import { add_vocabulary_source, create_vocabulary } from '../api'
import { apiErrorMessage } from '../utils'

const CODE_PATTERN = /^[A-Z0-9]{2,8}$/
const PREFIX_PATTERN = /^[A-Za-z0-9_-]{1,16}$/

// Create a local vocabulary (mode 'local') or pull one from a URL (mode 'url')
class VocabularyAddModal extends Component {
  constructor(props) {
    super(props)

    this.state = {
      code: '',
      title: '',
      prefix: '',
      url: '',
      error: null,
      submitting: false
    }

    this.handleSubmit = this.handleSubmit.bind(this)
  }

  validate() {
    const { code, title, prefix, url } = this.state

    if (!CODE_PATTERN.test(code)) {
      return 'The code must be 2-8 uppercase letters or digits, e.g. SKQEQ'
    }

    if (this.props.mode === 'local') {
      if (!title.trim()) {
        return 'A title is required'
      }

      if (prefix && !PREFIX_PATTERN.test(prefix)) {
        return 'The prefix may only use letters, digits, - and _ (up to 16)'
      }

      return null
    }

    return /^https?:\/\/.+/.test(url) ? null : 'The URL must start with http:// or https://'
  }

  async handleSubmit(event) {
    event.preventDefault()

    const error = this.validate()
    if (error) {
      this.setState({ error })
      return
    }

    this.setState({ error: null, submitting: true })

    const { code, title, prefix, url } = this.state
    const response =
      this.props.mode === 'local'
        ? await create_vocabulary({ collection: code, title: title.trim(), ...(prefix && { prefix }) })
        : await add_vocabulary_source(code, url.trim())

    if (response.error) {
      this.setState({ error: apiErrorMessage(response.error), submitting: false })
      return
    }

    // Before hiding: redux-modal drops the props on hide
    this.props.handleDone(response.data)
    this.props.handleHide()
  }

  renderLocalFields() {
    const notation = `${this.state.prefix || '<server prefix>'}:${this.state.code || 'CODE'}::<id>`

    return (
      <React.Fragment>
        <Form.Group className='mb-2'>
          <Form.Label>Title</Form.Label>
          <Form.Control size='sm' value={this.state.title} onChange={(e) => this.setState({ title: e.target.value, error: null })} />
        </Form.Group>
        <Form.Group className='mb-2'>
          <Form.Label>Prefix (optional)</Form.Label>
          <Form.Control
            size='sm'
            value={this.state.prefix}
            placeholder="Leave blank for the server's default"
            onChange={(e) => this.setState({ prefix: e.target.value.trim(), error: null })}
          />
          <Form.Text>
            Terms will be identified as <code>{notation}</code>. The prefix can&apos;t be changed later.
          </Form.Text>
        </Form.Group>
      </React.Fragment>
    )
  }

  renderUrlFields() {
    return (
      <Form.Group className='mb-2'>
        <Form.Label>URL</Form.Label>
        <Form.Control
          size='sm'
          value={this.state.url}
          placeholder='https://data.example.org/vocabularies/skq_equipment.json'
          onChange={(e) => this.setState({ url: e.target.value, error: null })}
        />
        <Form.Text>
          A Sealog vocabulary bundle (from Export; .json or .json.gz) or an NVS-style SKOS JSON-LD collection. The host must be allowed by
          the server&apos;s vocabularySourceHosts setting. Pulled vocabularies are owned by their source: terms can be hidden here but not
          edited.
        </Form.Text>
      </Form.Group>
    )
  }

  render() {
    const { show, handleHide, mode } = this.props

    return (
      <Modal size='md' show={show} onHide={handleHide}>
        <Form onSubmit={this.handleSubmit}>
          <Modal.Header className='bg-light' closeButton>
            <Modal.Title>{mode === 'local' ? 'New Local Vocabulary' : 'Add Vocabulary from URL'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className='mb-2'>
              <Form.Label>Code</Form.Label>
              <Form.Control
                size='sm'
                value={this.state.code}
                placeholder='e.g. SKQEQ'
                onChange={(e) => this.setState({ code: e.target.value.toUpperCase().trim(), error: null })}
              />
            </Form.Group>
            {mode === 'local' ? this.renderLocalFields() : this.renderUrlFields()}
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
              {mode === 'local' ? 'Create' : this.state.submitting ? 'Fetching…' : 'Add'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    )
  }
}

// handleDone and mode are only missing while the modal animates closed
VocabularyAddModal.propTypes = {
  handleDone: PropTypes.func,
  handleHide: PropTypes.func.isRequired,
  mode: PropTypes.oneOf(['local', 'url']),
  show: PropTypes.bool.isRequired
}

export default connectModal({ name: 'vocabularyAdd', destroyOnHide: true })(VocabularyAddModal)
