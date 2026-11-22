import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Card, Col } from 'react-bootstrap'
import { formatAuxDataSourceName } from '../vocab'
import { AUX_DATA_DATASOURCE_REPLACE } from '../client_settings'
import { get_vocabulary_term } from '../api'

// 'SDN:L22::TOOL0058' -> { collection: 'L22', id: 'TOOL0058' }
const parseNotation = (notation) => {
  const match = /^[^:]+:([^:]+)::(.+)$/.exec(notation || '')
  return match ? { collection: match[1], id: match[2] } : null
}

// Term lookups shared by every card, so each term is only fetched once per
// page load
const termRequests = new Map()

const fetchTerm = (notation) => {
  if (!termRequests.has(notation)) {
    const parsed = parseNotation(notation)
    termRequests.set(notation, parsed ? get_vocabulary_term(parsed.collection, parsed.id) : Promise.resolve(null))
  }

  return termRequests.get(notation)
}

// The term's own page: its URI when it has one (NVS and most URL sources),
// else the NVS page for SDN notations. Local terms have none.
const termLink = (notation, term) => {
  if (term && /^https?:\/\//.test(term.uri)) {
    return term.uri
  }

  const parsed = parseNotation(notation)
  if (parsed && notation.startsWith('SDN:')) {
    return `http://vocab.nerc.ac.uk/collection/${parsed.collection}/current/${parsed.id}/`
  }

  return null
}

class AuxDataCard extends Component {
  render() {
    const aux_data_points = this.props.aux_data.data_array.map((data, index) => {
      return (
        <div key={`${this.props.aux_data.data_source}_data_point_${index}`}>
          <span className='data-name'>{data.data_name.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}:</span>{' '}
          <span className='float-end' style={{ wordWrap: 'break-word' }}>
            {data.data_value} {data.data_uom}
          </span>
          <br />
        </div>
      )
    })

    return (
      <Col
        className='event-data-col'
        key={`${this.props.aux_data.data_source}_col`}
        sm={this.props.sm || 6}
        md={this.props.md || 4}
        lg={this.props.lg || 3}
        xl={this.props.xl || 3}
      >
        <Card className='event-data-card' key={`${this.props.aux_data.data_source}`}>
          <Card.Header className='event-details'>{formatAuxDataSourceName(this.props.aux_data.data_source)}</Card.Header>
          <Card.Body>{aux_data_points}</Card.Body>
        </Card>
      </Col>
    )
  }
}

AuxDataCard.propTypes = {
  aux_data: PropTypes.object.isRequired,
  sm: PropTypes.number,
  md: PropTypes.number,
  lg: PropTypes.number,
  xl: PropTypes.number
}

// The 'vocab' aux_data (sealog-server#149): the term notations behind the
// event's options, linked to their definitions with the label on hover.
class VocabAuxDataCard extends Component {
  constructor(props) {
    super(props)

    this.state = {
      terms: {}
    }
  }

  componentDidMount() {
    this._mounted = true
    this.fetchTerms()
  }

  componentDidUpdate(prevProps) {
    if (prevProps.aux_data !== this.props.aux_data) {
      this.fetchTerms()
    }
  }

  componentWillUnmount() {
    this._mounted = false
  }

  fetchTerms() {
    this.props.aux_data.data_array.forEach(async (data) => {
      const term = await fetchTerm(data.data_value)
      if (term && this._mounted) {
        this.setState((state) => ({ terms: { ...state.terms, [data.data_value]: term } }))
      }
    })
  }

  renderNotation(notation) {
    const term = this.state.terms[notation]
    const hover = term ? `${term.prefLabel}${term.deprecated ? ' (deprecated)' : ''}` : undefined
    const link = termLink(notation, term)

    if (!link) {
      return <span title={hover}>{notation}</span>
    }

    return (
      <a href={link} target='_blank' rel='noopener noreferrer' title={hover}>
        {notation}
      </a>
    )
  }

  render() {
    const title = AUX_DATA_DATASOURCE_REPLACE && AUX_DATA_DATASOURCE_REPLACE.vocab ? AUX_DATA_DATASOURCE_REPLACE.vocab : 'Vocabulary Terms'

    const aux_data_points = this.props.aux_data.data_array.map((data, index) => {
      return (
        <div key={`vocab_data_point_${index}`}>
          <span className='data-name'>{data.data_name.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}:</span>{' '}
          <span className='float-end' style={{ wordWrap: 'break-word' }}>
            {this.renderNotation(data.data_value)}
          </span>
          <br />
        </div>
      )
    })

    return (
      <Col className='event-data-col' sm={this.props.sm || 6} md={this.props.md || 4} lg={this.props.lg || 3} xl={this.props.xl || 3}>
        <Card className='event-data-card'>
          <Card.Header className='event-details'>{title}</Card.Header>
          <Card.Body>{aux_data_points}</Card.Body>
        </Card>
      </Col>
    )
  }
}

VocabAuxDataCard.propTypes = AuxDataCard.propTypes

class AuxDataCards extends Component {
  render() {
    return this.props.aux_data.map((aux_data) => {
      const CardType = aux_data.data_source === 'vocab' ? VocabAuxDataCard : AuxDataCard
      return (
        <CardType
          aux_data={aux_data}
          key={`${aux_data.data_source}_col`}
          sm={this.props.sm}
          md={this.props.md}
          lg={this.props.lg}
          xl={this.props.xl}
        />
      )
    })
  }
}

AuxDataCards.propTypes = {
  aux_data: PropTypes.array.isRequired,
  sm: PropTypes.number,
  md: PropTypes.number,
  lg: PropTypes.number,
  xl: PropTypes.number
}

export default AuxDataCards
