import React, { Component } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { connect } from 'react-redux'
import { Alert, Badge, Button, Card, Col, OverlayTrigger, Row, Spinner, Table, Tooltip } from 'react-bootstrap'
import PropTypes from 'prop-types'
import moment from 'moment'
import { Client } from '@hapi/nes/lib/client'
import DeleteModal from './delete_modal'
import VocabularyAddModal from './vocabulary_add_modal'
import VocabularyReportModal from './vocabulary_report_modal'
import { delete_vocabulary, export_vocabularies, get_vocabularies, import_vocabularies, refresh_vocabulary } from '../api'
import { apiErrorMessage, connectWSClient } from '../utils'
import { WS_ROOT_URL } from '../client_settings'
import { VOCABULARY_EDIT_ROLES } from '../vocabularies'
import * as mapDispatchToProps from '../actions'

// Vocabularies that can be refreshed: NVS collections (including the seed
// bundle's copies) and ones pulled from a URL
const REFRESHABLE_SOURCES = ['nvs', 'seed', 'url']

const SOURCE_LABELS = {
  nvs: 'NVS',
  seed: 'NVS (bundled)',
  import: 'Imported',
  local: 'Local',
  url: 'URL'
}

class Vocabularies extends Component {
  constructor(props) {
    super(props)

    this.state = {
      vocabularies: [],
      fetching: true,
      busy: {},
      error: null,
      notice: null
    }

    this.client = new Client(`${WS_ROOT_URL}`)
    this.importInput = React.createRef()

    this.fetchVocabularies = this.fetchVocabularies.bind(this)
    this.handleImport = this.handleImport.bind(this)
    this.showReports = this.showReports.bind(this)
  }

  componentDidMount() {
    this.fetchVocabularies()
    connectWSClient(this.client, { '/ws/status/updateVocabularies': this.fetchVocabularies })
  }

  componentWillUnmount() {
    this.client.disconnect()
  }

  async fetchVocabularies() {
    const vocabularies = await get_vocabularies()
    this.setState({ vocabularies, fetching: false })
  }

  setBusy(key, busy) {
    this.setState((prevState) => ({ busy: { ...prevState.busy, [key]: busy } }))
  }

  showError(error, prefix) {
    const status = error.response && error.response.status
    const suffix = status === 502 ? ' The cached copy is unchanged.' : ''
    this.setState({ error: `${prefix}: ${apiErrorMessage(error)}${suffix}` })
  }

  showReports(reports, title) {
    this.props.showModal('vocabularyReport', { reports, title })
  }

  async handleRefresh(code) {
    this.setState({ error: null, notice: null })
    this.setBusy(code, true)

    const response = await refresh_vocabulary(code)

    this.setBusy(code, false)
    if (response.error) {
      this.showError(response.error, `Could not refresh ${code}`)
      return
    }

    this.showReports([response.data], `Refreshed ${code}`)
    this.fetchVocabularies()
  }

  async handleExport(collections = []) {
    this.setState({ error: null, notice: null })

    const response = await export_vocabularies(collections)
    if (response.error) {
      this.showError(response.error, 'Could not export')
    }
  }

  async handleImport(event) {
    const file = event.target.files[0]
    event.target.value = ''
    if (!file) {
      return
    }

    this.setState({ error: null, notice: null })
    this.setBusy('import', true)

    const response = await import_vocabularies(file)

    this.setBusy('import', false)
    if (response.error) {
      this.showError(response.error, `Could not import ${file.name}`)
      return
    }

    this.showReports(response.data, `Imported ${file.name}`)
    this.fetchVocabularies()
  }

  handleDelete(code) {
    this.props.showModal('deleteModal', {
      id: code,
      handleDelete: async (id) => {
        this.setState({ error: null, notice: null })
        const response = await delete_vocabulary(id)
        if (response.error) {
          this.showError(response.error, `Could not delete ${id}`)
        } else if (response.data && response.data.action === 'retained') {
          this.setState({ notice: response.data })
        }

        this.fetchVocabularies()
      },
      message: `the ${code} vocabulary and its terms (terms recorded on events are kept, marked deprecated)`
    })
  }

  handleAdd(mode) {
    this.setState({ error: null, notice: null })
    this.props.showModal('vocabularyAdd', {
      mode,
      handleDone: (result) => {
        if (mode === 'url') {
          this.showReports([result], `Added ${result.collection}`)
        }

        this.fetchVocabularies()
      }
    })
  }

  renderSource(vocabulary) {
    // Source URLs are shown on the vocabulary's own page
    const detail = vocabulary.source === 'local' ? <div className='small text-muted'>prefix {vocabulary.prefix}</div> : null

    return (
      <React.Fragment>
        <Badge bg={vocabulary.source === 'local' ? 'success' : 'secondary'}>{SOURCE_LABELS[vocabulary.source] || vocabulary.source}</Badge>
        {detail}
      </React.Fragment>
    )
  }

  // A vocabulary delete that kept the terms recorded on events
  renderNotice({ collection, retained }) {
    const count = `${retained.length} term${retained.length === 1 ? '' : 's'}`

    return (
      <Alert variant='warning' dismissible onClose={() => this.setState({ notice: null })}>
        {collection} wasn&apos;t deleted: {count} recorded on events {retained.length === 1 ? 'was' : 'were'} kept, marked deprecated, so
        those events still resolve. Its other terms were deleted.
        <details className='mt-1'>
          <summary>Kept terms</summary>
          <small className='d-block' style={{ maxHeight: '10em', overflowY: 'auto' }}>
            {retained.join(', ')}
          </small>
        </details>
      </Alert>
    )
  }

  renderTerms(vocabulary) {
    if (vocabulary.visible_count === vocabulary.term_count) {
      return vocabulary.term_count
    }

    const mode = vocabulary.visibility_mode === 'show_only_listed' ? 'shown (show only listed)' : 'shown'
    return (
      <span title={`${vocabulary.visible_count} of ${vocabulary.term_count} terms ${mode}`}>
        {vocabulary.visible_count} / {vocabulary.term_count}
      </span>
    )
  }

  renderActions(vocabulary) {
    const code = vocabulary.collection
    const actions = []

    if (REFRESHABLE_SOURCES.includes(vocabulary.source)) {
      actions.push(
        this.state.busy[code] ? (
          <Spinner key='refresh' animation='border' size='sm' className='text-primary' />
        ) : (
          <OverlayTrigger key='refresh' placement='top' overlay={<Tooltip id={`refresh_${code}`}>Refresh from its source</Tooltip>}>
            <FontAwesomeIcon className='text-primary' onClick={() => this.handleRefresh(code)} icon='sync-alt' fixedWidth role='button' />
          </OverlayTrigger>
        )
      )
    }

    actions.push(
      <OverlayTrigger key='terms' placement='top' overlay={<Tooltip id={`terms_${code}`}>Choose visible terms</Tooltip>}>
        <FontAwesomeIcon className='text-success' onClick={() => this.props.gotoVocabulary(code)} icon='eye' fixedWidth role='button' />
      </OverlayTrigger>
    )

    actions.push(
      <OverlayTrigger key='export' placement='top' overlay={<Tooltip id={`export_${code}`}>Export this vocabulary</Tooltip>}>
        <FontAwesomeIcon className='text-primary' onClick={() => this.handleExport([code])} icon='download' fixedWidth role='button' />
      </OverlayTrigger>
    )

    if (this.props.roles.includes('admin')) {
      actions.push(
        <OverlayTrigger key='delete' placement='top' overlay={<Tooltip id={`delete_${code}`}>Delete this vocabulary</Tooltip>}>
          <FontAwesomeIcon className='text-danger' onClick={() => this.handleDelete(code)} icon='trash' fixedWidth role='button' />
        </OverlayTrigger>
      )
    }

    return actions
  }

  renderVocabularies() {
    if (this.state.fetching) {
      return (
        <tr>
          <td colSpan='6'>Loading...</td>
        </tr>
      )
    }

    if (!this.state.vocabularies.length) {
      return (
        <tr>
          <td colSpan='6'>No vocabularies found!</td>
        </tr>
      )
    }

    return this.state.vocabularies.map((vocabulary) => (
      <tr key={vocabulary.collection}>
        <td>
          <strong>{vocabulary.collection}</strong>
          <div className='small'>{vocabulary.title}</div>
        </td>
        <td>{this.renderSource(vocabulary)}</td>
        <td>{vocabulary.version || '-'}</td>
        <td className='text-nowrap'>{vocabulary.fetched ? moment.utc(vocabulary.fetched).format('YYYY-MM-DD HH:mm') : '-'}</td>
        <td className='text-end'>{this.renderTerms(vocabulary)}</td>
        <td className='text-center text-nowrap'>{this.renderActions(vocabulary)}</td>
      </tr>
    ))
  }

  renderButtons() {
    return (
      <div className='float-end my-2'>
        <input
          ref={this.importInput}
          type='file'
          accept='.json,.gz,application/json,application/gzip'
          hidden
          onChange={this.handleImport}
        />
        <Button
          className='me-1'
          variant='outline-primary'
          size='sm'
          disabled={this.state.busy.import}
          onClick={() => this.importInput.current.click()}
        >
          {this.state.busy.import ? 'Importing…' : 'Import From File'}
        </Button>
        <Button
          className='me-1'
          variant='outline-primary'
          size='sm'
          disabled={!this.state.vocabularies.length}
          onClick={() => this.handleExport()}
        >
          Export All
        </Button>
        {this.props.roles.includes('admin') && (
          <Button className='me-1' variant='outline-primary' size='sm' onClick={() => this.handleAdd('url')}>
            Add from URL
          </Button>
        )}
        <Button variant='outline-primary' size='sm' onClick={() => this.handleAdd('local')}>
          New Local Vocabulary
        </Button>
      </div>
    )
  }

  render() {
    if (!this.props.roles) {
      return <div>Loading...</div>
    }

    if (!this.props.roles.some((item) => VOCABULARY_EDIT_ROLES.includes(item))) {
      return <div>What are YOU doing here?</div>
    }

    return (
      <React.Fragment>
        <DeleteModal />
        <VocabularyAddModal />
        <VocabularyReportModal />
        <Row className='py-2 px-1 d-flex justify-content-center'>
          <Col className='px-1' sm={12} lg={10} xl={8}>
            {this.state.error && (
              <Alert variant='danger' dismissible onClose={() => this.setState({ error: null })}>
                {this.state.error}
              </Alert>
            )}
            {this.state.notice && this.renderNotice(this.state.notice)}
            <Card className='border-secondary'>
              <Card.Header>Controlled Vocabularies</Card.Header>
              <Table className='mb-0' bordered striped size='sm' responsive>
                <thead>
                  <tr>
                    <th>Vocabulary</th>
                    <th>Source</th>
                    <th>Version</th>
                    <th>Fetched (UTC)</th>
                    <th className='text-end'>Terms</th>
                    <th className='text-center' style={{ width: '110px' }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>{this.renderVocabularies()}</tbody>
              </Table>
            </Card>
            {this.renderButtons()}
            <div className='clearfix' />
            <div className='small text-muted'>
              Vocabulary content from the NERC Vocabulary Server is licensed under{' '}
              <a href='https://creativecommons.org/licenses/by/4.0/' target='_blank' rel='noreferrer'>
                CC BY 4.0
              </a>
              .
            </div>
          </Col>
        </Row>
      </React.Fragment>
    )
  }
}

Vocabularies.propTypes = {
  gotoVocabulary: PropTypes.func.isRequired,
  roles: PropTypes.array,
  showModal: PropTypes.func.isRequired
}

const mapStateToProps = (state) => {
  return {
    roles: state.user.profile.roles
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(Vocabularies)
