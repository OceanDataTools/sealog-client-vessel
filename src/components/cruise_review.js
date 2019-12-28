import React, { Component } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { connect } from 'react-redux';
import { Row, Col, Card, ListGroup, Tooltip, OverlayTrigger } from 'react-bootstrap';
import EventFilterForm from './event_filter_form';
import EventCommentModal from './event_comment_modal';
import EventShowDetailsModal from './event_show_details_modal';
import CruiseDropdown from './cruise_dropdown';
import CruiseModeDropdown from './cruise_mode_dropdown';
import CustomPagination from './custom_pagination';
import ExportDropdown from './export_dropdown';
import * as mapDispatchToProps from '../actions';

const maxEventsPerPage = 15;

class CruiseReview extends Component {

  constructor (props) {
    super(props);

    this.divFocus = null;

    this.state = {
      activePage: 1
    };

    this.handleKeyPress = this.handleKeyPress.bind(this);
    this.handleEventUpdate = this.handleEventUpdate.bind(this);
    this.handlePageSelect = this.handlePageSelect.bind(this);
    this.updateEventFilter = this.updateEventFilter.bind(this);
    this.handleCruiseSelect = this.handleCruiseSelect.bind(this);
    this.handleCruiseModeSelect = this.handleCruiseModeSelect.bind(this);

  }

  componentDidMount(){
    if(!this.props.cruise.id || this.props.cruise.id !== this.props.match.params.id || this.props.event.events.length === 0) {
      this.props.initCruiseReplay(this.props.match.params.id, this.props.event.hideASNAP);
    }
    else {
      const eventIndex = this.props.event.events.findIndex((event) => event.id === this.props.event.selected_event.id);
      this.handlePageSelect(Math.ceil((eventIndex + 1)/maxEventsPerPage), false);
    }

    
    this.divFocus.focus();
  }

  componentDidUpdate() {
  }

  componentWillUnmount(){
  }

  updateEventFilter(filter = {}) {
    this.setState({ activePage: 1 });
    this.props.updateEventFilterForm(filter);
    this.props.eventUpdateCruiseReplay(this.props.match.params.id, this.props.event.hideASNAP);
  }

  handlePageSelect(eventKey, updateReplay=true) {
    this.setState({activePage: eventKey});
    if(updateReplay) {
      this.props.advanceCruiseReplayTo(this.props.event.events[(eventKey-1)*maxEventsPerPage].id);
    }
    this.divFocus.focus();
  }

  handleKeyPress(event) {
    if(event.key === "ArrowRight" && this.state.activePage < Math.ceil(this.props.event.events.length / maxEventsPerPage)) {
      this.handlePageSelect(this.state.activePage + 1)
    }
    else if(event.key === "ArrowLeft" && this.state.activePage > 1) {
      this.handlePageSelect(this.state.activePage - 1)
    }
    else if(event.key === "ArrowDown") {
      const eventIndex = this.props.event.events.findIndex((event) => event.id === this.props.event.selected_event.id);
      if(eventIndex < (this.props.event.events.length - 1)) {
        if(Math.ceil((eventIndex + 2) / maxEventsPerPage) !== this.state.activePage) {
          this.handlePageSelect(Math.ceil((eventIndex + 2) / maxEventsPerPage))
        }
        else {
          this.props.advanceCruiseReplayTo(this.props.event.events[eventIndex + 1].id)  
        } 
      }
    }
    else if(event.key === "ArrowUp") {
      const eventIndex = this.props.event.events.findIndex((event) => event.id === this.props.event.selected_event.id);
      if(eventIndex > 0) {
        if(Math.ceil((eventIndex) / maxEventsPerPage) !== this.state.activePage) {
          this.handlePageSelect(Math.ceil((eventIndex) / maxEventsPerPage), false)
          this.props.advanceCruiseReplayTo(this.props.event.events[eventIndex - 1].id)
        }
        else {
          this.props.advanceCruiseReplayTo(this.props.event.events[eventIndex - 1].id)
        }
      }
    }
    else if(event.key === "Enter") {
      this.handleEventShowDetailsModal(this.props.event.selected_event)
    }
  }


  handleEventCommentModal(event) {
    this.props.showModal('eventComment', { event: event, handleUpdateEvent: this.handleEventUpdate });
  }

  handleEventClick(event) {
    if(event) {
      this.props.advanceCruiseReplayTo(event.id);
    }
  }

  async handleEventUpdate(event_id, event_value, event_free_text, event_options, event_ts) {
    const response = await this.props.updateEvent(event_id, event_value, event_free_text, event_options, event_ts);
    if(response.response.status === 204) {
      this.props.updateCruiseReplayEvent(event_id);
    }
  }

  handleEventShowDetailsModal(event) {
    this.props.showModal('eventShowDetails', { event: event, handleUpdateEvent: this.props.updateEvent });
  }

  handleCruiseSelect(id) {
    this.props.initCruiseReplay(id, this.props.event.hideASNAP);
    this.setState({activePage: 1});
  }

  handleCruiseModeSelect(mode) {
    if(mode === "Review") {
      this.props.gotoCruiseReview(this.props.match.params.id);
    } else if (mode === "Gallery") {
      this.props.gotoCruiseGallery(this.props.match.params.id);
    } else if (mode === "Map") {
      this.props.gotoCruiseMap(this.props.match.params.id);
    } else if (mode === "Replay") {
      this.props.gotoCruiseReplay(this.props.match.params.id);
    }
  }

  toggleASNAP() {
    this.props.eventUpdateCruiseReplay(this.props.match.params.id, !this.props.event.hideASNAP);

    if(this.props.event.hideASNAP) {
      this.props.showASNAP();
      this.handleEventClick(this.props.event.events[0]);
    }
    else {
      this.props.hideASNAP();
      this.handleEventClick(this.props.event.events[0]);
    }
  }

  renderEventListHeader() {

    const Label = "Filtered Events";
    const ASNAPToggleIcon = (this.props.event.hideASNAP)? "Show ASNAP" : "Hide ASNAP";
    const ASNAPToggle = (<span disabled={this.props.event.fetching} style={{ marginRight: "10px" }} onClick={() => this.toggleASNAP()}>{ASNAPToggleIcon}</span>);

    return (
      <div>
        { Label }
        <span className="float-right">
          {ASNAPToggle}
          <ExportDropdown id="dropdown-download" disabled={this.props.event.fetching} hideASNAP={this.props.event.hideASNAP} eventFilter={this.props.event.eventFilter} cruiseID={this.props.cruise.id} prefix={this.props.cruise.cruise_id}/>
        </span>
      </div>
    );
  }

  renderEventCard() {

    if (!this.props.event.events) {
      return (
        <Card>
          <Card.Header>{ this.renderEventListHeader() }</Card.Header>
          <Card.Body>Loading...</Card.Body>
        </Card>
      );
    }

    return (
      <Card>
        <Card.Header>{ this.renderEventListHeader() }</Card.Header>
        <ListGroup>
          {this.renderEvents()}
        </ListGroup>
      </Card>
    );
  }

  renderEvents() {

    if(this.props.event.events && this.props.event.events.length > 0){

      let eventList = this.props.event.events.map((event, index) => {
        if(index >= (this.state.activePage-1) * maxEventsPerPage && index < (this.state.activePage * maxEventsPerPage)) {

          let comment_exists = false;

          let eventOptionsArray = event.event_options.reduce((filtered, option) => {
            if(option.event_option_name === 'event_comment') {
              comment_exists = (option.event_option_value !== '')? true : false;
            } else {
              filtered.push(`${option.event_option_name}: "${option.event_option_value}"`);
            }
            return filtered;
          },[]);
          
          if (event.event_free_text) {
            eventOptionsArray.push(`free_text: "${event.event_free_text}"`);
          } 

          let active = (this.props.event.selected_event.id === event.id)? true : false;

          let eventOptions = (eventOptionsArray.length > 0)? '--> ' + eventOptionsArray.join(', '): '';
          
          let commentIcon = (comment_exists)? <FontAwesomeIcon onClick={() => this.handleEventCommentModal(event)} icon='comment' fixedWidth transform="grow-4"/> : <span onClick={() => this.handleEventCommentModal(event)} className="fa-layers fa-fw"><FontAwesomeIcon icon='comment' fixedWidth transform="grow-4"/><FontAwesomeIcon className={(active)? "text-primary" : "" } inverse={!active} icon='plus' fixedWidth transform="shrink-4"/></span>;
          let commentTooltip = (comment_exists)? (<OverlayTrigger placement="top" overlay={<Tooltip id={`commentTooltip_${event.id}`}>Edit/View Comment</Tooltip>}>{commentIcon}</OverlayTrigger>) : (<OverlayTrigger placement="top" overlay={<Tooltip id={`commentTooltip_${event.id}`}>Add Comment</Tooltip>}>{commentIcon}</OverlayTrigger>);
          let eventComment = (this.props.roles.includes("event_logger") || this.props.roles.includes("admin"))? commentTooltip : null;

          let eventDetails = <OverlayTrigger placement="left" overlay={<Tooltip id={`commentTooltip_${event.id}`}>View Details</Tooltip>}><FontAwesomeIcon onClick={() => this.handleEventShowDetailsModal(event)} icon='window-maximize' fixedWidth/></OverlayTrigger>;

          return (<ListGroup.Item className="event-list-item" key={event.id} active={active} ><span onClick={() => this.handleEventClick(event)} >{`${event.ts} <${event.event_author}>: ${event.event_value} ${eventOptions}`}</span><span className="float-right">{eventDetails} {eventComment}</span></ListGroup.Item>);

        }
      });

      return eventList;
    }

    return (<ListGroup.Item>No events found</ListGroup.Item>);
  }

  render(){

    const cruise_id = (this.props.cruise.cruise_id)? this.props.cruise.cruise_id : "Loading...";

    return (
      <div tabIndex="-1" onKeyDown={this.handleKeyPress} ref={(div) => { this.divFocus = div }}>
        <EventCommentModal />
        <EventShowDetailsModal />
        <Row>
          <Col lg={12}>
            <span style={{paddingLeft: "8px"}}>
              <span onClick={() => this.props.gotoCruiseMenu()} className="text-warning">{cruise_id}</span>
              {' '}/{' '}
              <span><CruiseDropdown onClick={this.handleCruiseSelect} active_cruise={this.props.cruise} active_cruise={this.props.cruise}/></span>
              {' '}/{' '}
              <span><CruiseModeDropdown onClick={this.handleCruiseModeSelect} active_mode={"Review"} modes={["Replay", "Map", "Gallery"]}/></span>
            </span>
          </Col>
        </Row>
        <Row style={{paddingTop: "8px"}}>
          <Col sm={12} md={12} lg={9}>
            {this.renderEventCard()}
            <CustomPagination style={{marginTop: "8px"}} page={this.state.activePage} count={this.props.event.events.length} pageSelectFunc={this.handlePageSelect} maxPerPage={maxEventsPerPage}/>
          </Col>
          <Col sm={6} md={5} lg={3}>
            <EventFilterForm disabled={this.props.event.fetching} hideASNAP={this.props.event.hideASNAP} handlePostSubmit={ this.updateEventFilter } minDate={this.props.cruise.start_ts} maxDate={this.props.cruise.stop_ts} initialValues={this.props.event.eventFilter}/>
          </Col>
        </Row>
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    roles: state.user.profile.roles,
    event: state.event,
    cruise: state.cruise.cruise
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(CruiseReview);
