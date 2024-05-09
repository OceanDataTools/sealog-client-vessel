import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Card, Col } from 'react-bootstrap';

class EventOptionsCard extends Component {

  static propTypes = {
    event_options: PropTypes.array.isRequired
  }

  render() {
    if(!this.props.event_options) {
      return null;
    }

    const return_event_options = this.props.event_options.reduce((filtered, event_option, index) => {
      if(event_option.event_option_name !== 'event_comment') {
        filtered.push(
          <div key={`event_option_${index}`}>
            <span className="data-name">{event_option.event_option_name.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}:</span>{' '}
            <span className="float-right" style={{wordWrap:'break-word'}} >{event_option.event_option_value}</span>
            <br/>
          </div>
        );
      }
      return filtered
    },[])

    return (return_event_options.length) ? (
      <Col className="event-data-col" sm={6} md={6} lg={4}>
        <Card className="event-data-card">
          <Card.Header>Event Options</Card.Header>
          <Card.Body>
            {return_event_options}
          </Card.Body>
        </Card>
      </Col>
    ) : null
  }
}

export default EventOptionsCard;