import React, { Component } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import moment from 'moment';
import { connect } from 'react-redux';
import { ButtonToolbar, Container, Row, Col, Card, ListGroup, Image, OverlayTrigger, Tooltip, Form } from 'react-bootstrap';
import Slider, { createSliderWithTooltip } from 'rc-slider';
import EventFilterForm from './event_filter_form';
import ImagePreviewModal from './image_preview_modal';
import EventCommentModal from './event_comment_modal';
import CruiseModeDropdown from './cruise_mode_dropdown';
import CustomPagination from './custom_pagination';
import ExportDropdown from './export_dropdown';
import * as mapDispatchToProps from '../actions';
import { getImageUrl, handleMissingImage } from '../utils';
import { _Cruises_ } from '../vocab';

const playTimer = 3000;
const ffwdTimer = 1000;

const PLAY = 0;
const PAUSE = 1;
const FFWD = 2;
const FREV = 3;

const maxEventsPerPage = 10;

const excludeAuxDataSources = ['vesselRealtimeFramegrabberData'];

const imageAuxDataSources = ['vesselRealtimeFramegrabberData'];

const sortAuxDataSourceReference = ['vesselRealtimeNavData'];

const SliderWithTooltip = createSliderWithTooltip(Slider);

class CruiseReplay extends Component {

  constructor (props) {
    super(props);

    this.divFocus = null;

    this.state = {
      replayTimer: null,
      replayState: PAUSE,
      replayEventIndex: 0,
      activePage: 1
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
      <Card  className="event-image-data-card" id={`image_${source}`}>
        <Image fluid onError={handleMissingImage} src={filepath} onClick={ () => this.handleImageClick(source, filepath)} />
        <span>{source}</span>
      </Card>
    );
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
        for (let i = 0; i < frameGrabberData.length; i++) {
          for (let j = 0; j < frameGrabberData[i].data_array.length; j+=2) {

            tmpData.push({
              source: frameGrabberData[i].data_array[j].data_value,
              filepath: getImageUrl(frameGrabberData[i].data_array[j+1].data_value)
            });
          }
        }

        return (
          tmpData.map((camera) => {
            return (
              <Col className="px-1 mb-2" key={camera.source} xs={12} sm={6} md={4} lg={3}>
                {this.renderImage(camera.source, camera.filepath)}
              </Col>
            );
          })
        )
      }
    }
  }

  renderEventOptionsCard() {

    if(this.props.event.selected_event && this.props.event.selected_event.event_options && this.props.event.selected_event.event_options.length > 0) {

      let return_event_options = this.props.event.selected_event.event_options.reduce((filtered, event_option, index) => {
        if(event_option.event_option_name !== 'event_comment') {
          filtered.push(<div key={`event_option_${index}`}><span className="data-name">{event_option.event_option_name}:</span> <span className="float-right" style={{wordWrap:'break-word'}} >{event_option.event_option_value}</span><br/></div>);
        }

        return filtered;
      },[]);

      return (return_event_options.length > 0)? (
        <Col className="px-1 mb-2" xs={12} sm={6} md={4} lg={3}>
          <Card className="event-data-card">
            <Card.Header>Event Options</Card.Header>
            <Card.Body>
              {return_event_options}
            </Card.Body>
          </Card>
        </Col>
      ) : null;
    }
  }

  renderAuxDataCard() {

    if(this.props.event.selected_event && this.props.event.selected_event.aux_data) {

      const aux_data = this.props.event.selected_event.aux_data.filter((data) => !excludeAuxDataSources.includes(data.data_source))

      aux_data.sort((a, b) => {
        return (sortAuxDataSourceReference.indexOf(a.data_source) < sortAuxDataSourceReference.indexOf(b.data_source)) ? -1 : 1;
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

  renderControlsCard() {

    if(this.props.cruise) {
      const cruiseStartTime = moment(this.props.cruise.start_ts);
      const cruiseEndTime = moment(this.props.cruise.stop_ts);
      const cruiseDuration = cruiseEndTime.diff(cruiseStartTime);

      const playPause = (this.state.replayState !== 1)? <FontAwesomeIcon className="text-primary" key={`pause_${this.props.cruise.id}`} onClick={ () => this.handleCruiseReplayPause() } icon="pause"/> : <FontAwesomeIcon className="text-primary" key={`play_${this.props.cruise.id}`} onClick={ () => this.handleCruiseReplayPlay() } icon="play"/>;

      const buttons = (this.props.event.selected_event.ts && !this.props.event.fetching)? (
        <span className="w-100 text-center">
          <FontAwesomeIcon className="text-primary" key={`start_${this.props.cruise.id}`} onClick={ () => this.handleCruiseReplayStart() } icon="step-backward"/>{' '}
          <FontAwesomeIcon className="text-primary" key={`frev_${this.props.cruise.id}`} onClick={ () => this.handleCruiseReplayFRev() } icon="backward"/>{' '}
          {playPause}{' '}
          <FontAwesomeIcon className="text-primary" key={`ffwd_${this.props.cruise.id}`} onClick={ () => this.handleCruiseReplayFFwd() } icon="forward"/>{' '}
          <FontAwesomeIcon className="text-primary" key={`end_${this.props.cruise.id}`} onClick={ () => this.handleCruiseReplayEnd() } icon="step-forward"/>
        </span>
      ):(
        <span className="text-center">
          <FontAwesomeIcon icon="step-backward"/>{' '}
          <FontAwesomeIcon icon="backward"/>{' '}
          <FontAwesomeIcon icon="play"/>{' '}
          <FontAwesomeIcon icon="forward"/>{' '}
          <FontAwesomeIcon icon="step-forward"/>
        </span>
      );

      return (
        <Card className="border-secondar p-1">
          <div className="d-flex align-items-center justify-content-between">
              <span className="text-primary">00:00:00</span>
              {buttons}
              <span className="text-primary">{moment.duration(cruiseDuration).format("d [days] hh:mm:ss")}</span>
          </div>
          <div className="d-flex align-items-center justify-content-between">
            <SliderWithTooltip
              className="mx-2"
              value={this.state.replayEventIndex}
              tipFormatter={this.sliderTooltipFormatter}
              trackStyle={{ opacity: 0.5 }}
              railStyle={{ opacity: 0.5 }}
              onBeforeChange={this.handleCruiseReplayPause}
              onChange={this.handleSliderChange}
              max={this.props.event.events.length-1}
            />
          </div>
        </Card>
      );
    }
  }

  renderEventListHeader() {

    const Label = "Filtered Events";
    const ASNAPToggle = (<Form.Check id="ASNAP" type='switch' inline checked={!this.props.event.hideASNAP} onChange={() => this.toggleASNAP()} disabled={this.props.event.fetching} label='ASNAP'/>);

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
              filtered.push(`${option.event_option_name.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}: "${option.event_option_value}"`);
            }
            return filtered;
          },[]);

          if (event.event_free_text) {
            eventOptionsArray.push(`free_text: "${event.event_free_text}"`);
          }
          let active = (this.props.event.selected_event.id === event.id)? true : false;

          let eventOptions = (eventOptionsArray.length > 0)? '--> ' + eventOptionsArray.join(', '): '';

          let commentIcon = (comment_exists)? <FontAwesomeIcon onClick={() => this.handleEventCommentModal(index)} icon='comment' fixedWidth transform="grow-4"/> : <span onClick={() => this.handleEventCommentModal(index)} className="fa-layers fa-fw"><FontAwesomeIcon icon='comment' fixedWidth transform="grow-4"/><FontAwesomeIcon className={(active)? "text-primary" : "text-secondary" } icon='plus' fixedWidth transform="shrink-4"/></span>;
          let commentTooltip = (comment_exists)? (<OverlayTrigger placement="left" overlay={<Tooltip id={`commentTooltip_${event.id}`}>Edit/View Comment</Tooltip>}>{commentIcon}</OverlayTrigger>) : (<OverlayTrigger placement="top" overlay={<Tooltip id={`commentTooltip_${event.id}`}>Add Comment</Tooltip>}>{commentIcon}</OverlayTrigger>);
          let eventComment = (this.props.roles.includes("event_logger") || this.props.roles.includes("admin"))? commentTooltip : null;

          return (<ListGroup.Item className="event-list-item py-1" key={event.id} active={active} ><span onClick={() => this.handleEventClick(index)} >{`${event.ts} <${event.event_author}>: ${event.event_value} ${eventOptions}`}</span><span className="float-right">{eventComment}</span></ListGroup.Item>);

        }
      });

      return eventList;
    }

    return (this.props.event.fetching)? (<ListGroup.Item className="event-list-item py-1">Loading...</ListGroup.Item>) : (<ListGroup.Item className="event-list-item py-1">No events found</ListGroup.Item>);
  }

  renderEventCard() {
    return (
      <Card className="border-secondary mt-2">
        <Card.Header>{ this.renderEventListHeader() }</Card.Header>
        <ListGroup className="eventList" tabIndex="-1" onKeyDown={this.handleKeyPress} ref={(div) => { this.divFocus = div }}>
          {this.renderEvents()}
        </ListGroup>
      </Card>
    );
  }

  render(){

    const cruise_id = (this.props.cruise.cruise_id)? this.props.cruise.cruise_id : "Loading...";

    return (
      <Container className="mt-2">
        <ImagePreviewModal />
        <EventCommentModal />
        <Row>
          <ButtonToolbar className="mb-2 ml-1 align-items-center">
            <span onClick={() => this.props.gotoCruiseMenu()} className="text-warning">{_Cruises_}</span>
            <FontAwesomeIcon icon="chevron-right" fixedWidth/>
            <span className="text-warning">{cruise_id}</span>
            <FontAwesomeIcon icon="chevron-right" fixedWidth/>
            <CruiseModeDropdown onClick={this.handleCruiseModeSelect} active_mode={"Replay"} modes={["Review", "Map", "Gallery"]}/>
          </ButtonToolbar>
        </Row>
        <Row>
          {this.renderImageryCard()}
          {this.renderAuxDataCard()}
          {this.renderEventOptionsCard()}
        </Row>
        <Row>
          <Col className="px-1 mb-1" md={9} lg={9}>
            {this.renderControlsCard()}
            {this.renderEventCard()}
            <CustomPagination className="mt-2" page={this.state.activePage} count={this.props.event.events.length} pageSelectFunc={this.handlePageSelect} maxPerPage={maxEventsPerPage}/>
          </Col>
          <Col className="px-1 mb-1" md={3} lg={3}>
            <EventFilterForm disabled={this.props.event.fetching} hideASNAP={this.props.event.hideASNAP} handlePostSubmit={ this.updateEventFilter } minDate={this.props.cruise.start_ts} maxDate={this.props.cruise.stop_ts} initialValues={this.props.event.eventFilter}/>
          </Col>
        </Row>
      </Container>
    );
  }
}

const mapStateToProps = (state) => {

  return {
    cruise: state.cruise.cruise,
    roles: state.user.profile.roles,
    event: state.event
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(CruiseReplay);
