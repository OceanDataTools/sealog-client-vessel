import React, { Component } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { connect } from 'react-redux'
import { Alert, Badge, Button, Card, Col, Form, OverlayTrigger, Row, Table, Tooltip } from 'react-bootstrap'
import PropTypes from 'prop-types'
import { Client } from '@hapi/nes/lib/client'
import CustomPagination from './custom_pagination'
import DeleteModal from './delete_modal'
import VocabularyTermModal from './vocabulary_term_modal'
import {
  delete_vocabulary_term,
  get_vocabularies,
  get_vocabulary_terms,
  get_vocabulary_visibility,
  set_vocabulary_visibility
} from '../api'
import { apiErrorMessage, connectWSClient } from '../utils'
import { WS_ROOT_URL } from '../client_settings'
import * as mapDispatchToProps from '../actions'

const EDIT_ROLES = ['admin', 'cruise_manager', 'template_manager']
const TERMS_PER_PAGE = 50

const ALL_TERMS = { include_hidden: true, include_deprecated: true }

// Device catalogues (and local equipment lists) are grouped by their L05
// category through the terms' broader links
const hasCategories = (vocabulary) => vocabulary.collection === 'L22' || vocabulary.source === 'local'

// NVS collections a local term can be grouped under (its broader terms)
const BROADER_COLLECTIONS = ['L05', 'L06']

const sameSet = (a, b) => a.size === b.size && [...a].every((item) => b.has(item))

// Choose which terms of a vocabulary this server shows (#93), and edit the
// terms of local vocabularies (#94)
class VocabularyTerms extends Component {
  constructor(props) {
    super(props)

    this.state = {
      vocabulary: null,
      terms: [],
      categories: [],
      broaderOptions: [],
      saved: null,
      mode: 'hide_listed',
      listed: new Set(),
      search: '',
      category: '',
      view: 'all',
      includeDeprecated: false,
      page: 1,
      loading: true,
      saving: false,
      stale: false,
      error: null,
      message: null
    }

    this.client = new Client(`${WS_ROOT_URL}`)
    this.handleUpdate = this.handleUpdate.bind(this)
    this.handleSave = this.handleSave.bind(this)
  }

  componentDidMount() {
    this.load()
    connectWSClient(this.client, { '/ws/status/updateVocabularies': this.handleUpdate })
  }

  componentWillUnmount() {
    this.client.disconnect()
  }

  get code() {
    return this.props.match.params.code
  }

  async load() {
    const [vocabularies, terms, visibility] = await Promise.all([
      get_vocabularies(),
      get_vocabulary_terms(this.code, ALL_TERMS),
      get_vocabulary_visibility(this.code)
    ])

    const vocabulary = vocabularies.find((item) => item.collection === this.code)
    if (!vocabulary || !terms || !visibility) {
      this.setState({ loading: false, vocabulary: null })
      return
    }

    const cached = BROADER_COLLECTIONS.map((collection) => vocabularies.find((item) => item.collection === collection)).filter(Boolean)
    const needed = cached.filter((item) => (vocabulary.source === 'local' ? true : item.collection === 'L05' && hasCategories(vocabulary)))
    const broaderOptions = await Promise.all(
      needed.map(async (item) => ({
        collection: item.collection,
        title: item.title,
        terms: (await get_vocabulary_terms(item.collection)) || []
      }))
    )
    const l05 = broaderOptions.find((group) => group.collection === 'L05')

    this.setState({
      vocabulary,
      terms,
      categories: hasCategories(vocabulary) && l05 ? l05.terms : [],
      broaderOptions: vocabulary.source === 'local' ? broaderOptions : [],
      saved: visibility,
      mode: visibility.mode,
      listed: new Set(visibility.terms),
      loading: false,
      stale: false
    })
  }

  handleUpdate(update) {
    if (update.collection !== this.code) {
      return
    }

    // Don't throw away unsaved choices; offer to reload instead
    if (this.isDirty()) {
      this.setState({ stale: true })
    } else {
      this.load()
    }
  }

  isLocal() {
    return this.state.vocabulary && this.state.vocabulary.source === 'local'
  }

  handleTermModal(term = null) {
    this.setState({ error: null, message: null })
    this.props.showModal('vocabularyTerm', {
      vocabulary: this.state.vocabulary,
      term,
      broaderOptions: this.state.broaderOptions,
      handleDone: (message) => {
        const hidden =
          !term && this.state.mode === 'show_only_listed'
            ? ' It stays hidden until you select it, as this vocabulary only shows selected terms.'
            : ''
        this.setState({ message: message + hidden })
        this.load()
      }
    })
  }

  handleDeleteTerm(term) {
    this.props.showModal('deleteModal', {
      id: term.id,
      handleDelete: async (id) => {
        const response = await delete_vocabulary_term(this.code, id)

        if (response.error) {
          this.setState({ error: `Could not delete ${id}: ${apiErrorMessage(response.error)}` })
        } else if (response.data.action === 'deprecated') {
          this.setState({ message: `${id} is recorded on events, so it was kept and marked deprecated.` })
        } else {
          this.setState({ message: `Deleted ${id}.` })
        }

        this.load()
      },
      message: `the term ${term.notation}`
    })
  }

  isDirty() {
    const { saved, mode, listed } = this.state
    return Boolean(saved) && (saved.mode !== mode || !sameSet(new Set(saved.terms), listed))
  }

  isShown(id) {
    return this.state.mode === 'show_only_listed' ? this.state.listed.has(id) : !this.state.listed.has(id)
  }

  setShown(ids, shown) {
    this.setState((prevState) => {
      const listed = new Set(prevState.listed)
      // In show-only mode the list holds shown terms, otherwise hidden ones
      const list = prevState.mode === 'show_only_listed' ? shown : !shown

      ids.forEach((id) => (list ? listed.add(id) : listed.delete(id)))
      return { listed, message: null }
    })
  }

  handleModeChange(mode) {
    // Each mode's list means something different, so start the new mode empty
    this.setState({ mode, listed: new Set(), page: 1, message: null })
  }

  handleDiscard() {
    const { saved } = this.state
    this.setState({ mode: saved.mode, listed: new Set(saved.terms), message: null })
  }

  async handleSave() {
    this.setState({ saving: true, error: null, message: null })

    const response = await set_vocabulary_visibility(this.code, { mode: this.state.mode, terms: [...this.state.listed] })

    if (response.error) {
      this.setState({ saving: false, error: `Could not save: ${apiErrorMessage(response.error)}` })
      return
    }

    this.setState({ saving: false, saved: response.data, stale: false, message: 'Saved.' })
  }

  filteredTerms() {
    const { terms, search, category, view, includeDeprecated } = this.state
    const query = search.trim().toLowerCase()

    return terms.filter((term) => {
      if (term.deprecated && !includeDeprecated && !this.isShown(term.id)) {
        return false
      }

      if (category && !term.broader.includes(category)) {
        return false
      }

      if (view !== 'all' && this.isShown(term.id) !== (view === 'shown')) {
        return false
      }

      return !query || [term.prefLabel, term.altLabel, term.id, term.notation].some((value) => value && value.toLowerCase().includes(query))
    })
  }

  renderModes() {
    return (
      <Form.Group className='mb-2'>
        <Form.Check
          type='radio'
          id='mode_hide_listed'
          name='mode'
          checked={this.state.mode === 'hide_listed'}
          onChange={() => this.handleModeChange('hide_listed')}
          label='Show all terms except the ones I hide'
        />
        <Form.Check
          type='radio'
          id='mode_show_only_listed'
          name='mode'
          checked={this.state.mode === 'show_only_listed'}
          onChange={() => this.handleModeChange('show_only_listed')}
          label='Show only the terms I select'
        />
        <Form.Text>
          {this.state.mode === 'show_only_listed'
            ? 'Terms added to the vocabulary by later refreshes stay hidden until you select them.'
            : 'Terms added to the vocabulary by later refreshes are shown.'}{' '}
          Hidden terms aren&apos;t offered when building event templates; templates and events already using them are unchanged.
        </Form.Text>
      </Form.Group>
    )
  }

  renderFilters(matching) {
    const { categories, search, category, view, includeDeprecated } = this.state

    return (
      <Row className='g-2 align-items-center mb-2'>
        <Col md={3}>
          <Form.Control
            size='sm'
            type='text'
            placeholder='Search label, ID or notation'
            value={search}
            onChange={(e) => this.setState({ search: e.target.value, page: 1 })}
          />
        </Col>
        {categories.length > 0 && (
          <Col md={3}>
            <Form.Select size='sm' value={category} onChange={(e) => this.setState({ category: e.target.value, page: 1 })}>
              <option value=''>All categories (L05)</option>
              {categories.map((item) => (
                <option key={item.notation} value={item.notation}>
                  {item.prefLabel} ({item.id})
                </option>
              ))}
            </Form.Select>
          </Col>
        )}
        <Col md={2}>
          <Form.Select size='sm' value={view} onChange={(e) => this.setState({ view: e.target.value, page: 1 })}>
            <option value='all'>All terms</option>
            <option value='shown'>Shown only</option>
            <option value='hidden'>Hidden only</option>
          </Form.Select>
        </Col>
        <Col md='auto'>
          <Form.Check
            id='include_deprecated'
            label='Deprecated'
            checked={includeDeprecated}
            onChange={(e) => this.setState({ includeDeprecated: e.target.checked, page: 1 })}
          />
        </Col>
        <Col md='auto' className='ms-auto text-nowrap'>
          <Button
            size='sm'
            variant='outline-success'
            className='me-1'
            disabled={!matching.length}
            onClick={() =>
              this.setShown(
                matching.map((term) => term.id),
                true
              )
            }
          >
            Show {matching.length}
          </Button>
          <Button
            size='sm'
            variant='outline-secondary'
            disabled={!matching.length}
            onClick={() =>
              this.setShown(
                matching.map((term) => term.id),
                false
              )
            }
          >
            Hide {matching.length}
          </Button>
        </Col>
      </Row>
    )
  }

  renderTerm(term) {
    const shown = this.isShown(term.id)

    return (
      <tr key={term.id} className={shown ? '' : 'text-muted'}>
        <td className='text-center'>
          <Form.Check
            id={`shown_${term.id}`}
            aria-label={`Show ${term.prefLabel}`}
            checked={shown}
            onChange={(e) => this.setShown([term.id], e.target.checked)}
          />
        </td>
        <td>
          {term.prefLabel}
          {term.altLabel && <div className='small text-muted'>{term.altLabel}</div>}
          {term.deprecated && (
            <Badge
              bg='warning'
              text='dark'
              className='ms-1'
              title={term.replacedBy.length ? `Replaced by ${term.replacedBy.join(', ')}` : ''}
            >
              deprecated{term.replacedBy.length ? ` → ${term.replacedBy.join(', ')}` : ''}
            </Badge>
          )}
        </td>
        <td className='text-nowrap small'>
          {term.notation}
          {term.broader.length > 0 && <div className='text-muted'>in {term.broader.join(', ')}</div>}
        </td>
        <td className='small' title={term.definition}>
          {term.definition && term.definition.length > 120 ? `${term.definition.slice(0, 120)}…` : term.definition}
        </td>
        {this.isLocal() && <td className='text-center text-nowrap'>{this.renderTermActions(term)}</td>}
      </tr>
    )
  }

  renderTermActions(term) {
    // Saving the term reloads the page, which would discard visibility edits
    if (this.isDirty()) {
      return null
    }

    return (
      <React.Fragment>
        <OverlayTrigger placement='top' overlay={<Tooltip id={`edit_${term.id}`}>Edit this term</Tooltip>}>
          <FontAwesomeIcon className='text-warning' onClick={() => this.handleTermModal(term)} icon='pencil-alt' fixedWidth role='button' />
        </OverlayTrigger>
        <OverlayTrigger placement='top' overlay={<Tooltip id={`delete_${term.id}`}>Delete this term</Tooltip>}>
          <FontAwesomeIcon className='text-danger' onClick={() => this.handleDeleteTerm(term)} icon='trash' fixedWidth role='button' />
        </OverlayTrigger>
      </React.Fragment>
    )
  }

  renderSource() {
    const { vocabulary } = this.state

    if (this.isLocal()) {
      return (
        <div className='d-flex align-items-center mb-2'>
          <span>
            <Badge bg='success'>Local</Badge> Terms are identified as{' '}
            <code>
              {vocabulary.prefix}:{vocabulary.collection}::&lt;id&gt;
            </code>
            .
          </span>
          <Button
            size='sm'
            variant='outline-primary'
            className='ms-auto'
            disabled={this.isDirty()}
            title={this.isDirty() ? 'Save or discard your visibility changes first' : ''}
            onClick={() => this.handleTermModal()}
          >
            Add Term
          </Button>
        </div>
      )
    }

    const from = vocabulary.source === 'url' ? ` from ${vocabulary.source_url}` : ''
    return (
      <div className='small text-muted mb-2'>
        Downloaded vocabulary ({vocabulary.source}
        {from}): its terms can be hidden here but not edited.
      </div>
    )
  }

  renderBody() {
    const { vocabulary, terms, page, saving, stale, error, message } = this.state
    const matching = this.filteredTerms()
    const shownCount = terms.filter((term) => this.isShown(term.id)).length
    const dirty = this.isDirty()

    return (
      <React.Fragment>
        {stale && (
          <Alert variant='warning'>
            This vocabulary was changed elsewhere.{' '}
            <Button size='sm' variant='outline-dark' onClick={() => this.load()}>
              Reload
            </Button>{' '}
            (discards your unsaved changes)
          </Alert>
        )}
        {error && (
          <Alert variant='danger' dismissible onClose={() => this.setState({ error: null })}>
            {error}
          </Alert>
        )}
        <Card className='border-secondary'>
          <Card.Header>
            <Button variant='link' size='sm' className='p-0 me-2' onClick={this.props.gotoVocabularies}>
              Vocabularies
            </Button>
            / <strong>{vocabulary.collection}</strong> {vocabulary.title}
            <span className='float-end'>
              {shownCount} of {terms.length} shown
              {dirty && (
                <Badge bg='warning' text='dark' className='ms-2'>
                  unsaved
                </Badge>
              )}
            </span>
          </Card.Header>
          <Card.Body>
            {this.renderSource()}
            {this.renderModes()}
            {this.renderFilters(matching)}
            <Table bordered striped size='sm' className='mb-0'>
              <thead>
                <tr>
                  <th className='text-center' style={{ width: '60px' }}>
                    Shown
                  </th>
                  <th>Term</th>
                  <th>Notation</th>
                  <th>Definition</th>
                  {this.isLocal() && (
                    <th className='text-center' style={{ width: '60px' }}>
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {matching.length ? (
                  matching.slice((page - 1) * TERMS_PER_PAGE, page * TERMS_PER_PAGE).map((term) => this.renderTerm(term))
                ) : (
                  <tr>
                    <td colSpan={this.isLocal() ? 5 : 4}>No matching terms</td>
                  </tr>
                )}
              </tbody>
            </Table>
            <CustomPagination
              page={page}
              count={matching.length}
              pageSelectFunc={(next) => this.setState({ page: next })}
              maxPerPage={TERMS_PER_PAGE}
            />
          </Card.Body>
          <Card.Footer className='text-end'>
            {message && <span className='text-success me-2'>{message}</span>}
            <Button size='sm' variant='secondary' className='me-1' disabled={!dirty || saving} onClick={() => this.handleDiscard()}>
              Discard Changes
            </Button>
            <Button size='sm' variant='primary' disabled={!dirty || saving} onClick={this.handleSave}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </Card.Footer>
        </Card>
      </React.Fragment>
    )
  }

  render() {
    if (!this.props.roles) {
      return <div>Loading...</div>
    }

    if (!this.props.roles.some((item) => EDIT_ROLES.includes(item))) {
      return <div>What are YOU doing here?</div>
    }

    let body
    if (this.state.loading) {
      body = <div>Loading...</div>
    } else if (!this.state.vocabulary) {
      body = <Alert variant='warning'>No vocabulary found for {this.code}.</Alert>
    } else {
      body = this.renderBody()
    }

    return (
      <React.Fragment>
        <DeleteModal />
        <VocabularyTermModal />
        <Row className='py-2 px-1 d-flex justify-content-center'>
          <Col className='px-1' sm={12} xl={10}>
            {body}
          </Col>
        </Row>
      </React.Fragment>
    )
  }
}

VocabularyTerms.propTypes = {
  gotoVocabularies: PropTypes.func.isRequired,
  match: PropTypes.object.isRequired,
  roles: PropTypes.array,
  showModal: PropTypes.func.isRequired
}

const mapStateToProps = (state) => {
  return {
    roles: state.user.profile.roles
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(VocabularyTerms)
