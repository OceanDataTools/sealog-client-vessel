import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Card, Col } from 'react-bootstrap'
import VocabularyTermLink from './vocabulary_term_link'

class EventOptionsCard extends Component {
  render() {
    if (!this.props.event || !this.props.event.event_options) {
      return null
    }

    const return_event_options = this.props.event.event_options.reduce((filtered, event_option, index) => {
      if (event_option.event_option_name !== 'event_comment') {
        filtered.push(
          <div key={`event_option_${index}`}>
            <span className='data-name'>{event_option.event_option_name.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}:</span>{' '}
            <span className='float-end' style={{ wordWrap: 'break-word' }}>
              {event_option.event_option_value}
            </span>
            <br />
            {event_option.event_option_notation && (
              // The vocabulary term IDs behind the value (checkboxes: joined with ';')
              <div className='small text-end text-break'>
                {event_option.event_option_notation.split(';').map((notation, i) => (
                  <React.Fragment key={notation}>
                    {i > 0 && ', '}
                    <VocabularyTermLink notation={notation} />
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        )
      }
      return filtered
    }, [])

    return return_event_options.length ? (
      <Col className='event-data-col' sm={this.props.sm || 6} md={this.props.md || 4} lg={this.props.lg || 3} xl={this.props.xl || 3}>
        <Card className='event-data-card'>
          <Card.Header className='event-details'>Event Options</Card.Header>
          <Card.Body>{return_event_options}</Card.Body>
        </Card>
      </Col>
    ) : null
  }
}

EventOptionsCard.propTypes = {
  event: PropTypes.object.isRequired,
  sm: PropTypes.number,
  md: PropTypes.number,
  lg: PropTypes.number,
  xl: PropTypes.number
}

export default EventOptionsCard
