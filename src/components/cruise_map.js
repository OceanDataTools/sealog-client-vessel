import React, { Component } from 'react'
import { connect } from 'react-redux'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import moment from 'moment'
import { Map, TileLayer, WMSTileLayer, Marker, Polyline, Popup, LayersControl, ScaleControl, CircleMarker } from 'react-leaflet'
import L from 'leaflet'
import { ButtonToolbar, Container, Row, Col, Card, Tooltip, OverlayTrigger, ListGroup, Form } from 'react-bootstrap'
import Slider from 'rc-slider'
import EventShowDetailsModal from './event_show_details_modal'
import EventFilterForm from './event_filter_form'
import EventCommentModal from './event_comment_modal'
import CruiseModeDropdown from './cruise_mode_dropdown'
import CustomPagination from './custom_pagination'
import ExportDropdown from './export_dropdown'
import PropTypes from 'prop-types'
import { get_event_aux_data_by_cruise } from '../api'
import { POSITION_DATASOURCES } from '../client_settings'
import { TILE_LAYERS, DEFAULT_LOCATION } from '../map_tilelayers'
import { _Cruises_ } from '../vocab'
import * as mapDispatchToProps from '../actions'

const SliderWithTooltip = Slider.createSliderWithTooltip(Slider)

const maxEventsPerPage = 10

const { BaseLayer } = LayersControl

class CruiseMap extends Component {
  constructor(props) {
    super(props)

    this.state = {
      fetching: false,
      tracklines: {},

      posDataSource: null,

      replayEventIndex: 0,
      activePage: 1,
      sliderTimer: null,

      zoom: 13,
      center: DEFAULT_LOCATION,
      position: DEFAULT_LOCATION,
      showMarker: false,
      height: '480px'
    }

    this.sliderRef = React.createRef() // Reference to the slider

    this.handleCruiseModeSelect = this.handleCruiseModeSelect.bind(this)
    this.handleEventClick = this.handleEventClick.bind(this)
    this.handleKeyDown = this.handleKeyDown.bind(this)
    this.handleMoveEnd = this.handleMoveEnd.bind(this)
    this.handlePageSelect = this.handlePageSelect.bind(this)
    this.handleSliderChange = this.handleSliderChange.bind(this)
    this.handleSliderChangeComplete = this.handleSliderChangeComplete.bind(this)
    this.handleZoomEnd = this.handleZoomEnd.bind(this)
    this.initMapView = this.initMapView.bind(this)
    this.sliderTooltipFormatter = this.sliderTooltipFormatter.bind(this)
    this.toggleASNAP = this.toggleASNAP.bind(this)
    this.updateEventFilter = this.updateEventFilter.bind(this)
  }

  componentDidMount() {
    if (!this.props.cruise.id || this.props.cruise.id !== this.props.match.params.id || this.props.event.events.length === 0) {
      this.props.initCruiseReplay(this.props.match.params.id)
    } else {
      const eventIndex = this.props.event.events.findIndex((event) => event.id === this.props.event.selected_event.id)
      this.setState({
        replayEventIndex: eventIndex,
        activePage: Math.ceil((eventIndex + 1) / maxEventsPerPage)
      })
    }

    document.addEventListener('keydown', this.handleKeyDown)

    this.initCruiseTrackline(this.props.match.params.id)
  }

  componentDidUpdate() {
    this.map.leafletElement.invalidateSize()
  }

  componentWillUnmount() {
    if (this.state.replayTimer) {
      clearInterval(this.state.replayTimer)
    }

    document.removeEventListener('keydown', this.handleKeyDown)
  }

  updateEventFilter(filter = {}) {
    this.setState({ activePage: 1, replayEventIndex: 0 })
    this.props.advanceCruiseReplayTo(this.props.event.events[0].id)
    this.props.updateEventFilterForm(filter)
    this.props.eventUpdateCruiseReplay()
  }

  toggleASNAP() {
    this.props.toggleASNAP()
    this.setState({ replayEventIndex: 0 })
    this.props.advanceCruiseReplayTo(this.props.event.events[0].id)
    this.props.eventUpdateCruiseReplay()
    this.handleEventClick(0)
  }

  sliderTooltipFormatter(v) {
    if (this.props.event.events && this.props.event.events[v]) {
      let cruiseStartTime = moment(this.props.cruise.start_ts)
      let cruiseNow = moment(this.props.event.events[v].ts)
      let cruiseElapse = cruiseNow.diff(cruiseStartTime)
      return moment.duration(cruiseElapse).format('d [days] hh:mm:ss')
    }

    return ''
  }

  handleSliderChange(index) {
    if (this.props.event.events && this.props.event.events[index]) {
      this.setState({ replayEventIndex: index })
      clearTimeout(this.state.sliderTimer)
      this.setState({
        sliderTimer: setTimeout(() => {
          this.props.advanceCruiseReplayTo(this.props.event.events[index].id)
          this.setState({
            activePage: Math.ceil((index + 1) / maxEventsPerPage)
          })
        }, 250)
      })
    }
  }

  handleEventClick(index) {
    this.setState({ replayEventIndex: index })
    this.props.advanceCruiseReplayTo(this.props.event.events[index].id)
    if (this.props.event.events && this.props.event.events.length > index) {
      this.setState({ activePage: Math.ceil((index + 1) / maxEventsPerPage) })
    }
  }

  handleEventCommentModal(index) {
    this.setState({ replayEventIndex: index })
    this.props.advanceCruiseReplayTo(this.props.event.events[index].id)
    this.props.showModal('eventComment', {
      event: this.props.event.events[index],
      handleUpdateEvent: this.props.updateEvent
    })
  }

  handlePageSelect(page) {
    this.setState({
      activePage: page,
      replayEventIndex: (page - 1) * maxEventsPerPage
    })
    this.props.advanceCruiseReplayTo(this.props.event.events[(page - 1) * maxEventsPerPage].id)
  }

  handleKeyDown(event) {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      return
    }

    if (event.key === 'ArrowRight' && this.state.activePage < Math.ceil(this.props.event.events.length / maxEventsPerPage)) {
      this.setState((prevState) => ({
        replayEventIndex: prevState.activePage * maxEventsPerPage,
        activePage: prevState.activePage + 1
      }))
    } else if (event.key === 'ArrowLeft' && this.state.activePage > 1) {
      this.setState((prevState) => ({
        replayEventIndex: (prevState.activePage - 2) * maxEventsPerPage,
        activePage: prevState.activePage - 1
      }))
    } else if (event.key === 'ArrowDown' && this.state.replayEventIndex < this.props.event.events.length - 1) {
      this.setState((prevState) => ({
        replayEventIndex: prevState.replayEventIndex + 1,
        activePage: Math.ceil((prevState.replayEventIndex + 2) / maxEventsPerPage)
      }))
    } else if (event.key === 'ArrowUp' && this.state.replayEventIndex > 0) {
      this.setState((prevState) => ({
        replayEventIndex: prevState.replayEventIndex - 1,
        activePage: Math.ceil(prevState.replayEventIndex / maxEventsPerPage)
      }))
    }

    this.props.advanceCruiseReplayTo(this.props.event.events[this.state.replayEventIndex].id)
  }

  handleCruiseModeSelect(mode) {
    if (mode === 'Replay') {
      this.props.gotoCruiseReplay(this.props.match.params.id)
    }
  }

  handleSliderChangeComplete() {
    const sliderHandle = this.sliderRef.current?.querySelector('.rc-slider-handle')
    if (sliderHandle) {
      sliderHandle.blur()
    }
  }

  async initCruiseTrackline(id) {
    this.setState({ fetching: true })

    let tracklines = {}

    for (const datasource of POSITION_DATASOURCES) {
      let trackline = {
        eventIDs: [],
        polyline: L.polyline([]),
        startPoint: null,
        endPoint: null
      }

      const aux_data = await get_event_aux_data_by_cruise({ datasource }, id)

      if (!aux_data.length) {
        console.debug(`No data found for ${datasource}`)
        continue
      }

      aux_data.forEach((r_data) => {
        try {
          const latLng = [
            parseFloat(r_data['data_array'].find((data) => data['data_name'] == 'latitude')['data_value']),
            parseFloat(r_data['data_array'].find((data) => data['data_name'] == 'longitude')['data_value'])
          ]

          if (latLng[0] != 0 && latLng[1] != 0) {
            trackline.polyline.addLatLng(latLng)
            trackline.eventIDs.push(r_data['event_id'])
            if (trackline.startPoint === null) {
              trackline.startPoint = latLng
            }
            trackline.endPoint = latLng
          }
        } catch {
          console.error('Problem parsing', r_data['data_array'])
        }
      })

      if (trackline.eventIDs) {
        tracklines[datasource] = trackline
        this.setState({ tracklines, posDataSource: datasource })
        break
      }
    }

    this.setState({ fetching: false })
    this.initMapView()
  }

  initMapView() {
    if (this.state.tracklines[this.state.posDataSource] && !this.state.tracklines[this.state.posDataSource].polyline.isEmpty()) {
      this.map.leafletElement.panTo(this.state.tracklines[this.state.posDataSource].polyline.getBounds().getCenter())
      this.map.leafletElement.fitBounds(this.state.tracklines[this.state.posDataSource].polyline.getBounds())
    }
  }

  handleZoomEnd() {
    if (this.map) {
      this.setState({ zoom: this.map.leafletElement.getZoom() })
    }
  }

  handleMoveEnd() {
    if (this.map) {
      this.setState({ center: this.map.leafletElement.getCenter() })
    }
  }

  handleEventShowDetailsModal(index) {
    this.props.showModal('eventShowDetails', {
      event: this.props.event.events[index],
      handleUpdateEvent: this.props.updateEvent
    })
  }

  renderControlsCard() {
    if (this.props.cruise) {
      const cruiseStartTime = moment(this.props.cruise.start_ts)
      const cruiseEndTime = moment(this.props.cruise.stop_ts)
      const cruiseDuration = cruiseEndTime.diff(cruiseStartTime)

      return (
        <Card className='border-secondary p-1'>
          <div className='d-flex align-items-center justify-content-between'>
            <span className='text-primary'>00:00:00</span>
            <span className='text-primary'>{moment.duration(cruiseDuration).format('d [days] hh:mm:ss')}</span>
          </div>
          <div className='d-flex align-items-center justify-content-between' ref={this.sliderRef}>
            <SliderWithTooltip
              className='mx-2'
              value={this.state.replayEventIndex}
              tipFormatter={this.sliderTooltipFormatter}
              trackStyle={{ opacity: 0.5 }}
              railStyle={{ opacity: 0.5 }}
              onChange={this.handleSliderChange}
              onAfterChange={this.handleSliderChangeComplete}
              max={this.props.event.events.length - 1}
            />
          </div>
        </Card>
      )
    }
  }

  renderEventListHeader() {
    const Label = 'Filtered Events'
    const ASNAPToggle = (
      <Form.Check
        id='ASNAP'
        type='switch'
        inline
        checked={this.props.event.hideASNAP}
        onChange={() => this.toggleASNAP()}
        disabled={this.props.event.fetching}
        label='Hide ASNAP'
      />
    )

    return (
      <div>
        {Label}
        <span className='float-right'>
          {ASNAPToggle}
          <ExportDropdown
            id='dropdown-download'
            disabled={this.props.event.fetching}
            hideASNAP={this.props.event.hideASNAP}
            eventFilter={this.props.event.eventFilter}
            cruiseID={this.props.cruise.id}
            prefix={this.props.cruise.cruise_id}
          />
        </span>
      </div>
    )
  }

  renderEventCard() {
    return (
      <Card className='border-secondary'>
        <Card.Header>{this.renderEventListHeader()}</Card.Header>
        <ListGroup variant='flush' tabIndex='-1'>
          {this.renderEvents()}
        </ListGroup>
      </Card>
    )
  }

  renderEvents() {
    if (!this.props.event.selected_event) {
      return null
    }
    if (this.props.event.events && this.props.event.events.length > 0) {
      let eventList = this.props.event.events.map((event, index) => {
        if (index >= (this.state.activePage - 1) * maxEventsPerPage && index < this.state.activePage * maxEventsPerPage) {
          let comment_exists = false
          let eventOptionsArray = event.event_options.reduce((filtered, option) => {
            if (option.event_option_name === 'event_comment') {
              comment_exists = option.event_option_value !== '' ? true : false
            } else {
              filtered.push(`${option.event_option_name.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}: "${option.event_option_value}"`)
            }
            return filtered
          }, [])

          if (event.event_free_text) {
            eventOptionsArray.push(`free_text: "${event.event_free_text}"`)
          }
          let active = this.props.event.selected_event.id === event.id ? true : false
          let eventOptions = eventOptionsArray.length > 0 ? '--> ' + eventOptionsArray.join(', ') : ''
          let commentIcon = comment_exists ? (
            <FontAwesomeIcon onClick={() => this.handleEventCommentModal(index)} icon='comment' fixedWidth transform='grow-4' />
          ) : (
            <span onClick={() => this.handleEventCommentModal(index)} className='fa-layers fa-fw'>
              <FontAwesomeIcon icon='comment' fixedWidth transform='grow-4' />
              <FontAwesomeIcon className={active ? 'text-primary' : 'text-secondary'} icon='plus' fixedWidth transform='shrink-4' />
            </span>
          )
          let commentTooltip = comment_exists ? (
            <OverlayTrigger placement='left' overlay={<Tooltip id={`commentTooltip_${event.id}`}>Edit/View Comment</Tooltip>}>
              {commentIcon}
            </OverlayTrigger>
          ) : (
            <OverlayTrigger placement='top' overlay={<Tooltip id={`commentTooltip_${event.id}`}>Add Comment</Tooltip>}>
              {commentIcon}
            </OverlayTrigger>
          )

          let eventComment = this.props.roles.includes('event_logger') || this.props.roles.includes('admin') ? commentTooltip : null
          let eventDetails = (
            <OverlayTrigger placement='left' overlay={<Tooltip id={`commentTooltip_${event.id}`}>View Details</Tooltip>}>
              <FontAwesomeIcon onClick={() => this.handleEventShowDetailsModal(index)} icon='window-maximize' fixedWidth />
            </OverlayTrigger>
          )

          return (
            <ListGroup.Item className='event-list-item' key={event.id} active={active}>
              <span
                onClick={() => this.handleEventClick(index)}
              >{`${event.ts} <${event.event_author}>: ${event.event_value} ${eventOptions}`}</span>
              <span className='float-right'>
                {eventDetails} {eventComment}
              </span>
            </ListGroup.Item>
          )
        }
      })

      return eventList
    }

    return this.props.event.fetching ? (
      <ListGroup.Item className='event-list-item'>Loading...</ListGroup.Item>
    ) : (
      <ListGroup.Item>No events found</ListGroup.Item>
    )
  }

  renderMarker() {
    if (!this.props.event.selected_event) {
      return null
    }

    if (
      this.props.event.selected_event.aux_data &&
      typeof this.props.event.selected_event.aux_data.find((data) => data['data_source'] === this.state.posDataSource) !== 'undefined'
    ) {
      const posData = this.props.event.selected_event.aux_data.find((data) => data['data_source'] === this.state.posDataSource)
      try {
        const latLng = [
          parseFloat(posData['data_array'].find((data) => data['data_name'] == 'latitude')['data_value']),
          parseFloat(posData['data_array'].find((data) => data['data_name'] == 'longitude')['data_value'])
        ]
        return (
          <Marker position={latLng}>
            <Popup>You are here! :-)</Popup>
          </Marker>
        )
      } catch (err) {
        return null
      }
    }
  }

  render() {
    const baseLayers = TILE_LAYERS.map((layer, index) => {
      if (layer.wms) {
        return (
          <BaseLayer checked={layer.default} key={`baseLayer_${index}`} name={layer.name}>
            <WMSTileLayer attribution={layer.attribution} url={layer.url} layers={layer.layers} transparent={layer.transparent} />
          </BaseLayer>
        )
      } else {
        return (
          <BaseLayer checked={layer.default} key={`baseLayer_${index}`} name={layer.name}>
            <TileLayer
              attribution={layer.attribution}
              url={layer.url}
              tms={layer.tms ?? false}
              zoomOffset={layer.zoomOffset ?? 0}
              maxNativeZoom={layer.maxNativeZoom}
            />
          </BaseLayer>
        )
      }
    })

    let trackLine = null

    for (const datasource of POSITION_DATASOURCES) {
      if (this.state.tracklines[datasource] && !this.state.tracklines[datasource].polyline.isEmpty()) {
        trackLine = <Polyline color='yellow' positions={this.state.tracklines[datasource].polyline.getLatLngs()} />
        break
      }
    }

    const startMarker = //null
      this.state.tracklines[this.state.posDataSource] && !this.state.tracklines[this.state.posDataSource].startPoint !== null ? (
        <CircleMarker center={this.state.tracklines[this.state.posDataSource].startPoint} radius={3} color={'green'} />
      ) : null

    const endMarker = //null
      this.state.tracklines[this.state.posDataSource] && !this.state.tracklines[this.state.posDataSource].endPoint !== null ? (
        <CircleMarker center={this.state.tracklines[this.state.posDataSource].endPoint} radius={3} color={'red'} />
      ) : null

    return (
      <Container className='mt-2'>
        <EventCommentModal />
        <EventShowDetailsModal />
        <Row>
          <ButtonToolbar className='mb-2 ml-1 align-items-center'>
            <span onClick={() => this.props.gotoCruiseMenu()} className='text-warning'>
              {_Cruises_}
            </span>
            <FontAwesomeIcon icon='chevron-right' fixedWidth />
            <span className='text-warning'>{this.props.cruise.cruise_id || 'Loading...'}</span>
            <FontAwesomeIcon icon='chevron-right' fixedWidth />
            <CruiseModeDropdown onClick={this.handleCruiseModeSelect} active_mode={'Map'} modes={['Replay']} />
          </ButtonToolbar>
        </Row>
        <Row>
          <Col className='px-1 mb-2'>
            <Card className='event-header-card'>
              <Card.Header>
                {this.props.event.selected_event.event_value}
                <span className='float-right'>
                  {this.props.event.selected_event.event_author} @ {this.props.event.selected_event.ts}
                </span>
              </Card.Header>
            </Card>
          </Col>
        </Row>
        <Row>
          <Col className='px-1' sm={12}>
            <Card className='border-secondary'>
              <Map
                style={{ height: this.state.height }}
                center={this.state.center}
                zoom={this.state.zoom}
                onMoveEnd={this.handleMoveEnd}
                onZoomEnd={this.handleZoomEnd}
                ref={(map) => (this.map = map)}
              >
                <ScaleControl position='bottomleft' />
                <LayersControl position='topright'>{baseLayers}</LayersControl>
                {trackLine}
                {startMarker}
                {endMarker}
                {this.renderMarker()}
              </Map>
            </Card>
          </Col>
        </Row>
        <Row>
          <Col className='px-1 my-2' xl={12}>
            {this.renderControlsCard()}
          </Col>
        </Row>
        <Row>
          <Col className='px-1' md={9} lg={9}>
            {this.renderEventCard()}
            <CustomPagination
              className='mt-2'
              page={this.state.activePage}
              count={this.props.event.events.length}
              pageSelectFunc={this.handlePageSelect}
              maxPerPage={maxEventsPerPage}
            />
          </Col>
          <Col className='px-1' md={3} lg={3}>
            <EventFilterForm
              disabled={this.props.event.fetching}
              hideASNAP={this.props.event.hideASNAP}
              handlePostSubmit={this.updateEventFilter}
              minDate={this.props.cruise.start_ts}
              maxDate={this.props.cruise.stop_ts}
              initialValues={this.props.event.eventFilter}
            />
          </Col>
        </Row>
      </Container>
    )
  }
}

CruiseMap.propTypes = {
  advanceCruiseReplayTo: PropTypes.func.isRequired,
  cruise: PropTypes.object.isRequired,
  event: PropTypes.object.isRequired,
  eventUpdateCruiseReplay: PropTypes.func.isRequired,
  gotoCruiseMenu: PropTypes.func.isRequired,
  gotoCruiseReplay: PropTypes.func.isRequired,
  initCruiseReplay: PropTypes.func.isRequired,
  match: PropTypes.object.isRequired,
  roles: PropTypes.array,
  showModal: PropTypes.func.isRequired,
  toggleASNAP: PropTypes.func.isRequired,
  updateEvent: PropTypes.func.isRequired,
  updateEventFilterForm: PropTypes.func.isRequired
}

const mapStateToProps = (state) => {
  return {
    cruise: state.cruise.cruise,
    roles: state.user.profile.roles,
    event: state.event
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(CruiseMap)
