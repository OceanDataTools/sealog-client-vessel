import React, { Component } from 'react';
import { connect } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import moment from 'moment';
import axios from 'axios';
import Cookies from 'universal-cookie';
import { Map, TileLayer, WMSTileLayer, Marker, Polyline, Popup, LayersControl, ScaleControl } from 'react-leaflet';
import L from 'leaflet';
import { Row, Col, Card, Tooltip, OverlayTrigger, ListGroup } from 'react-bootstrap';
import 'rc-slider/assets/index.css';
import Slider, { createSliderWithTooltip } from 'rc-slider';
import EventShowDetailsModal from './event_show_details_modal';
import EventFilterForm from './event_filter_form';
import EventCommentModal from './event_comment_modal';
import CruiseDropdown from './cruise_dropdown';
import CruiseModeDropdown from './cruise_mode_dropdown';
import CustomPagination from './custom_pagination';
import ExportDropdown from './export_dropdown';
import * as mapDispatchToProps from '../actions';
import { API_ROOT_URL } from '../client_config';
import { TILE_LAYERS, DEFAULT_LOCATION } from '../map_tilelayers';

const { BaseLayer } = LayersControl;

const cookies = new Cookies();

const SliderWithTooltip = createSliderWithTooltip(Slider);

const maxEventsPerPage = 10;

const initCenterPosition = DEFAULT_LOCATION;

const positionAuxDataSources = ['vesselRealtimeNavData'];

class CruiseMap extends Component {

  constructor (props) {
    super(props);

    this.divFocus = null;

    this.state = {
      fetching: false,
      tracklines: {},

      replayEventIndex: 0,
      activePage: 1,

      zoom: 13,
      center:initCenterPosition,
      position:initCenterPosition,
      showMarker: false,
      height: "480px"
    };

    this.auxDatasourceFilters = positionAuxDataSources;

    this.sliderTooltipFormatter = this.sliderTooltipFormatter.bind(this);
    this.handleSliderChange = this.handleSliderChange.bind(this);
    this.handleEventClick = this.handleEventClick.bind(this);
    this.handleKeyPress = this.handleKeyPress.bind(this);
    this.handlePageSelect = this.handlePageSelect.bind(this);
    this.updateEventFilter = this.updateEventFilter.bind(this);

    this.calcvesselPosition = this.calcvesselPosition.bind(this);
    this.handleCruiseSelect = this.handleCruiseSelect.bind(this);
    this.handleCruiseModeSelect = this.handleCruiseModeSelect.bind(this);
    this.handleMoveEnd = this.handleMoveEnd.bind(this);
    this.handleZoomEnd = this.handleZoomEnd.bind(this);
    this.initMapView = this.initMapView.bind(this);
    this.toggleASNAP = this.toggleASNAP.bind(this);
  }

  componentDidMount() {

    if(!this.props.cruise.id || this.props.cruise.id !== this.props.match.params.id || this.props.event.events.length === 0) {
      this.props.initCruiseReplay(this.props.match.params.id, this.props.event.hideASNAP);
    } else {
      const eventIndex = this.props.event.events.findIndex((event) => event.id === this.props.event.selected_event.id);
      this.setState(
        {
          replayEventIndex: eventIndex,
          activePage: Math.ceil((eventIndex+1)/maxEventsPerPage)
        }
      );
    }

    this.initCruiseTrackline(this.props.match.params.id);

    this.divFocus.focus();
  }

  componentDidUpdate() {
    this.map.leafletElement.invalidateSize();
  }

  componentWillUnmount(){}

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
          this.setState({replayEventIndex: eventIndex + 1});
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
          this.setState({replayEventIndex: eventIndex - 1});
          this.props.advanceCruiseReplayTo(this.props.event.events[eventIndex - 1].id)
        }
      }
    }
    else if(event.key === "Enter") {
      this.handleEventShowDetailsModal(this.state.replayEventIndex)
    }
  }

  async initCruiseTrackline(id) {
    this.setState({ fetching: true});

    let tracklines = {};

    for (let index=0;index<this.auxDatasourceFilters.length;index++) {

      tracklines[this.auxDatasourceFilters[index]] = {
        eventIDs: [],
        polyline: L.polyline([]),
      };

      let url = `${API_ROOT_URL}/api/v1/event_aux_data/bycruise/${id}?datasource=${this.auxDatasourceFilters[index]}`;
      await axios.get(url, {
        headers: {
          authorization: cookies.get('token')
        }
      }).then((response) => {
        response.data.map((r_data) => {
          tracklines[this.auxDatasourceFilters[index]].polyline.addLatLng([ parseFloat(r_data['data_array'].find(data => data['data_name'] == 'latitude')['data_value']), parseFloat(r_data['data_array'].find(data => data['data_name'] == 'longitude')['data_value'])]);
          tracklines[this.auxDatasourceFilters[index]].eventIDs.push(r_data['event_id']);
        });

      }).catch((error)=>{
        if(error.response && error.response.data.statusCode !== 404) {
          console.log(error);
        }
      });
    }

    this.setState({ tracklines: tracklines, fetching: false });
    this.initMapView();
  }

  initMapView() {
    if(this.state.tracklines.vesselRealtimeNavData && !this.state.tracklines.vesselRealtimeNavData.polyline.isEmpty()) {
      this.map.leafletElement.panTo(this.state.tracklines.vesselRealtimeNavData.polyline.getBounds().getCenter());
      this.map.leafletElement.fitBounds(this.state.tracklines.vesselRealtimeNavData.polyline.getBounds());
    }
  }

  updateEventFilter(filter = {}) {
    this.setState({ activePage: 1, replayEventIndex: 0 });
    this.props.updateEventFilterForm(filter);
    this.props.eventUpdateCruiseReplay(this.props.match.params.id, this.props.event.hideASNAP);
  }

  toggleASNAP() {
    this.props.eventUpdateCruiseReplay(this.props.match.params.id, !this.props.event.hideASNAP);
    if(this.props.event.hideASNAP) {
      this.props.showASNAP();
      this.handleEventClick(0);
    }
    else {
      this.props.hideASNAP();
      this.setState({replayEventIndex: 0});
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
      this.setState({replayEventIndex: index});
      this.props.advanceCruiseReplayTo(this.props.event.events[index].id);
      this.setState({activePage: Math.ceil((index+1)/maxEventsPerPage)});
    }
  }

  handleEventClick(index) {
    this.setState({replayEventIndex: index});
    if(this.props.event.events && this.props.event.events.length > index) {
      this.props.advanceCruiseReplayTo(this.props.event.events[index].id);
      this.setState({activePage: Math.ceil((index+1)/maxEventsPerPage)});
    }
  }

  handleEventCommentModal(index) {
    this.setState({replayEventIndex: index});
    this.props.advanceCruiseReplayTo(this.props.event.events[index].id);
    this.props.showModal('eventComment', { event: this.props.event.events[index], handleUpdateEvent: this.props.updateEvent });
  }

  handlePageSelect(eventKey, updateReplay=true) {
    this.setState({activePage: eventKey, replayEventIndex: (eventKey-1)*maxEventsPerPage });
    if(updateReplay) {
      this.props.advanceCruiseReplayTo(this.props.event.events[(eventKey-1)*maxEventsPerPage].id);
    }
    this.divFocus.focus();
  }

  handleZoomEnd() {
    if(this.map) {
      this.setState({zoom: this.map.leafletElement.getZoom()});
    }
  }

  handleMoveEnd() {
    if(this.map) {
      this.setState({center: this.map.leafletElement.getCenter()});
    }
  }

  calcvesselPosition(selected_event) {
    if(selected_event && selected_event.aux_data) {
      let vesselRealtimeNavData = selected_event.aux_data.find(aux_data => aux_data.data_source == "vesselRealtimeNavData");
      if(vesselRealtimeNavData) {
        let latObj = vesselRealtimeNavData.data_array.find(data => data.data_name == "latitude");
        let lonObj = vesselRealtimeNavData.data_array.find(data => data.data_name == "longitude");

        if(latObj && lonObj && latObj.data_value != this.state.position.lat && lonObj.data_value != this.state.position.lng) {
          this.setState({ showMarker: true, position:{ lat:latObj.data_value, lng: lonObj.data_value}});
        } else if(!latObj || !lonObj) {
          this.setState({showMarker: false});
        }
      }
    }
  }

  handleEventShowDetailsModal(index) {
    this.props.showModal('eventShowDetails', { event: this.props.event.events[index], handleUpdateEvent: this.props.updateEvent });
  }

  handleCruiseSelect(id) {
    this.props.gotoCruiseMap(id);
    this.props.initCruiseReplay(id);
    this.initCruiseTrackline(id);
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

  renderControlsCard() {

    if(this.props.cruise) {
      const cruiseStartTime = moment(this.props.cruise.start_ts);
      const cruiseEndTime = moment(this.props.cruise.stop_ts);
      const cruiseDuration = cruiseEndTime.diff(cruiseStartTime);
      
      return (
        <Card style={{marginBottom: "8px"}}>
          <Card.Body>
            <Row>
              <Col xs={4}>
                <span className="text-primary">00:00:00</span>
              </Col>
              <Col xs={{span:4, offset:4}}>
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

          let eventDetails = <OverlayTrigger placement="left" overlay={<Tooltip id={`commentTooltip_${event.id}`}>View Details</Tooltip>}><FontAwesomeIcon onClick={() => this.handleEventShowDetailsModal(index)} icon='window-maximize' fixedWidth/></OverlayTrigger>;

          return (<ListGroup.Item className="event-list-item" key={event.id} active={active} ><span onClick={() => this.handleEventClick(index)} >{`${event.ts} <${event.event_author}>: ${event.event_value} ${eventOptions}`}</span><span className="float-right">{eventDetails} {eventComment}</span></ListGroup.Item>);

        }
      });

      return eventList;
    }

    return (this.props.event.fetching)? (<ListGroup.Item className="event-list-item">Loading...</ListGroup.Item>) : (<ListGroup.Item>No events found</ListGroup.Item>);
  }

  renderMarker() {

    if(this.props.event.selected_event.aux_data && typeof this.props.event.selected_event.aux_data.find((data) => data['data_source'] === 'vesselRealtimeNavData') !== 'undefined') {

      const realtimeNavData = this.props.event.selected_event.aux_data.find((data) => data['data_source'] === 'vesselRealtimeNavData');
      return (
        <Marker position={[ parseFloat(realtimeNavData['data_array'].find(data => data['data_name'] == 'latitude')['data_value']), parseFloat(realtimeNavData['data_array'].find(data => data['data_name'] == 'longitude')['data_value'])]}>
          <Popup>
            You are here! :-)
          </Popup>
        </Marker>
      );
    }
  }

  render() {

    const baseLayers = TILE_LAYERS.map((layer, index) => {
      if(layer.wms) {
        return (
          <BaseLayer checked={layer.default} key={`baseLayer_${index}`} name={layer.name}>
            <WMSTileLayer
              attribution={layer.attribution}
              url={layer.url}
              layers={layer.layers}
              transparent={layer.transparent}
            />
          </BaseLayer>
        );
      }
      else {
        return (
          <BaseLayer checked={layer.default} key={`baseLayer_${index}`} name={layer.name}>
            <TileLayer
              attribution={layer.attribution}
              url={layer.url}
            />
          </BaseLayer>
        );
      }
    });

    const realtimeTrack = (this.state.tracklines.vesselRealtimeNavData && !this.state.tracklines.vesselRealtimeNavData.polyline.isEmpty()) ? 
      <Polyline color="lime" positions={this.state.tracklines.vesselRealtimeNavData.polyline.getLatLngs()} />
      : null;

    const cruise_id = (this.props.cruise.cruise_id)? this.props.cruise.cruise_id : "Loading...";
    
    return (
      <div tabIndex="-1" onKeyDown={this.handleKeyPress} ref={(div) => { this.divFocus = div }}>
        <EventCommentModal />
        <EventShowDetailsModal />
        <Row>
          <Col lg={12}>
            <span style={{paddingLeft: "8px"}}>
              <span onClick={() => this.props.gotoCruiseMenu()} className="text-warning">Cruises</span>
              {' '}/{' '}
              <span><CruiseDropdown onClick={this.handleCruiseSelect} active_cruise={this.props.cruise} active_cruise={this.props.cruise}/></span>
              {' '}/{' '}
              <span><CruiseModeDropdown onClick={this.handleCruiseModeSelect} active_mode={"Map"} modes={["Replay", "Review", "Gallery"]}/></span>
            </span>
          </Col>
          <Col sm={12}>
            <Card>
              <Card.Body className="data-card-body">
                <Map
                  style={{ height: this.state.height }}
                  center={this.state.center}
                  zoom={this.state.zoom}
                  onMoveEnd={this.handleMoveEnd}
                  onZoomEnd={this.handleZoomEnd}
                  ref={ (map) => this.map = map}
                >
                  <ScaleControl position="bottomleft" />
                  <LayersControl position="topright">
                    {baseLayers}
                  </LayersControl>
                  {realtimeTrack}
                  {this.renderMarker()}
                </Map>
              </Card.Body>
            </Card>
          </Col>
          <Col sm={12}>
            {this.renderControlsCard()}
            <Row style={{paddingTop: "4px"}}>
              <Col md={12} lg={9}>
                {this.renderEventCard()}
                <CustomPagination style={{marginTop: "8px"}} page={this.state.activePage} count={this.props.event.events.length} pageSelectFunc={this.handlePageSelect} maxPerPage={maxEventsPerPage}/>
              </Col>          
              <Col md={5} lg={3}>
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

export default connect(mapStateToProps, mapDispatchToProps)(CruiseMap);
