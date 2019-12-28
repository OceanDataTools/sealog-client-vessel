import React, { Component } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import path from 'path';
import moment from 'moment';
import { connect } from 'react-redux';
import { Row, Col, Card, ListGroup, Image, OverlayTrigger, Tooltip } from 'react-bootstrap';
import 'rc-slider/assets/index.css';
import Slider, { createSliderWithTooltip } from 'rc-slider';
import EventFilterForm from './event_filter_form';
import ImagePreviewModal from './image_preview_modal';
import EventCommentModal from './event_comment_modal';
import CruiseDropdown from './cruise_dropdown';
import CruiseModeDropdown from './cruise_mode_dropdown';
import CustomPagination from './custom_pagination';
import ExportDropdown from './export_dropdown';
import * as mapDispatchToProps from '../actions';
import { ROOT_PATH, API_ROOT_URL, IMAGE_PATH } from '../client_config';

const playTimer = 3000;
const ffwdTimer = 1000;

const PLAY = 0;
const PAUSE = 1;
const FFWD = 2;
const FREV = 3;

const maxEventsPerPage = 10;

const excludeAuxDataSources = ['vesselRealtimeFramegrabberData'];

const imageAuxDataSources = ['vesselRealtimeFramegrabberData']

const SliderWithTooltip = createSliderWithTooltip(Slider);

class CruiseReplay extends Component {

  constructor (props) {
    super(props);

    this.divFocus = null;

    this.state = {
      replayTimer: null,
      replayState: PAUSE,
      replayEventIndex: 0,
      activePage: 1,
    };

    this.handleKeyPress = this.handleKeyPress.bind(this);
    this.sliderTooltipFormatter = this.sliderTooltipFormatter.bind(this);
    this.handleSliderChange = this.handleSliderChange.bind(this);
    this.handleEventClick = this.handleEventClick.bind(this);
    this.handlePageSelect = this.handlePageSelect.bind(this);
    this.replayAdvance = this.replayAdvance.bind(this);
    this.handleCruiseReplayPause = this.handleCruiseReplayPause.bind(this);
    this.replayReverse = this.replayReverse.bind(this);
    this.updateEventFilter = this.updateEventFilter.bind(this);
    this.handleCruiseSelect = this.handleCruiseSelect.bind(this);
    this.handleCruiseModeSelect = this.handleCruiseModeSelect.bind(this);

  }

  componentDidMount() {

    if(!this.props.cruise.id || this.props.cruise.id !== this.props.match.params.id || this.props.event.events.length === 0) {
      this.props.initCruiseReplay(this.props.match.params.id, this.props.event.hideASNAP);
    }
    else {
      const eventIndex = this.props.event.events.findIndex((event) => event.id === this.props.event.selected_event.id);
      this.setState(
        {
          replayEventIndex: eventIndex,
          activePage: Math.ceil((eventIndex+1)/maxEventsPerPage)
        }
      );
    }

    this.divFocus.focus();
  }

  componentDidUpdate() {
  }

  componentWillUnmount(){
    if(this.state.replayTimer) {
      clearInterval(this.state.replayTimer);
    }
  }

  updateEventFilter(filter = {}) {
    this.setState({ activePage: 1, replayEventIndex: 0 });
    this.handleCruiseReplayPause();
    this.props.updateEventFilterForm(filter);
    this.props.eventUpdateCruiseReplay(this.props.match.params.id, this.props.event.hideASNAP);
  }

  toggleASNAP() {
    this.props.eventUpdateCruiseReplay(this.props.cruise.id, !this.props.event.hideASNAP);
    this.handleCruiseReplayPause();
    if(this.props.event.hideASNAP) {
      this.props.showASNAP();
      this.handleEventClick(0);
    }
    else {
      this.props.hideASNAP();
      this.handleEventClick(0);
    }
  }

  sliderTooltipFormatter(v) {
    if(this.props.event.events && this.props.event.events[v]) {
      let cruiseStartTime = moment(this.props.cruise.start_ts);
      let cruiseNow = moment(this.props.event.events[v].ts);
      let cruiseElapse = cruiseNow.diff(cruiseStartTime);
      return moment.duration(cruiseElapse).format("d [days] hh:mm:ss");
    }

    return '';
  }

  handleSliderChange(index) {
    if(this.props.event.events && this.props.event.events[index]) {
      this.handleCruiseReplayPause();
      this.setState({replayEventIndex: index});
      this.props.advanceCruiseReplayTo(this.props.event.events[index].id);
      this.setState({activePage: Math.ceil((index+1)/maxEventsPerPage)});
    }
  }

  handleEventClick(index) {
    this.handleCruiseReplayPause();
    this.setState({replayEventIndex: index});
    if(this.props.event.events && this.props.event.events.length > index) {
      this.props.advanceCruiseReplayTo(this.props.event.events[index].id);
      this.setState({activePage: Math.ceil((index+1)/maxEventsPerPage)});
    }
  }

  handleImageClick(source, filepath) {
    this.handleCruiseReplayPause();
    this.props.showModal('imagePreview', { name: source, filepath: filepath });
  }

  handleEventCommentModal(index) {
    this.handleCruiseReplayPause();
    this.setState({replayEventIndex: index});
    this.props.advanceCruiseReplayTo(this.props.event.events[index].id);
    this.props.showModal('eventComment', { event: this.props.event.events[index], handleUpdateEvent: this.props.updateEvent });
  }

  handlePageSelect(eventKey, updateReplay=true) {
    this.handleCruiseReplayPause();
    this.setState({activePage: eventKey, replayEventIndex: (eventKey-1)*maxEventsPerPage });
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
  }

  handleCruiseSelect(id) {
    this.props.gotoCruiseReplay(id);
    this.props.initCruiseReplay(id, this.props.event.hideASNAP);
    this.setState({replayEventIndex: 0, activePage: 1});
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

  renderImage(source, filepath) {
    return (
      <Card id={`image_${source}`}>
        <Card.Body className="data-card-body">
          <Image  fluid onError={this.handleMissingImage} src={filepath} onClick={ () => this.handleImageClick(source, filepath)} />
          <div style={{marginTop: "5px"}}>{source}</div>
        </Card.Body>
      </Card>
    );
  }

  handleMissingImage(ev) {
    ev.target.src = `${ROOT_PATH}images/noimage.jpeg`;
  }

  handleCruiseReplayStart() {
    this.handleCruiseReplayPause();
    this.setState({replayEventIndex: 0});
    this.props.advanceCruiseReplayTo(this.props.event.events[this.state.replayEventIndex].id);
    this.setState({activePage: Math.ceil((this.state.replayEventIndex+1)/maxEventsPerPage)});
  }

  handleCruiseReplayEnd() {
    this.handleCruiseReplayPause();
    this.setState({replayEventIndex: this.props.event.events.length-1});
    this.props.advanceCruiseReplayTo(this.props.event.events[this.state.replayEventIndex].id);
    this.setState({activePage: Math.ceil((this.state.replayEventIndex+1)/maxEventsPerPage)});
  }

  handleCruiseReplayFRev() {
    this.setState({replayState: FREV});    
    if(this.state.replayTimer !== null) {
      clearInterval(this.state.replayTimer);
    }
    this.setState({replayTimer: setInterval(this.replayReverse, ffwdTimer)});
  }

  handleCruiseReplayPlay() {
    this.setState({replayState: PLAY});
    if(this.state.replayTimer !== null) {
      clearInterval(this.state.replayTimer);
    }
    this.setState({replayTimer: setInterval(this.replayAdvance, playTimer)});
  }

  handleCruiseReplayPause() {
    this.setState({replayState: PAUSE});
    if(this.state.replayTimer !== null) {
      clearInterval(this.state.replayTimer);
    }
    this.setState({replayTimer: null});
  }

  handleCruiseReplayFFwd() {
    this.setState({replayState: FFWD});
    if(this.state.replayTimer !== null) {
      clearInterval(this.state.replayTimer);
    }
    this.setState({replayTimer: setInterval(this.replayAdvance, ffwdTimer)});

  }

  replayAdvance() {
    if(this.state.replayEventIndex < (this.props.event.events.length - 1)) {
      this.setState({replayEventIndex: this.state.replayEventIndex + 1});
      this.props.advanceCruiseReplayTo(this.props.event.events[this.state.replayEventIndex].id);
      this.setState({activePage: Math.ceil((this.state.replayEventIndex+1)/maxEventsPerPage)});
    } else {
      this.setState({replayState: PAUSE});
    }
  }

  replayReverse() {
    if(this.state.replayEventIndex > 0) {
      this.setState({replayEventIndex: this.state.replayEventIndex - 1});
      this.props.advanceCruiseReplayTo(this.props.event.events[this.state.replayEventIndex].id);
      this.setState({activePage: Math.ceil((this.state.replayEventIndex+1)/maxEventsPerPage)});
    } else {
      this.setState({replayState: PAUSE});
    }
  }

  renderImageryCard() {
    if(this.props.event && this.props.event.selected_event.aux_data) { 
      let frameGrabberData = this.props.event.selected_event.aux_data.filter(aux_data => imageAuxDataSources.includes(aux_data.data_source));
      let tmpData = [];

      if(frameGrabberData.length > 0) {
        for (let i = 0; i < frameGrabberData[0].data_array.length; i+=2) {
    
          tmpData.push({source: frameGrabberData[0].data_array[i].data_value, filepath: API_ROOT_URL + IMAGE_PATH + '/' + path.basename(frameGrabberData[0].data_array[i+1].data_value)} );
        }

        return (
          <Row>
            {
              tmpData.map((camera) => {
                return (
                  <Col key={camera.source} xs={12} sm={6} md={3} lg={3}>
                    {this.renderImage(camera.source, camera.filepath)}
                  </Col>
                );
              })
            }
          </Row>
        );
      }
    }
  }

  renderEventOptionsCard() {

    if(this.props.event.selected_event && this.props.event.selected_event.event_options && this.props.event.selected_event.event_options.length > 0) {

      let return_event_options = this.props.event.selected_event.event_options.reduce((filtered, event_option, index) => {
        if(event_option.event_option_name !== 'event_comment') {
          filtered.push(<div key={`event_option_${index}`}><span>{event_option.event_option_name}:</span> <span className="float-right" style={{wordWrap:'break-word'}} >{event_option.event_option_value}</span><br/></div>);
        }

        return filtered;
      },[]);

      return (return_event_options.length > 0)? (
        <Col xs={12} sm={6} md={6} lg={3}>
          <Card>
            <Card.Header className="data-card-header">Event Options</Card.Header>
            <Card.Body className="data-card-body">
              <div style={{paddingLeft: "10px"}}>
                {return_event_options}
              </div>
            </Card.Body>
          </Card>
        </Col>
      ) : null;
    }
  }

  renderAuxDataCard() {

    if(this.props.event.selected_event && this.props.event.selected_event.aux_data) {
      let return_aux_data = this.props.event.selected_event.aux_data.reduce((filtered, aux_data, index) => {
        if(!excludeAuxDataSources.includes(aux_data.data_source)) {
          let aux_data_points = aux_data.data_array.map((data, index) => {
            return(<div key={`${aux_data.data_source}_data_point_${index}`}><span>{data.data_name}:</span> <span className="float-right" style={{wordWrap:'break-word'}} >{data.data_value} {data.data_uom}</span><br/></div>);
          });

          if(aux_data_points.length > 0) {
            filtered.push(
              <Col key={`${aux_data.data_source}_col`}sm={4} md={3} lg={3}>
                <Card key={`${aux_data.data_source}`}>
                  <Card.Header className="data-card-header">{aux_data.data_source}</Card.Header>
                  <Card.Body className="data-card-body">
                    <div style={{paddingLeft: "10px"}}>
                      {aux_data_points}
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            );
          }
        }

        return filtered;
      },[]);

      return return_aux_data;
    }

    return null;
  }

  renderControlsCard() {

    if(this.props.cruise) {
      const cruiseStartTime = moment(this.props.cruise.start_ts);
      const cruiseEndTime = moment(this.props.cruise.stop_ts);
      const cruiseDuration = cruiseEndTime.diff(cruiseStartTime);
      
      const playPause = (this.state.replayState !== 1)? <FontAwesomeIcon className="text-primary" key={`pause_${this.props.cruise.id}`} onClick={ () => this.handleCruiseReplayPause() } icon="pause"/> : <FontAwesomeIcon className="text-primary" key={`play_${this.props.cruise.id}`} onClick={ () => this.handleCruiseReplayPlay() } icon="play"/>;

      const buttons = (this.props.event.selected_event.ts && !this.props.event.fetching)? (
        <div className="text-center">
          <FontAwesomeIcon className="text-primary" key={`start_${this.props.cruise.id}`} onClick={ () => this.handleCruiseReplayStart() } icon="step-backward"/>{' '}
          <FontAwesomeIcon className="text-primary" key={`frev_${this.props.cruise.id}`} onClick={ () => this.handleCruiseReplayFRev() } icon="backward"/>{' '}
          {playPause}{' '}
          <FontAwesomeIcon className="text-primary" key={`ffwd_${this.props.cruise.id}`} onClick={ () => this.handleCruiseReplayFFwd() } icon="forward"/>{' '}
          <FontAwesomeIcon className="text-primary" key={`end_${this.props.cruise.id}`} onClick={ () => this.handleCruiseReplayEnd() } icon="step-forward"/>
        </div>
      ):(
        <div className="text-center">
          <FontAwesomeIcon icon="step-backward"/>{' '}
          <FontAwesomeIcon icon="backward"/>{' '}
          <FontAwesomeIcon icon="play"/>{' '}
          <FontAwesomeIcon icon="forward"/>{' '}
          <FontAwesomeIcon icon="step-forward"/>
        </div>
      );

      return (
        <Card style={{marginBottom: "8px"}}>
          <Card.Body>
            <Row>
              <Col xs={4}>
                <span className="text-primary">00:00:00</span>
              </Col>
              <Col xs={4}>
                {buttons}
              </Col>
              <Col xs={4}>
                <div className="float-right">
                  <span className="text-primary">{moment.duration(cruiseDuration).format("d [days] hh:mm:ss")}</span>
                </div>
              </Col>
            </Row>
            <SliderWithTooltip
              value={this.state.replayEventIndex}
              tipFormatter={this.sliderTooltipFormatter}
              trackStyle={{ opacity: 0.5 }}
              railStyle={{ opacity: 0.5 }}
              onBeforeChange={this.handleCruiseReplayPause}
              onChange={this.handleSliderChange}
              max={this.props.event.events.length-1}
            />
          </Card.Body>
        </Card>
      );
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
          
          let commentIcon = (comment_exists)? <FontAwesomeIcon onClick={() => this.handleEventCommentModal(index)} icon='comment' fixedWidth transform="grow-4"/> : <span onClick={() => this.handleEventCommentModal(index)} className="fa-layers fa-fw"><FontAwesomeIcon icon='comment' fixedWidth transform="grow-4"/><FontAwesomeIcon className={(active)? "text-primary" : "" } inverse={!active} icon='plus' fixedWidth transform="shrink-4"/></span>;
          let commentTooltip = (comment_exists)? (<OverlayTrigger placement="left" overlay={<Tooltip id={`commentTooltip_${event.id}`}>Edit/View Comment</Tooltip>}>{commentIcon}</OverlayTrigger>) : (<OverlayTrigger placement="top" overlay={<Tooltip id={`commentTooltip_${event.id}`}>Add Comment</Tooltip>}>{commentIcon}</OverlayTrigger>);
          let eventComment = (this.props.roles.includes("event_logger") || this.props.roles.includes("admin"))? commentTooltip : null;

          return (<ListGroup.Item className="event-list-item" key={event.id} active={active} ><span onClick={() => this.handleEventClick(index)} >{`${event.ts} <${event.event_author}>: ${event.event_value} ${eventOptions}`}</span><span className="float-right">{eventComment}</span></ListGroup.Item>);

        }
      });

      return eventList;
    }

    return (this.props.event.fetching)? (<ListGroup.Item className="event-list-item">Loading...</ListGroup.Item>) : (<ListGroup.Item>No events found</ListGroup.Item>);
  }

  renderEventCard() {
    return (
      <Card>
        <Card.Header>{ this.renderEventListHeader() }</Card.Header>
        <ListGroup>
          {this.renderEvents()}
        </ListGroup>
      </Card>
    );
  }

  render(){

    const cruise_id = (this.props.cruise.cruise_id)? this.props.cruise.cruise_id : "Loading...";
    // console.log("cruise:", this.props.cruise);

    return (
      <div tabIndex="-1" onKeyDown={this.handleKeyPress} ref={(div) => { this.divFocus = div }}>
        <ImagePreviewModal />
        <EventCommentModal />
        <Row>
          <Col lg={12}>
            <span style={{paddingLeft: "8px"}}>
              <span onClick={() => this.props.gotoCruiseMenu()} className="text-warning">Cruises</span>
              {' '}/{' '}
              <span><CruiseDropdown onClick={this.handleCruiseSelect} active_cruise={this.props.cruise} active_cruise={this.props.cruise}/></span>
              {' '}/{' '}
              <span><CruiseModeDropdown onClick={this.handleCruiseModeSelect} active_mode={"Replay"} modes={["Review", "Map", "Gallery"]}/></span>
            </span>
          </Col>
        </Row>
        <Row>
          <Col sm={12}>
            {this.renderImageryCard()}
          </Col>
          {this.renderEventOptionsCard()}
          {this.renderAuxDataCard()}
          <Col sm={12}>
            {this.renderControlsCard()}
            <Row style={{paddingTop: "4px"}}>
              <Col md={12} lg={9}>
                {this.renderEventCard()}
                <CustomPagination style={{marginTop: "8px"}} page={this.state.activePage} count={this.props.event.events.length} pageSelectFunc={this.handlePageSelect} maxPerPage={maxEventsPerPage}/>
              </Col>          
              <Col md={4} lg={3}>
                <EventFilterForm disabled={this.props.event.fetching} hideASNAP={this.props.event.hideASNAP} handlePostSubmit={ this.updateEventFilter } minDate={this.props.cruise.start_ts} maxDate={this.props.cruise.stop_ts} initialValues={this.props.event.eventFilter}/>
              </Col>          
            </Row>
          </Col>
        </Row>
      </div>
    );
  }
}

function mapStateToProps(state) {

  return {
    cruise: state.cruise.cruise,  
    roles: state.user.profile.roles,
    event: state.event
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(CruiseReplay);
