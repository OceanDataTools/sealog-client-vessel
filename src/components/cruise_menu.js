import React, { Component } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import moment from 'moment'
import { connect } from 'react-redux'
import { Accordion, Button, Card, Col, Container, Row } from 'react-bootstrap'
import PropTypes from 'prop-types'
import ExportDropdown from './export_dropdown'
import CopyCruiseToClipboard from './copy_cruise_to_clipboard'
import { MAIN_SCREEN_HEADER, MAIN_SCREEN_TXT } from '../client_config'
import { handle_cruise_file_download } from '../api'
import { _Cruise_, _cruises_ } from '../vocab'
import * as mapDispatchToProps from '../actions'

class CruiseMenu extends Component {
  constructor(props) {
    super(props)

    this.state = {
      fetching: true,
      years: null,
      activeYear: this.props.cruise.start_ts ? moment.utc(this.props.cruise.start_ts).format('YYYY') : null,
      yearCruises: null,
      activeCruise: this.props.cruise.id ? this.props.cruise : null
    }

    this.handleYearSelect = this.handleYearSelect.bind(this)
    this.handleCruiseSelect = this.handleCruiseSelect.bind(this)
  }

  componentDidMount() {
    this.props.fetchCruises()
    this.setState({ fetching: false })
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.state.years !== prevState.years && this.state.years.size > 0) {
      this.buildCruiseList()
    }

    if (this.props.cruises !== prevProps.cruises && this.props.cruises.length > 0) {
      this.buildYearList()
      const currentCruise = this.props.cruises
        ? this.props.cruises.find((cruise) => {
            const now = moment.utc()
            return now.isBetween(moment.utc(cruise.start_ts), moment.utc(cruise.stop_ts))
          })
        : null

      this.setState({
        activeYear: currentCruise ? moment.utc(currentCruise.start_ts).format('YYYY') : null,
        activeCruise: currentCruise ? currentCruise : null
      })
    }

    if (this.state.activeYear !== prevState.activeYear && prevState.activeYear !== null) {
      this.setState({ activeCruise: null })
    }

    if (this.props.cruise !== prevProps.cruise && this.props.cruise.id) {
      this.setState({
        activeYear: moment.utc(this.props.cruise.start_ts).format('YYYY'),
        activeCruise: this.props.cruise
      })
    }
  }

  handleYearSelect(activeYear) {
    this.setState({ activeYear })
  }

  handleCruiseSelect(id) {
    if (this.state.activeCruise === null || (this.state.activeCruise && this.state.activeCruise.id !== id)) {
      window.scrollTo(0, 0)
      const activeCruise = this.props.cruises.find((cruise) => cruise.id === id)
      this.setState({ activeCruise })
    }
  }

  handleCruiseSelectForReplay() {
    if (this.state.activeCruise) {
      this.props.clearEvents()
      this.props.gotoCruiseReplay(this.state.activeCruise.id)
    }
  }

  handleCruiseSelectForMap() {
    if (this.state.activeCruise) {
      this.props.clearEvents()
      this.props.gotoCruiseMap(this.state.activeCruise.id)
    }
  }

  renderCruiseFiles(files) {
    let output = files.map((file, index) => {
      return (
        <div className='pl-2' key={`file_${index}`}>
          <a className='text-decoration-none' href='#' onClick={() => handle_cruise_file_download(file, this.state.activeCruise.id)}>
            {file}
          </a>
        </div>
      )
    })
    return <div>{output}</div>
  }

  renderCruiseCard() {
    if (this.state.activeCruise) {
      let cruiseStartTime = moment.utc(this.state.activeCruise.start_ts)
      let cruiseStopTime = moment.utc(this.state.activeCruise.stop_ts)
      let cruiseDurationValue = cruiseStopTime.diff(cruiseStartTime)

      let cruiseFiles =
        this.state.activeCruise.cruise_additional_meta.cruise_files &&
        this.state.activeCruise.cruise_additional_meta.cruise_files.length > 0 ? (
          <div>
            <strong>Files:</strong>
            {this.renderCruiseFiles(this.state.activeCruise.cruise_additional_meta.cruise_files)}
          </div>
        ) : null

      let cruiseName = this.state.activeCruise.cruise_additional_meta.cruise_name ? (
        <span>
          <strong>{_Cruise_} Name:</strong> {this.state.activeCruise.cruise_additional_meta.cruise_name}
          <br />
        </span>
      ) : null
      let cruiseDescription = this.state.activeCruise.cruise_additional_meta.cruise_description ? (
        <p className='text-justify' style={{whiteSpace: "pre-wrap"}}>
          <strong>Description:</strong> {this.state.activeCruise.cruise_additional_meta.cruise_description}
          <br />
        </p>
      ) : null
      let cruiseVessel = (
        <span>
          <strong>Vessel:</strong> {this.state.activeCruise.cruise_additional_meta.cruise_vessel}
          <br />
        </span>
      )
      let cruiseLocation = this.state.activeCruise.cruise_location ? (
        <span>
          <strong>Location:</strong> {this.state.activeCruise.cruise_location}
          <br />
        </span>
      ) : null
      let cruisePorts = this.state.activeCruise.cruise_additional_meta.cruise_departure_location ? (
        <span>
          <strong>Ports:</strong> {this.state.activeCruise.cruise_additional_meta.cruise_departure_location}{' '}
          <FontAwesomeIcon icon='arrow-right' fixedWidth /> {this.state.activeCruise.cruise_additional_meta.cruise_arrival_location}
          <br />
        </span>
      ) : null
      let cruiseDates = (
        <span>
          <strong>Dates:</strong> {cruiseStartTime.format('YYYY/MM/DD')} <FontAwesomeIcon icon='arrow-right' fixedWidth />{' '}
          {cruiseStopTime.format('YYYY/MM/DD')}
          <br />
        </span>
      )
      let cruisePi = (
        <span>
          <strong>Chief Scientist:</strong> {this.state.activeCruise.cruise_additional_meta.cruise_pi}
          <br />
        </span>
      )

      let cruiseDuration = (
        <span>
          <strong>Duration:</strong> {moment.duration(cruiseDurationValue).format('d [days] h [hours] m [minutes]')}
          <br />
        </span>
      )

      return (
        <Card className='border-secondary' key={`cruise_${this.state.activeCruise.cruise_id}`}>
          <Card.Header>
            {_Cruise_}:<span className='text-warning'> {this.state.activeCruise.cruise_id}</span>
            <span className='float-right'>
              <CopyCruiseToClipboard cruise={this.state.activeCruise} />
              <ExportDropdown
                id='dropdown-download'
                disabled={false}
                hideASNAP={false}
                eventFilter={{}}
                cruiseID={this.state.activeCruise.id}
                prefix={this.state.activeCruise.cruise_id}
              />
            </span>
          </Card.Header>
          <Card.Body>
            {cruiseName}
            {cruisePi}
            {cruiseDescription}
            {cruiseVessel}
            {cruiseLocation}
            {cruiseDates}
            {cruisePorts}
            {cruiseDuration}
            {cruiseFiles}
            <br />
            <Row className='pt-2 justify-content-center'>
              <Button className='mb-1 mr-1' size='sm' variant='outline-primary' onClick={() => this.handleCruiseSelectForReplay()}>
                Replay
              </Button>
              <Button className='mb-1 mr-1' size='sm' variant='outline-primary' onClick={() => this.handleCruiseSelectForMap()}>
                Map
              </Button>
            </Row>
          </Card.Body>
        </Card>
      )
    }
  }

  buildYearList() {
    const years = new Set(
      this.props.cruises.map((cruise) => {
        return moment.utc(cruise.start_ts).format('YYYY')
      })
    )

    const activeYear = years.size == 1 ? years.values().next().value : null

    this.setState({ years, activeYear })
  }

  buildCruiseList() {
    const yearCruises = {}

    if (this.state.years && this.state.years.size > 0) {
      this.state.years.forEach((year) => {
        let startOfYear = new Date(year)
        let endOfYear = new Date(startOfYear.getFullYear() + 1, startOfYear.getMonth(), startOfYear.getDate())
        const yearCruisesTemp = this.props.cruises.filter((cruise) =>
          moment.utc(cruise.start_ts).isBetween(moment.utc(startOfYear), moment.utc(endOfYear))
        )

        yearCruises[year] = yearCruisesTemp.map((cruise) => {
          return { id: cruise.id, cruise_id: cruise.cruise_id }
        })
      })

      this.setState({ yearCruises })
    }
  }

  renderYearListItems() {
    const yearCards = []

    if (this.state.yearCruises) {
      Object.entries(this.state.yearCruises).forEach(([year, cruises]) => {
        let yearTxt = (
          <span className={year == this.state.activeYear || this.state.years.size == 1 ? 'text-warning' : 'text-primary'}>{year}</span>
        )
        let yearCruises = cruises.map((cruise) => {
          return (
            <div
              key={`select_${cruise.id}`}
              className={this.state.activeCruise && cruise.id === this.state.activeCruise.id ? 'ml-2 text-warning' : 'ml-2 text-primary'}
              onClick={() => this.handleCruiseSelect(cruise.id)}
            >
              {cruise.cruise_id}
            </div>
          )
        })

        if (this.state.years.size > 1) {
          yearCards.unshift(
            <Card className='border-secondary' key={`year_${year}`}>
              <Accordion.Toggle as={Card.Header} eventKey={year}>
                <h6>Year: {yearTxt}</h6>
              </Accordion.Toggle>
              <Accordion.Collapse eventKey={year}>
                <Card.Body className='py-2'>{yearCruises}</Card.Body>
              </Accordion.Collapse>
            </Card>
          )
        } else {
          yearCards.push(
            <Card className='border-secondary' key={`year_${year}`}>
              <Card.Header>Year: {yearTxt}</Card.Header>
              <Card.Body className='py-2'>{yearCruises}</Card.Body>
            </Card>
          )
        }
      })
    }

    return yearCards
  }

  renderCruiseListItems() {
    return this.props.cruises.map((cruise) => {
      let cruiseName = cruise.cruise_additional_meta.cruise_name ? (
        <span>
          <strong>{_Cruise_} Name:</strong> {cruise.cruise_additional_meta.cruise_name}
          <br />
        </span>
      ) : null
      let cruiseDescription = cruise.cruise_additional_meta.cruise_description ? (
        <p className='text-justify'>
          <strong>Description:</strong> {cruise.cruise_additional_meta.cruise_description}
        </p>
      ) : null
      let cruiseLocation = cruise.cruise_location ? (
        <span>
          <strong>Location:</strong> {cruise.cruise_location}
          <br />
        </span>
      ) : null
      let cruiseDates = (
        <span>
          <strong>Dates:</strong> {moment.utc(cruise.start_ts).format('YYYY/MM/DD')} - {moment.utc(cruise.stop_ts).format('YYYY/MM/DD')}
          <br />
        </span>
      )
      let cruisePI = (
        <span>
          <strong>Chief Scientist:</strong> {cruise.cruise_additional_meta.cruise_pi}
          <br />
        </span>
      )
      let cruiseVessel = (
        <span>
          <strong>Vessel:</strong> {cruise.cruise_additional_meta.cruise_vessel}
          <br />
        </span>
      )
      let cruiseFiles =
        cruise.cruise_additional_meta.cruise_files && cruise.cruise_additional_meta.cruise_files.length > 0 ? (
          <span>
            <strong>Files:</strong>
            <br />
            {this.renderCruiseFiles(cruise.cruise_additional_meta.cruise_files)}
          </span>
        ) : null

      return (
        <Card className='border-secondary' key={cruise.id}>
          <Accordion.Toggle as={Card.Header} eventKey={cruise.id}>
            <h6>
              {_Cruise_}: <span className='text-primary'>{cruise.cruise_id}</span>
            </h6>
          </Accordion.Toggle>
          <Accordion.Collapse eventKey={cruise.id}>
            <Card.Body>
              {cruiseName}
              {cruiseDescription}
              {cruiseLocation}
              {cruiseVessel}
              {cruiseDates}
              {cruisePI}
              {cruiseFiles}
            </Card.Body>
          </Accordion.Collapse>
        </Card>
      )
    })
  }

  renderYearList() {
    if (this.state.years && this.state.years.size > 1) {
      return (
        <Accordion
          className='border-secondary'
          id='accordion-controlled-year'
          activeKey={this.state.activeYear}
          onSelect={this.handleYearSelect}
        >
          {this.renderYearListItems()}
        </Accordion>
      )
    } else if (this.state.years && this.state.years.size > 0) {
      return this.renderYearListItems()
    }

    return (
      <Card className='border-secondary'>
        <Card.Body>{this.state.fetching ? 'Fetching...' : `No ${_cruises_} found!`}</Card.Body>
      </Card>
    )
  }
  renderCruiseList() {
    if (this.props.cruises && this.props.cruises.length > 0) {
      return (
        <Accordion id='accordion-controlled-example' activeKey={this.state.activeCruise} onSelect={this.handleCruiseSelect}>
          {this.renderCruiseListItems()}
        </Accordion>
      )
    }

    return (
      <Card className='border-secondary'>
        <Card.Body>{this.state.fetching ? 'Fetching...' : `No ${_cruises_} found!`}</Card.Body>
      </Card>
    )
  }

  render() {
    return (
      <Container className='mt-2'>
        <Row>
          <h4>{MAIN_SCREEN_HEADER}</h4>
          <p className='text-justify'>{MAIN_SCREEN_TXT}</p>
        </Row>
        <Row>
          <Col className='px-1' sm={3} md={3} lg={2}>
            {this.renderYearList()}
          </Col>
          <Col className='px-1' sm={9} md={8} lg={6}>
            {this.renderCruiseCard()}
          </Col>
        </Row>
      </Container>
    )
  }
}

CruiseMenu.propTypes = {
  clearEvents: PropTypes.func.isRequired,
  cruise: PropTypes.object.isRequired,
  cruises: PropTypes.array.isRequired,
  fetchCruises: PropTypes.func.isRequired,
  gotoCruiseMap: PropTypes.func.isRequired,
  gotoCruiseReplay: PropTypes.func.isRequired
}

const mapStateToProps = (state) => {
  return {
    cruise: state.cruise.cruise,
    cruises: state.cruise.cruises
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(CruiseMenu)
