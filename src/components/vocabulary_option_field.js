import React, { Component } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Alert, Badge, Button, Col, Form, Row } from 'react-bootstrap'
import PropTypes from 'prop-types'
import { get_vocabularies, get_vocabulary_terms } from '../api'
import { ALL_TERMS, hasCategories } from '../vocabularies'
import CategorySelect from './category_select'

// The option types that can take their values from a vocabulary
export const VOCABULARY_OPTION_TYPES = ['dropdown', 'radio buttons', 'checkboxes', 'static text']

const TERMS_SHOWN = 50
const PREVIEW_VALUES = 20

// Loaded once per revision (bumped when a vocabulary changes) and shared by
// every option in the form. The revision restarts with each editor, which
// clears the cache when it opens, so changes made meanwhile aren't missed.
const cache = new Map()

export const clearVocabularyCache = () => cache.clear()

const cached = (key, revision, load) => {
  const cacheKey = `${revision}:${key}`
  if (!cache.has(cacheKey)) {
    cache.set(cacheKey, load())
  }

  return cache.get(cacheKey)
}

// A vocabulary's terms (hidden and deprecated included), or null when the
// vocabulary doesn't exist
export const loadVocabularyTerms = async (collection, revision) => {
  const vocabularies = (await cached('vocabularies', revision, get_vocabularies)) || []
  if (!vocabularies.some((item) => item.collection === collection)) {
    return null
  }

  return (await cached(collection, revision, () => get_vocabulary_terms(collection, ALL_TERMS))) || []
}

const byLabel = (a, b) => a.prefLabel.localeCompare(b.prefLabel)

// The values the server fills in for a reference (see sealog-server
// lib/template_vocab.js): shown, current terms, the listed ones in order or
// else all by label, with the ID appended to duplicate labels.
export const resolveValues = (vocab, terms) => {
  const byId = new Map(terms.map((term) => [term.id, term]))
  const candidates = vocab.terms ? vocab.terms.map((id) => byId.get(id)).filter(Boolean) : [...terms].sort(byLabel)
  const offered = candidates.filter((term) => !term.deprecated && !term.hidden)

  const labelCounts = new Map()
  offered.forEach((term) => labelCounts.set(term.prefLabel, (labelCounts.get(term.prefLabel) || 0) + 1))

  return offered.map((term) => (labelCounts.get(term.prefLabel) > 1 ? `${term.prefLabel} (${term.id})` : term.prefLabel))
}

// A switch to take an option's values from a vocabulary, then the vocabulary,
// all of its shown terms or only some, and the default. Used as a redux-form
// Field for event_option_vocab ({ collection, terms? }).
class VocabularyOptionField extends Component {
  constructor(props) {
    super(props)

    this.state = {
      vocabularies: null,
      terms: null,
      categories: [],
      search: '',
      category: ''
    }
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

  get vocab() {
    return this.props.input.value || null
  }

  collection(props = this.props) {
    return (props.input.value && props.input.value.collection) || ''
  }

  get single() {
    return this.props.optionType === 'static text'
  }

  async load() {
    const { revision } = this.props
    const vocabularies = await cached('vocabularies', revision, get_vocabularies)
    const collection = this.collection()
    const vocabulary = vocabularies.find((item) => item.collection === collection)

    let terms = null
    let categories = []
    if (vocabulary) {
      terms = (await cached(collection, revision, () => get_vocabulary_terms(collection, ALL_TERMS))) || []
      if (hasCategories(vocabulary) && vocabularies.some((item) => item.collection === 'L05')) {
        categories = (await cached('L05', revision, () => get_vocabulary_terms('L05'))) || []
      }
    }

    // Ignore a load overtaken by another choice of vocabulary
    if (!this._unmounted && collection === this.collection()) {
      this.setState({ vocabularies, terms, categories })
    }
  }

  setVocab(vocab) {
    this.props.input.onChange(vocab)
  }

  handleToggle(on) {
    if (on) {
      this.setVocab(this.single ? { collection: '', terms: [] } : { collection: '' })
      return
    }

    // Keep the current labels as a plain value list
    const values = this.vocab && this.state.terms ? resolveValues(this.vocab, this.state.terms) : []
    this.props.onDetach(values)
    this.setVocab(null)
  }

  handleCollectionChange(collection) {
    this.setState({ terms: null, categories: [], search: '', category: '' })
    this.props.onDefaultChange('')
    this.setVocab(this.single ? { collection, terms: [] } : { collection })
  }

  handleModeChange(onlyListed) {
    this.setVocab(onlyListed ? { collection: this.collection(), terms: [] } : { collection: this.collection() })
  }

  setTerms(terms) {
    this.setVocab({ collection: this.collection(), terms })
  }

  toggleTerm(id, checked) {
    if (this.single) {
      this.setTerms([id])
      return
    }

    const listed = this.vocab.terms || []
    this.setTerms(checked ? [...listed, id] : listed.filter((item) => item !== id))
  }

  replaceTerm(id, replacement) {
    const listed = this.vocab.terms
    this.setTerms(
      listed.includes(replacement) ? listed.filter((item) => item !== id) : listed.map((item) => (item === id ? replacement : item))
    )
  }

  // Listed terms that are no longer offered, with why
  problems() {
    const byId = new Map(this.state.terms.map((term) => [term.id, term]))

    return (this.vocab.terms || []).flatMap((id) => {
      const term = byId.get(id)
      if (!term) {
        return [{ id, label: id, reason: 'is no longer in the vocabulary' }]
      }

      if (term.deprecated) {
        const replacement = (term.replacedBy || []).map((notation) => notation.split('::').pop()).find((item) => byId.has(item))
        return [{ id, label: term.prefLabel, reason: 'is deprecated', replacement: replacement && byId.get(replacement) }]
      }

      if (term.hidden) {
        return [{ id, label: term.prefLabel, reason: 'is hidden on this server' }]
      }

      return []
    })
  }

  filteredTerms() {
    const query = this.state.search.trim().toLowerCase()
    const { category } = this.state

    return this.state.terms.filter((term) => {
      if (term.deprecated || term.hidden) {
        return false
      }

      if (category && !term.broader.includes(category)) {
        return false
      }

      return !query || [term.prefLabel, term.altLabel, term.id].some((text) => text && text.toLowerCase().includes(query))
    })
  }

  renderVocabularySelect() {
    const { vocabularies } = this.state

    return (
      <Form.Group as={Col} sm={6} className='pb-2'>
        <Form.Label>
          Vocabulary<span className='text-danger'> *</span>
        </Form.Label>
        <Form.Select size='sm' value={this.collection()} onChange={(e) => this.handleCollectionChange(e.target.value)}>
          <option value=''></option>
          {(vocabularies || []).map((vocabulary) => (
            <option key={vocabulary.collection} value={vocabulary.collection}>
              {vocabulary.collection} - {vocabulary.title}
            </option>
          ))}
        </Form.Select>
      </Form.Group>
    )
  }

  renderMode() {
    if (this.single) {
      return null
    }

    const name = `${this.props.input.name}.mode`
    const onlyListed = Boolean(this.vocab.terms)

    return (
      <Form.Group as={Col} sm={6} className='pb-2'>
        <Form.Label>Values</Form.Label>
        <div>
          <Form.Check
            inline
            type='radio'
            id={`${name}.all`}
            name={name}
            label='All shown terms'
            checked={!onlyListed}
            onChange={() => this.handleModeChange(false)}
          />
          <Form.Check
            inline
            type='radio'
            id={`${name}.listed`}
            name={name}
            label='Only these terms'
            checked={onlyListed}
            onChange={() => this.handleModeChange(true)}
          />
        </div>
      </Form.Group>
    )
  }

  renderProblems() {
    const problems = this.problems()
    if (!problems.length) {
      return null
    }

    return (
      <Alert variant='warning' className='py-2 mb-2'>
        {problems.map((problem) => (
          <div key={problem.id}>
            <strong>{problem.label}</strong> ({problem.id}) {problem.reason}, so it isn&apos;t offered.{' '}
            {problem.replacement && (
              <Button
                variant='link'
                size='sm'
                className='p-0 align-baseline'
                onClick={() => this.replaceTerm(problem.id, problem.replacement.id)}
              >
                Switch to {problem.replacement.prefLabel}
              </Button>
            )}{' '}
            <Button
              variant='link'
              size='sm'
              className='p-0 align-baseline'
              onClick={() => this.setTerms(this.vocab.terms.filter((id) => id !== problem.id))}
            >
              Remove
            </Button>
          </div>
        ))}
      </Alert>
    )
  }

  renderListed() {
    if (this.single || !this.vocab.terms || !this.vocab.terms.length) {
      return null
    }

    const byId = new Map(this.state.terms.map((term) => [term.id, term]))

    return (
      <div className='mb-2'>
        {this.vocab.terms.map((id) => (
          <Badge key={id} bg='secondary' className='me-1 mb-1 fw-normal'>
            {byId.has(id) ? byId.get(id).prefLabel : id}{' '}
            <FontAwesomeIcon icon='times' role='button' title='Remove' onClick={() => this.toggleTerm(id, false)} />
          </Badge>
        ))}
      </div>
    )
  }

  renderPicker() {
    if (!this.single && !this.vocab.terms) {
      return null
    }

    const { categories, search, category } = this.state
    const listed = new Set(this.vocab.terms)
    const matches = this.filteredTerms()
    const name = `${this.props.input.name}.term`

    return (
      <div className='border rounded p-2 mb-2'>
        <Row className='g-2 mb-2'>
          <Col sm={categories.length ? 6 : 12}>
            <Form.Control
              size='sm'
              type='text'
              placeholder='Search label or ID'
              value={search}
              onChange={(e) => this.setState({ search: e.target.value })}
            />
          </Col>
          {categories.length > 0 && (
            <Col sm={6}>
              <CategorySelect categories={categories} value={category} onChange={(value) => this.setState({ category: value })} />
            </Col>
          )}
        </Row>
        <div style={{ maxHeight: '14rem', overflowY: 'auto' }}>
          {matches.slice(0, TERMS_SHOWN).map((term) => (
            <Form.Check
              key={term.id}
              type={this.single ? 'radio' : 'checkbox'}
              id={`${name}.${term.id}`}
              name={name}
              checked={listed.has(term.id)}
              onChange={(e) => this.toggleTerm(term.id, e.target.checked)}
              label={
                <span>
                  {term.prefLabel} <small className='text-muted'>{term.id}</small>
                </span>
              }
            />
          ))}
          {matches.length === 0 && <small className='text-muted'>No shown terms match.</small>}
        </div>
        {!this.single && category && matches.length > 0 && (
          <Button
            variant='link'
            size='sm'
            className='p-0'
            onClick={() => this.setTerms([...this.vocab.terms, ...matches.map((term) => term.id).filter((id) => !listed.has(id))])}
          >
            Add all {matches.length} in this category
          </Button>
        )}
        {matches.length > TERMS_SHOWN && (
          <small className='text-muted d-block'>
            Showing {TERMS_SHOWN} of {matches.length}; search to narrow the list.
          </small>
        )}
      </div>
    )
  }

  renderDefault(values) {
    const { optionType, defaultValue, onDefaultChange } = this.props
    const name = `${this.props.input.name}.default`

    if (this.single || !values.length) {
      return null
    }

    if (optionType === 'checkboxes') {
      const selected = (defaultValue || '')
        .split(',')
        .map((item) => item.trim())
        .filter((item) => values.includes(item))
      const toggle = (value, checked) =>
        onDefaultChange((checked ? [...selected, value] : selected.filter((item) => item !== value)).join(', '))

      return (
        <Form.Group className='pb-2'>
          <Form.Label>Default Selections</Form.Label>
          <div style={{ maxHeight: '8rem', overflowY: 'auto' }}>
            {values.map((value) => (
              <Form.Check
                key={value}
                inline
                id={`${name}.${value}`}
                label={value}
                checked={selected.includes(value)}
                onChange={(e) => toggle(value, e.target.checked)}
              />
            ))}
          </div>
        </Form.Group>
      )
    }

    return (
      <Form.Group as={Col} sm={6} className='pb-2 px-0'>
        <Form.Label>Default Selection</Form.Label>
        <Form.Select size='sm' value={values.includes(defaultValue) ? defaultValue : ''} onChange={(e) => onDefaultChange(e.target.value)}>
          <option value=''></option>
          {values.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Form.Select>
      </Form.Group>
    )
  }

  renderPreview(values) {
    if (!this.vocab.terms && !values.length) {
      return (
        <Alert variant='warning' className='py-2 mb-2'>
          No terms of this vocabulary are shown on this server.
        </Alert>
      )
    }

    if (!values.length) {
      return null
    }

    const more = values.length - PREVIEW_VALUES

    return (
      <Form.Text className='d-block mb-2'>
        {this.single ? 'Value' : `Values (${values.length})`}: {values.slice(0, PREVIEW_VALUES).join(', ')}
        {more > 0 && `, and ${more} more`}
      </Form.Text>
    )
  }

  renderReference() {
    const { meta } = this.props

    let body = null
    if (this.collection() && !this.state.terms) {
      body = <small className='text-muted'>Loading terms…</small>
    } else if (this.state.terms) {
      const values = resolveValues(this.vocab, this.state.terms)
      body = (
        <React.Fragment>
          {this.renderProblems()}
          {this.renderListed()}
          {this.renderPicker()}
          {this.renderPreview(values)}
          {this.renderDefault(values)}
        </React.Fragment>
      )
    }

    return (
      <React.Fragment>
        <Row>
          {this.renderVocabularySelect()}
          {this.collection() && this.renderMode()}
        </Row>
        {body}
        {meta.error && <div className='text-danger small mb-2'>{meta.error}</div>}
      </React.Fragment>
    )
  }

  render() {
    const { input } = this.props

    return (
      <div className='mb-2'>
        <Form.Switch
          id={`${input.name}.on`}
          label='Values from vocabulary'
          checked={Boolean(this.vocab)}
          onChange={(e) => this.handleToggle(e.target.checked)}
          className='mb-2'
        />
        {this.vocab && this.renderReference()}
      </div>
    )
  }
}

VocabularyOptionField.propTypes = {
  defaultValue: PropTypes.string,
  input: PropTypes.object.isRequired,
  meta: PropTypes.object.isRequired,
  onDefaultChange: PropTypes.func.isRequired,
  onDetach: PropTypes.func.isRequired,
  optionType: PropTypes.string.isRequired,
  revision: PropTypes.number
}

export default VocabularyOptionField
