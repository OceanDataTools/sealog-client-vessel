import React, { Component } from 'react'
import { Col, Form, Row } from 'react-bootstrap'
import PropTypes from 'prop-types'
import { loadVocabularyTerms } from './vocabulary_option_field'

const TERMS_SHOWN = 50

const byLabel = (a, b) => a.prefLabel.localeCompare(b.prefLabel)

// One term of a vocabulary, picked from a searchable list of its shown,
// current terms. Used as a redux-form Field for a term ID (e.g. a static
// text value picked by condition).
class TermSelectField extends Component {
  constructor(props) {
    super(props)

    this.state = { terms: null, search: '' }
  }

  componentDidMount() {
    this.load()
  }

  componentDidUpdate(prevProps) {
    if (prevProps.revision !== this.props.revision || prevProps.collection !== this.props.collection) {
      this.load()
    }
  }

  componentWillUnmount() {
    this._unmounted = true
  }

  async load() {
    const { collection, revision } = this.props
    const terms = collection ? await loadVocabularyTerms(collection, revision) : null

    // Ignore a load overtaken by another choice of vocabulary
    if (!this._unmounted && collection === this.props.collection) {
      this.setState({ terms })
    }
  }

  render() {
    const { input, meta, label, collection, sm, lg } = this.props
    const terms = this.state.terms || []
    const query = this.state.search.trim().toLowerCase()
    const current = terms.find((term) => term.id === input.value)

    const offered = terms
      .filter((term) => !term.deprecated && !term.hidden)
      .filter((term) => !query || [term.prefLabel, term.altLabel, term.id].some((text) => text && text.toLowerCase().includes(query)))
      .sort(byLabel)
    const shown = offered.slice(0, TERMS_SHOWN)
    // Keep the current term selectable, so the field shows what it holds
    const choices = current && !shown.includes(current) ? [current, ...shown] : shown
    const note = (term) => (term.deprecated ? ' - deprecated' : term.hidden ? ' - hidden on this server' : '')

    return (
      <Form.Group as={Col} sm={sm} lg={lg} className='pb-2'>
        <Form.Label>
          {label}
          <span className='text-danger'> *</span>
        </Form.Label>
        {!collection ? (
          <Form.Text className='d-block'>Choose a vocabulary above first.</Form.Text>
        ) : (
          <Row className='g-2'>
            <Col sm={5}>
              <Form.Control
                size='sm'
                type='text'
                placeholder='Search label or ID'
                value={this.state.search}
                onChange={(e) => this.setState({ search: e.target.value })}
              />
            </Col>
            <Col sm={7}>
              <Form.Select size='sm' {...input} isInvalid={meta.touched && !!meta.error}>
                <option value=''></option>
                {choices.map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.prefLabel} ({term.id}){note(term)}
                  </option>
                ))}
              </Form.Select>
              <Form.Control.Feedback type='invalid'>{meta.error}</Form.Control.Feedback>
              {offered.length > TERMS_SHOWN && (
                <Form.Text className='d-block'>
                  Showing {TERMS_SHOWN} of {offered.length}; search to narrow the list.
                </Form.Text>
              )}
              {input.value && this.state.terms && !current && (
                <Form.Text className='d-block text-danger'>
                  {input.value} isn&apos;t in {collection}.
                </Form.Text>
              )}
            </Col>
          </Row>
        )}
      </Form.Group>
    )
  }
}

TermSelectField.propTypes = {
  collection: PropTypes.string,
  input: PropTypes.object.isRequired,
  label: PropTypes.string,
  lg: PropTypes.number,
  meta: PropTypes.object.isRequired,
  revision: PropTypes.number,
  sm: PropTypes.number
}

export default TermSelectField
