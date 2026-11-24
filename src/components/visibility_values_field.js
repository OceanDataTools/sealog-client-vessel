import React, { Component } from 'react'
import { Col, Form } from 'react-bootstrap'
import PropTypes from 'prop-types'
import { loadVocabularyTerms, resolveValues } from './vocabulary_option_field'

// The option types whose values can be ticked in a visibility condition
export const CONDITION_OPTION_TYPES = ['dropdown', 'radio buttons', 'checkboxes']

export const asList = (value) => {
  if (Array.isArray(value)) {
    return value
  }

  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

// The values of a visibility condition: a checkbox per value of the option
// it depends on, or a text box when that option has no fixed values. Used as
// a redux-form Field for event_option_visibility.event_option_values.
class VisibilityValuesField extends Component {
  constructor(props) {
    super(props)

    this.state = { terms: null }
  }

  componentDidMount() {
    this.load()
  }

  componentDidUpdate(prevProps) {
    if (prevProps.revision !== this.props.revision || this.collection(prevProps) !== this.collection()) {
      this.load()
    }
  }

  componentWillUnmount() {
    this._unmounted = true
  }

  collection(props = this.props) {
    const vocab = props.controller && props.controller.event_option_vocab
    return (vocab && vocab.collection) || ''
  }

  async load() {
    const collection = this.collection()
    const terms = collection ? await loadVocabularyTerms(collection, this.props.revision) : null

    // Ignore a load overtaken by another choice of vocabulary
    if (!this._unmounted && collection === this.collection()) {
      this.setState({ terms })
    }
  }

  get values() {
    const { controller } = this.props
    const vocab = controller.event_option_vocab

    if (vocab) {
      return vocab.collection && this.state.terms ? resolveValues(vocab, this.state.terms) : []
    }

    return asList(controller.event_option_values)
  }

  renderText() {
    const { input, meta } = this.props

    return (
      <Form.Group as={Col} xs={12} className='pb-2'>
        <Form.Label>
          {this.props.label}
          <span className='text-danger'> *</span>
        </Form.Label>
        <Form.Control as='textarea' rows={2} {...input} isInvalid={meta.touched && !!meta.error} />
        <Form.Text muted>Comma separated</Form.Text>
        <Form.Control.Feedback type='invalid'>{meta.error}</Form.Control.Feedback>
      </Form.Group>
    )
  }

  render() {
    const { input, meta, controller } = this.props

    if (!controller) {
      return null
    }

    if (!CONDITION_OPTION_TYPES.includes(controller.event_option_type)) {
      return this.renderText()
    }

    const selected = asList(input.value)
    const values = this.values
    // Values the option no longer offers stay listed until they're unticked
    const stale = selected.filter((value) => !values.includes(value))

    const toggle = (value, checked) => input.onChange(checked ? [...selected, value] : selected.filter((item) => item !== value))

    const checkbox = (value, isStale) => (
      <Form.Check
        key={value}
        id={`${input.name}.${value}`}
        label={isStale ? <span className='text-warning'>{value}</span> : value}
        inline
        checked={selected.includes(value)}
        onChange={(event) => toggle(value, event.target.checked)}
      />
    )

    let empty = null
    if (!values.length) {
      empty = (
        <div className='small text-muted'>
          {controller.event_option_vocab && controller.event_option_vocab.collection && !this.state.terms
            ? 'Loading…'
            : `${controller.event_option_name} has no values yet.`}
        </div>
      )
    }

    return (
      <Form.Group as={Col} xs={12} className='pb-2'>
        <Form.Label>
          {this.props.label}
          <span className='text-danger'> *</span>
        </Form.Label>
        <div>{values.map((value) => checkbox(value, false))}</div>
        {empty}
        {stale.length > 0 && (
          <div className='mt-1'>
            <div className='small text-warning'>No longer offered by {controller.event_option_name}; untick to remove:</div>
            <div>{stale.map((value) => checkbox(value, true))}</div>
          </div>
        )}
        {meta.error && <div className='small text-danger'>{meta.error}</div>}
      </Form.Group>
    )
  }
}

VisibilityValuesField.defaultProps = {
  label: 'Event option values'
}

VisibilityValuesField.propTypes = {
  controller: PropTypes.object,
  label: PropTypes.string,
  input: PropTypes.object.isRequired,
  meta: PropTypes.object.isRequired,
  revision: PropTypes.number.isRequired
}

export default VisibilityValuesField
