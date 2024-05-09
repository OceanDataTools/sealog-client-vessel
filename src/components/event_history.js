import React, { Component } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { connect } from 'react-redux';
import { Button, ListGroup, Image, Card, Tooltip, OverlayTrigger, Row, Col, Form, FormControl } from 'react-bootstrap';
import Moment from 'moment';
import ImagePreviewModal from './image_preview_modal';
import { Client } from '@hapi/nes/lib/client';
import { EXCLUDE_AUX_DATA_SOURCES, IMAGES_AUX_DATA_SOURCES, AUX_DATA_SORT_ORDER, WS_ROOT_URL } from '../client_config';
import { authorizationHeader, get_events, get_event_exports } from '../api';
import { getImageUrl, handleMissingImage } from '../utils';
import * as mapDispatchToProps from '../actions';

const excludeAuxDataSources = Array.from(new Set([ ...EXCLUDE_AUX_DATA_SOURCES, ...IMAGES_AUX_DATA_SOURCES]));

const eventHistoryRef = "eventHistory";

const maxEventsPerPage = 20;

class EventHistory extends Component {

  constructor (props) {
    super(props);

    this.state = {
      activePage: 1,
      event: {},
      events: [],
      fetching: false,
      hideASNAP: true,
      showNewEventDetails: true,
      showEventHistory: true,
      showEventHistoryFullscreen: false,
      filterTimer: null,
      eventFilterValue: null
    };

    this.client = new Client(`${WS_ROOT_URL}`);
    this.connectToWS = this.connectToWS.bind(this);
    this.handleSearchChange = this.handleSearchChange.bind(this);
    this.handleUpdateEvent = this.handleUpdateEvent.bind(this);
    this.fetchEventExport = this.fetchEventExport.bind(this);
    this.fetchEvents = this.fetchEvents.bind(this);
    this.toggleNewEventDetails = this.toggleNewEventDetails.bind(this);
    this.toggleEventHistory = this.toggleEventHistory.bind(this);
    this.toggleEventHistoryFullscreen = this.toggleEventHistoryFullscreen.bind(this);

  }

  componentDidMount() {
    if(this.props.authenticated) {
      this.fetchEvents();
      this.fetchEventExport();
      this.connectToWS();
    }
  }

  componentDidUpdate(prevProps, prevState) {
    if(prevState.activePage !== this.state.activePage) {
      this.fetchEvents();
    }

    if(prevState.eventFilterValue !== this.state.eventFilterValue) {
      this.setState({activePage: 1});
      this.fetchEvents();
    }

    if(prevState.hideASNAP !== this.state.hideASNAP) {
      this.setState({activePage: 1});
      this.fetchEvents();
    }

    if(prevState.showNewEventDetails !== this.state.showNewEventDetails && this.state.showNewEventDetails && this.state.events[0]) {
      this.fetchEventExport(this.state.events[0].id);
    }
  }

  componentWillUnmount() {
    if(this.props.authenticated) {
      this.client.disconnect();
    }
  }

  async connectToWS() {
    try {
      await this.client.connect({
        auth: authorizationHeader
      });

      const updateHandler = (update) => {
        if(this.state.events.length === 0) {
          this.fetchEvents();
          this.fetchEventExport();
        }
        else {
          const oldest_ts = Moment(this.state.events.slice(-1)[0].ts);
          const event_ts = Moment(this.state.event.ts);
          const update_ts = Moment(update.ts);

          if(update_ts > oldest_ts) {
            this.fetchEvents();
          }

          if(update_ts > event_ts) {
            this.fetchEventExport();
          }
        }
      };

      const updateAuxDataHandler = (update) => {
        const event = get_events({}, update.event_id) || {}
        if(event.id) {
          updateHandler(event);
        }
      };

      await this.client.subscribe('/ws/status/newEvents', updateHandler);
      await this.client.subscribe('/ws/status/updateEvents', updateHandler);
      await this.client.subscribe('/ws/status/deleteEvents', updateHandler);
      await this.client.subscribe('/ws/status/newEventAuxData', updateAuxDataHandler);
      await this.client.subscribe('/ws/status/updateEventAuxData', updateAuxDataHandler);

    } catch(error) {
      console.error("Problem connecting to websocket subscriptions")
      console.debug(error);

      // await this.connectToWS();
      // throw error;
    }
  }

  async fetchEvents() {
    this.setState({fetching: true});

    let eventFilterValue = (this.state.eventFilterValue) ? this.state.eventFilterValue : (this.state.hideASNAP) ? '!ASNAP' : null;

    let query = { 
      value: (eventFilterValue) ? eventFilterValue.split(',') : null,
      sort: 'newest',
      offset: (this.state.activePage-1) * maxEventsPerPage,
      limit: maxEventsPerPage
    }

    const events = await get_events(query);
    this.setState({events, fetching: false});
  }

  async fetchEventExport(event_id=null) {
    if(!event_id) {
      const query = {
        value: (this.state.hideASNAP) ? ['!ASNAP'] : null,
        sort: 'newest',
        limit: 1 
      }

      const event = await get_events(query);
      event_id = (event.length) ? event[0].id : null;
    }

    if(event_id) {
      const event_export = await get_event_exports({}, event_id);
      this.setState({ event: event_export });
    }
    else {
      this.setState({ event: {} });
    }
  }

  handleEventShowDetailsModal(event) {
    this.props.showModal('eventShowDetails', { event });
  }

  handleEventCommentModal(event) {
    this.props.showModal('eventComment', { event, handleUpdateEvent: this.handleUpdateEvent });
  }

  handleUpdateEvent(event) {
    this.props.updateEvent(event);
    this.fetchEvents();
  }

  handleSearchChange(event) {
    let eventFilterValue = (event.target.value !== '') ? event.target.value : null;
    clearTimeout(this.state.filterTimer);
    this.setState({ filterTimer: setTimeout(() => this.setState({ eventFilterValue }), 500) });
  }

  handleKeyDown(event) {
    if (event.key === 'Enter' && event.shiftKey === false) {
      event.preventDefault();
    }
  }

  toggleASNAP() {
    this.setState( prevState => ({hideASNAP: !prevState.hideASNAP}));
  }

  toggleEventHistory() {
    this.setState( prevState => ({ showEventHistory: !prevState.showEventHistory }));
  }

  toggleEventHistoryFullscreen() {
    this.setState( prevState => ({ showEventHistoryFullscreen: !prevState.showEventHistoryFullscreen }));
  }

  toggleNewEventDetails() {
    this.setState( prevState => ({showNewEventDetails: !prevState.showNewEventDetails}));
  }

  incrementPage() {
    this.setState( prevState => ({activePage: prevState.activePage+1}));
  }

  decrementPage() {
    this.setState( prevState => ({activePage: prevState.activePage-1}));
  }

  firstPage() {
    this.setState({activePage: 1});
  }

  handleImagePreviewModal(source, filepath) {
    this.props.showModal('imagePreview', { name: source, filepath: filepath })
  }

  renderImage(source, filepath) {
    return (
      <Card className="event-image-data-card" id={`image_${source}`}>
          <Image fluid onError={handleMissingImage} src={filepath} onClick={ () => this.handleImagePreviewModal(source, filepath)} />
          <span>{source}</span>
      </Card>
    )
  }

  renderImageryCard() {
    if(this.state.event.aux_data) { 
      let frameGrabberData = this.state.event.aux_data.filter(aux_data => IMAGES_AUX_DATA_SOURCES.includes(aux_data.data_source))
      let tmpData = []

      if(frameGrabberData.length > 0) {
        for (let i = 0; i < frameGrabberData.length; i++) {
          for (let j = 0; j < frameGrabberData[i].data_array.length; j+=2) {

            tmpData.push({
              source: frameGrabberData[i].data_array[j].data_value,
              filepath: getImageUrl(frameGrabberData[i].data_array[j+1].data_value)
            })
          }
        }

        return (
          tmpData.map((camera) => {
            return (
              <Col className="px-1 mb-2" key={camera.source} xs={12} sm={6} md={4} lg={3}>
                {this.renderImage(camera.source, camera.filepath)}
              </Col>
            )
          })
        )
      }
    }
  }

  renderEventOptionsCard() {
    let return_event_options = this.state.event.event_options.reduce((filtered, event_option, index) => {
      if(event_option.event_option_name !== 'event_comment') {
        filtered.push(<div className="pl-1" key={`event_option_${index}`}><span className="data-name">{event_option.event_option_name.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}:</span> <span className="float-right" style={{wordWrap:'break-word'}} >{event_option.event_option_value}</span><br/></div>);
      }
      return filtered
    },[])

    return (return_event_options.length > 0)? (
      <Col className="px-1 mb-2" xs={12} sm={6} md={4} lg={3}>
        <Card className="event-data-card">
          <Card.Header>Event Options</Card.Header>
          <Card.Body>
            {return_event_options}
          </Card.Body>
        </Card>
      </Col>
    ) : null
  }

  renderAuxDataCard() {
    if(this.state.event.aux_data) {

      const aux_data = this.state.event.aux_data.filter((data) => !excludeAuxDataSources.includes(data.data_source))

      aux_data.sort((a, b) => {
        return (AUX_DATA_SORT_ORDER.indexOf(a.data_source) < AUX_DATA_SORT_ORDER.indexOf(b.data_source)) ? -1 : 1;
      });

      let return_aux_data = aux_data.map((aux_data) => {
        const aux_data_points = aux_data.data_array.map((data, index) => {
          return(<div key={`${aux_data.data_source}_data_point_${index}`}><span className="data-name">{data.data_name.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}:</span> <span className="float-right" style={{wordWrap:'break-word'}} >{data.data_value} {data.data_uom}</span><br/></div>);
        });

        return (
          <Col className="px-1 pb-2" key={`${aux_data.data_source}_col`} sm={6} md={4} lg={3}>
            <Card className="event-data-card" key={`${aux_data.data_source}`}>
              <Card.Header>{aux_data.data_source.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}</Card.Header>
              <Card.Body>
                {aux_data_points}
              </Card.Body>
            </Card>
          </Col>
        );
      });

      return return_aux_data;
    }

    return null;
  }

  renderEventHistory() {
    if(this.state.events && this.state.events.length > 0){

      let eventArray = [];

      for (let i = 0; i < this.state.events.length; i++) {

        let event = this.state.events[i];
        let comment_exists = false;
        let eventOptionsArray = event.event_options.reduce((filtered, option) => {
          if (option.event_option_name === 'event_comment') {
            if( option.event_option_value.length > 0) {
              comment_exists = true;
            }
          } else {
            filtered.push(`${option.event_option_name.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}: "${option.event_option_value}"`);
          }
          return filtered;
        },[]);

        if (event.event_free_text) {
          eventOptionsArray.push(`free_text: "${event.event_free_text}"`);
        }
        let eventOptions = (eventOptionsArray.length > 0)? '--> ' + eventOptionsArray.join(', '): '';
        let commentIcon = (comment_exists)? <FontAwesomeIcon onClick={() => this.handleEventCommentModal(event)} icon='comment' fixedWidth transform="grow-4"/> : <span onClick={() => this.handleEventCommentModal(event)} className="fa-layers fa-fw"><FontAwesomeIcon icon='comment' fixedWidth transform="grow-4"/><FontAwesomeIcon inverse icon='plus' fixedWidth transform="shrink-4"/></span>;
        let commentTooltip = (comment_exists)? (<OverlayTrigger placement="left" overlay={<Tooltip id={`commentTooltip_${event.id}`}>Edit/View Comment</Tooltip>}>{commentIcon}</OverlayTrigger>) : (<OverlayTrigger placement="left" overlay={<Tooltip id={`commentTooltip_${event.id}`}>Add Comment</Tooltip>}>{commentIcon}</OverlayTrigger>);

        eventArray.push(<ListGroup.Item className="event-list-item py-1" key={event.id} ><span onClick={() => this.handleEventShowDetailsModal(event)}>{event.ts} {`<${event.event_author}>`}: {event.event_value} {eventOptions}</span><span className="float-right">{commentTooltip}</span></ListGroup.Item>);
      }
      return eventArray;
    }

    return (<ListGroup.Item className="event-list-item" key="emptyHistory" >No events found</ListGroup.Item>);
  }

  renderNewestEventCard() {
    if(!this.state.event.id) {
      return null;
    }

    if(!this.state.showNewEventDetails) {
      return null;
    }

    const showNewEventTooltip = (<Tooltip id="showHistoryTooltip">{(this.state.showNewEventDetails) ? "Hide new event details" : "Show new event details"}</Tooltip>);
    const showNewEventIcon = (this.state.showNewEventDetails) ? 'eye' : 'eye-slash'
    const event_comment = (this.state.event.event_options) ? this.state.event.event_options.find((event_option) => (event_option.event_option_name === 'event_comment' && event_option.event_option_value.length > 0)) : null
    const event_comment_card = (event_comment)?(<Card><Card.Body className="data-card-body">Comment: {event_comment.event_option_value}</Card.Body></Card>) : null;

    return (
      <Card className={this.props.className}>
        <ImagePreviewModal />
        <Card.Header>
          {this.state.event.ts} {`<${this.state.event.event_author}>`}: {this.state.event.event_value} {(this.state.event.event_free_text) ? ` --> "${this.state.event.event_free_text}"` : null}
          <OverlayTrigger placement="top" overlay={showNewEventTooltip}>
            <span className="float-right" size="sm" onClick={ this.toggleNewEventDetails }>
              <FontAwesomeIcon icon={showNewEventIcon} fixedWidth/>
            </span>
          </OverlayTrigger>
        </Card.Header>
        <Card.Body className="pt-2 pb-1">
          <Row>
            {this.renderImageryCard()}
            {this.renderAuxDataCard()}
            {this.renderEventOptionsCard()}
          </Row>
          <Row>
            <Col xs={12}>
              {event_comment_card}
            </Col>
          </Row>
        </Card.Body>
      </Card>
    );
  }

  renderEventHistoryHeader() {
    const showHistoryFullscreenTooltip = (<Tooltip id="compressTooltip">{(this.state.showEventHistoryFullscreen) ? "Compress event history" : "Expand event history"}</Tooltip>);
    const showHistoryFullscreenIcon = (this.state.showEventHistoryFullscreen) ? 'compress' : 'expand'
    const showHistoryTooltip = (<Tooltip id="showHistoryTooltip">{(this.state.showEventHistory) ? "Hide event history" : "Show event history"}</Tooltip>);
    const showHistoryIcon = (this.state.showEventHistory) ? 'eye' : 'eye-slash'
    const showNewEventDetails = (!this.state.showNewEventDetails) ? <span className="mr-2" size="sm" onClick={ this.toggleNewEventDetails }>Show Recent Event</span> : '';

    return (
      <Card.Header>
        Event History
        <Form inline className="float-right">
          { showNewEventDetails }
          { (this.state.showEventHistory) ?
            <React.Fragment>
              <FormControl size="sm" type="text" placeholder="Filter" className="mr-sm-2" onKeyPress={this.handleKeyDown} onChange={this.handleSearchChange}/>
              <OverlayTrigger placement="top" overlay={showHistoryFullscreenTooltip}>
                <span className="mr-2" size="sm" onClick={ this.toggleEventHistoryFullscreen }>
                  <FontAwesomeIcon icon={showHistoryFullscreenIcon} fixedWidth/>
                </span>
              </OverlayTrigger>{' '}
            </React.Fragment> : null
          }
          <OverlayTrigger placement="top" overlay={showHistoryTooltip}>
            <span size="sm" onClick={ this.toggleEventHistory }>
              <FontAwesomeIcon icon={showHistoryIcon} fixedWidth/>
            </span>
          </OverlayTrigger>
        </Form>
      </Card.Header>
    );
  }

  renderEventHistoryBody() {
    const ASNAPToggle = (<Form.Check id="ASNAP" type='switch' checked={this.state.hideASNAP} disabled={this.state.eventFilterValue} onChange={() => this.toggleASNAP()} label="Hide ASNAP"/>);

    if(!this.state.showEventHistory) {
      return null
    }

    return (
      <React.Fragment>
        <ListGroup className={`eventList ${(!this.state.showEventHistoryFullscreen) ? 'collapsed' : ''}`} ref={eventHistoryRef}>
          {this.renderEventHistory()}
        </ListGroup>
        <Card.Footer>
          <Button className="mr-1" size={"sm"} variant="outline-primary" onClick={() => this.firstPage()} disabled={(this.state.activePage === 1)}>Newest Events</Button>
          <Button className="mr-1" size={"sm"} variant="outline-primary" onClick={() => this.decrementPage()} disabled={(this.state.activePage === 1)}>Newer Events</Button>
          <Button size={"sm"} variant="outline-primary" onClick={() => this.incrementPage()} disabled={(this.state.events && this.state.events.length !== 20)}>Older Events</Button>
          <Form className="float-right" inline>
            {ASNAPToggle}
          </Form>
        </Card.Footer>
      </React.Fragment>
    )
  }

  renderEventHistoryCard() {
    return (
      <Card className={this.props.className}>
        { this.renderEventHistoryHeader() }
        { this.renderEventHistoryBody() }
      </Card>
    )
  }

  render() {
    return (
      <React.Fragment>
        {this.renderNewestEventCard()}
        {this.renderEventHistoryCard()}
      </React.Fragment>
    );
  }
}

const mapStateToProps = (state) => {
  return {
    authenticated: state.auth.authenticated
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(EventHistory);
