import React, { Component } from 'react'
import { Map, TileLayer, WMSTileLayer, Marker, Polyline, Popup, LayersControl, ScaleControl, CircleMarker } from 'react-leaflet'
import L from 'leaflet'
import PropTypes from 'prop-types'
import { get_event_aux_data_by_cruise } from '../api'
import { POSITION_DATASOURCES } from '../client_settings'
import { TILE_LAYERS, OVERLAY_LAYERS, DEFAULT_LOCATION } from '../map_tilelayers'

const { BaseLayer } = LayersControl

class TracklineMap extends Component {
  constructor(props) {
    super(props)

    this.state = {
      fetching: false,
      tracklines: {},

      posDataSource: null,

      zoom: 13,
      center: DEFAULT_LOCATION,
      position: DEFAULT_LOCATION,
      showMarker: false,
      height: '480px',
      overlay_array: []
    }

    this.handleMoveEnd = this.handleMoveEnd.bind(this)
    this.handleZoomEnd = this.handleZoomEnd.bind(this)
    this.initMapView = this.initMapView.bind(this)
  }

  componentDidMount() {
    this.initCruiseTrackline(this.props.id)
    this.initOverLayers()
  }

  componentDidUpdate() {
    this.map.leafletElement.invalidateSize()
  }

  async fetchOverlayLayers() {
    try {
      const response = await fetch(OVERLAY_LAYERS, {
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors'
      })
      if (!response.ok) {
        throw new Error('Network response was not ok')
      }
      const data = await response.json() // Parse the JSON data
      return data // Return the fetched data
    } catch (error) {
      console.error('Error fetching data:', error)
      return null // Return null or a default value in case of error
    }
  }

  initMapView() {
    if (this.state.tracklines[this.state.posDataSource] && !this.state.tracklines[this.state.posDataSource].polyline.isEmpty()) {
      this.map.leafletElement.panTo(this.state.tracklines[this.state.posDataSource].polyline.getBounds().getCenter())
      this.map.leafletElement.fitBounds(this.state.tracklines[this.state.posDataSource].polyline.getBounds())
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

  initOverLayers() {
    if (Array.isArray(OVERLAY_LAYERS)) {
      this.setState({ overlay_array: OVERLAY_LAYERS })
    } else if (typeof OVERLAY_LAYERS === 'string') {
      const getOverlayData = async () => {
        const overlay_array = await this.fetchOverlayLayers() // Await the promise to get the resolved data
        this.setState({ overlay_array })
      }

      getOverlayData()
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

  renderMarker() {
    if (!this.props.selectedEvent) {
      return null
    }

    if (
      this.props.selectedEvent.aux_data &&
      typeof this.props.selectedEvent.aux_data.find((data) => data['data_source'] === this.state.posDataSource) !== 'undefined'
    ) {
      const posData = this.props.selectedEvent.aux_data.find((data) => data['data_source'] === this.state.posDataSource)
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
      /* eslint-disable react/jsx-no-duplicate-props */
      if (layer.wms) {
        return (
          <BaseLayer checked={layer.default} key={`baseLayer_${index}`} name={layer.name} key={layer.name}>
            <WMSTileLayer attribution={layer.attribution} url={layer.url} layers={layer.layers} transparent={layer.transparent} />
          </BaseLayer>
        )
      } else {
        return (
          <BaseLayer checked={layer.default} key={`baseLayer_${index}`} name={layer.name} key={layer.name}>
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
      /* eslint-disable react/jsx-no-duplicate-props */
    })

    const overLayers = this.state.overlay_array.map((layer) => {
      // console.log("layer:", layer)
      if (layer.wms) {
        return (
          <LayersControl.Overlay name={layer.name} key={layer.name}>
            <WMSTileLayer attribution={layer.attribution} url={layer.url} layers={layer.layers} transparent={layer.transparent} />
          </LayersControl.Overlay>
        )
      } else {
        return (
          <LayersControl.Overlay name={layer.name} key={layer.name}>
            <TileLayer
              attribution={layer.attribution}
              url={layer.url}
              tms={layer.tms ?? false}
              zoomOffset={layer.zoomOffset ?? 0}
              maxNativeZoom={layer.maxNativeZoom}
            />
          </LayersControl.Overlay>
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
      <Map
        style={{ height: this.state.height }}
        center={this.state.center}
        zoom={this.state.zoom}
        onMoveEnd={this.handleMoveEnd}
        onZoomEnd={this.handleZoomEnd}
        scrollWheelZoom={false}
        ref={(map) => (this.map = map)}
      >
        <ScaleControl position='bottomleft' />
        <LayersControl position='topright'>
          {baseLayers}
          {overLayers}
        </LayersControl>
        {trackLine}
        {startMarker}
        {endMarker}
        {this.renderMarker()}
      </Map>
    )
  }
}

TracklineMap.propTypes = {
  id: PropTypes.string.isRequired,
  selectedEvent: PropTypes.object
}

export default TracklineMap
