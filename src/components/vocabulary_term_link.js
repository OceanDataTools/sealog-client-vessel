import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { get_vocabulary_term } from '../api'

// 'SDN:L22::TOOL0058' -> { collection: 'L22', id: 'TOOL0058' }
const parseNotation = (notation) => {
  const match = /^[^:]+:([^:]+)::(.+)$/.exec(notation || '')
  return match ? { collection: match[1], id: match[2] } : null
}

// Term lookups shared by every link, so each term is only fetched once per
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

// A vocabulary term ID (notation), linked to its definition, with the term's
// label on hover
class VocabularyTermLink extends Component {
  constructor(props) {
    super(props)

    this.state = { term: null }
  }

  componentDidMount() {
    this._mounted = true
    this.fetchTerm()
  }

  componentDidUpdate(prevProps) {
    if (prevProps.notation !== this.props.notation) {
      this.fetchTerm()
    }
  }

  componentWillUnmount() {
    this._mounted = false
  }

  async fetchTerm() {
    const { notation } = this.props
    const term = await fetchTerm(notation)
    if (this._mounted && notation === this.props.notation) {
      this.setState({ term })
    }
  }

  render() {
    const { notation } = this.props
    const { term } = this.state
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
}

VocabularyTermLink.propTypes = {
  notation: PropTypes.string.isRequired
}

export default VocabularyTermLink
