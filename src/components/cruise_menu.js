import axios from 'axios';
import React, { Component } from 'react';
import Cookies from 'universal-cookie';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import moment from 'moment';
import momentDurationFormatSetup from 'moment-duration-format';
import { connect } from 'react-redux';
import { Accordion, Row, Col, Card } from 'react-bootstrap';
import FileDownload from 'js-file-download';
import { API_ROOT_URL, MAIN_SCREEN_TXT, DEFAULT_VESSEL } from '../client_config';

import * as mapDispatchToProps from '../actions';

const CRUISE_ROUTE = "/files/cruises";

const cookies = new Cookies();

class CruiseMenu extends Component {

  constructor (props) {
    super(props);

    this.state = {
      years: null,
      activeYear: (this.props.cruise.start_ts) ? moment.utc(this.props.cruise.start_ts).format("YYYY") : null,
      yearCruises: null,
      activeCruise: (this.props.cruise.id) ? this.props.cruise : null,
    };

    this.handleYearSelect = this.handleYearSelect.bind(this);
    this.handleCruiseSelect = this.handleCruiseSelect.bind(this);
    this.handleCruiseFileDownload = this.handleCruiseFileDownload.bind(this);

  }

  componentDidMount() {
    this.props.fetchCruises();
  }


  componentDidUpdate(prevProps, prevState) {

    if(this.state.years !== prevState.years && this.state.years.size > 0) {
      // console.log("year list changed");
      this.buildCruiseList();
    }

    if(this.props.cruises !== prevProps.cruises && this.props.cruises.length > 0 ) {
      // console.log("cruise list changed");
      this.buildYearList();
      this.setState({ activeCruise: null })
    }

    if(this.state.activeYear !== prevState.activeYear ) {
      // console.log("selected year changed");
      this.setState({ activeCruise: null })
    }

    if(this.props.cruise !== prevProps.cruise && this.props.cruise.id){
      // console.log("selected cruise changed");
      this.setState({activeYear: moment.utc(this.props.cruise.start_ts).format("YYYY"), activeCruise: this.props.cruise})
    }

  }

  componentWillUnmount() {
  }

  handleYearSelect(activeYear) {
    this.setState({ activeYear });
  }

  handleCruiseSelect(id) {
    if(this.state.activeCruise === null || this.state.activeCruise && this.state.activeCruise.id !== id) {
      window.scrollTo(0, 0);
      const activeCruise = this.props.cruises.find(cruise => cruise.id === id);
      // console.log("activeCruise:", activeCruise);
      this.setState({ activeCruise });
    }
  }

  handleCruiseSelectForReplay() {
    if(this.state.activeCruise) {
      this.props.clearEvents();
      this.props.gotoCruiseReplay(this.state.activeCruise.id);
    }
  }

  handleCruiseSelectForReview() {
    if(this.state.activeCruise) {
      this.props.clearEvents();
      this.props.gotoCruiseReview(this.state.activeCruise.id);
    }
  }

  handleCruiseSelectForMap() {
    if(this.state.activeCruise) {
      this.props.clearEvents();
      this.props.gotoCruiseMap(this.state.activeCruise.id);
    }
  }

  handleCruiseSelectForGallery() {
    if(this.state.activeCruise) {
      this.props.clearEvents();
      this.props.gotoCruiseGallery(this.state.activeCruise.id);
    }
  }

  async handleCruiseFileDownload(cruiseID, filename) {
    await axios.get(`${API_ROOT_URL}${CRUISE_ROUTE}/${cruiseID}/${filename}`,
      {
        headers: {
          authorization: cookies.get('token')
        },
        responseType: 'arraybuffer'
      })
      .then((response) => {
        FileDownload(response.data, filename);
      })
      .catch(()=>{
        console.log("JWT is invalid, logging out");
      });
  }

  renderCruiseFiles(cruiseID, files) {
    let output = files.map((file, index) => {
      return <li style={{ listStyleType: "none" }} key={`file_${index}`}><span onClick={() => this.handleCruiseFileDownload(cruiseID, file)}><FontAwesomeIcon className='text-primary' icon='download' fixedWidth /></span><span> {file}</span></li>;
    });
    return <div>{output}<br/></div>;
  }

  renderCruiseCard() {

    if(this.state.activeCruise) {

      let cruiseFiles = (this.state.activeCruise.cruise_additional_meta.cruise_files && this.state.activeCruise.cruise_additional_meta.cruise_files.length > 0)? this.renderCruiseFiles(this.state.activeCruise.id, this.state.activeCruise.cruise_additional_meta.cruise_files): null;

      let cruiseName = (this.state.activeCruise.cruise_additional_meta.cruise_name)? <span><strong>Cruise Name:</strong> {this.state.activeCruise.cruise_additional_meta.cruise_name}<br/></span> : null;
      let cruiseDescription = (this.state.activeCruise.cruise_additional_meta.cruise_description)? <span><strong>Description:</strong> {this.state.activeCruise.cruise_additional_meta.cruise_description}<br/></span> : null;
      let cruiseVessel = <span><strong>Vessel:</strong> {this.state.activeCruise.cruise_additional_meta.cruise_vessel}<br/></span>;
      let cruiseLocation = (this.state.activeCruise.cruise_location)? <span><strong>Location:</strong> {this.state.activeCruise.cruise_location}<br/></span> : null;
      let cruisePorts = (this.state.activeCruise.cruise_additional_meta.cruise_departure_location)? <span><strong>Ports:</strong> {this.state.activeCruise.cruise_additional_meta.cruise_departure_location} <FontAwesomeIcon icon='arrow-right' fixedWidth /> {this.state.activeCruise.cruise_additional_meta.cruise_arrival_location}<br/></span> : null;
      let cruiseDates = <span><strong>Dates:</strong> {moment.utc(this.state.activeCruise.start_ts).format("YYYY/MM/DD")} <FontAwesomeIcon icon='arrow-right' fixedWidth /> {moment.utc(this.state.activeCruise.stop_ts).format("YYYY/MM/DD")}<br/></span>;
      let cruisePi = <span><strong>Chief Scientist:</strong> {this.state.activeCruise.cruise_additional_meta.cruise_pi}<br/></span>;

      return (          
        <Card key={`cruise_${this.state.activeCruise.cruise_id}`}>
          <Card.Header>Cruise: <span className="text-warning">{this.state.activeCruise.cruise_id}</span></Card.Header>
          <Card.Body>
            {cruiseName}
            {cruisePi}
            {cruiseDescription}
            {cruiseVessel}
            {cruiseLocation}
            {cruisePorts}
            {cruiseDates}
            {cruiseFiles}
            <br/>
            <Row>
              <Col sm={6} md={3} lg={3} xl={3}>
                <div className="text-primary" onClick={ () => this.handleCruiseSelectForReplay() }>Goto replay<FontAwesomeIcon icon='arrow-right' fixedWidth /></div>
              </Col>
              <Col sm={6} md={3} lg={3} xl={3}>
                <div className="text-primary" onClick={ () => this.handleCruiseSelectForReview() }>Goto review<FontAwesomeIcon icon='arrow-right' fixedWidth /></div>
              </Col>
              <Col sm={6} md={3} lg={3} xl={3}>
                <div className="text-primary" onClick={ () => this.handleCruiseSelectForMap() }>Goto map<FontAwesomeIcon icon='arrow-right' fixedWidth /></div>
              </Col>
              <Col sm={6} md={3} lg={3} xl={3}>
                <div className="text-primary" onClick={ () => this.handleCruiseSelectForGallery() }>Goto gallery<FontAwesomeIcon icon='arrow-right' fixedWidth /></div>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      );
    }      
  }


  buildYearList() {

    const years = new Set(this.props.cruises.map((cruise) => {
      return moment.utc(cruise.start_ts).format("YYYY");
    }));

    const activeYear = (years.size == 1) ? years.values().next().value : null;

    this.setState({years});
  }

  buildCruiseList() {

    const yearCruises = {}

    if (this.state.years && this.state.years.size > 0) {
      this.state.years.forEach((year) => {

        let startOfYear = new Date(year);
        let endOfYear = new Date(startOfYear.getFullYear()+1, startOfYear.getMonth(), startOfYear.getDate());

        const yearCruisesTemp = this.props.cruises.filter(cruise => moment.utc(cruise.start_ts).isBetween(moment.utc(startOfYear), moment.utc(endOfYear)))
        yearCruises[year] = yearCruisesTemp.map((cruise) => { return { id: cruise.id, cruise_id: cruise.cruise_id } } );
      });

      // console.log('yearCruises:', yearCruises)
      this.setState({ yearCruises });
    }
  }

  renderYearListItems() {

    const yearCards = []

    if (this.state.yearCruises) {
      Object.entries(this.state.yearCruises).forEach(([year,cruises])=>{
        // console.log(`${year}:${cruises.join(", ")}`)

        let yearTxt = <span className="text-primary">{year}</span> 

        let yearCruises = (
          <ul>
            {
              cruises.map((cruise) => {
                return (<li key={`select_${cruise.id}`} ><span className={(this.state.activeCruise && cruise.id === this.state.activeCruise.id) ? "text-warning" : "text-primary"} onClick={ () => this.handleCruiseSelect(cruise.id) }>{cruise.cruise_id}</span><br/></li>);
              })
            }
          </ul>
        );

        if (this.state.years.size > 1) {
          yearCards.unshift(
            <Card key={`year_${year}`} >
              <Accordion.Toggle as={Card.Header} eventKey={year}>
                <h6>Year: {yearTxt}</h6>
              </Accordion.Toggle>
              <Accordion.Collapse eventKey={year}>
                <Card.Body>
                  <strong>Cruises:</strong>
                  {yearCruises}
                </Card.Body>
              </Accordion.Collapse>
            </Card>
          );
        }
        else {
          yearCards.push(
            <Card key={`year_${year}`} >
              <Card.Header>Year: {yearTxt}</Card.Header>
              <Card.Body>
                <strong>Cruises:</strong>
                {yearCruises}
              </Card.Body>
            </Card>
          );
        }
      })
    }

    return yearCards;
 
  }

  renderCruiseListItems() {

    return this.props.cruises.map((cruise) => {

      let cruiseName = (cruise.cruise_additional_meta.cruise_name)? <span><strong>Cruise Name:</strong> {cruise.cruise_additional_meta.cruise_name}<br/></span> : null;
      let cruiseDescription = (cruise.cruise_additional_meta.cruise_description)? <span><strong>Description:</strong> {cruise.cruise_additional_meta.cruise_description}<br/></span> : null;
      let cruiseLocation = (cruise.cruise_location)? <span><strong>Location:</strong> {cruise.cruise_location}<br/></span> : null;
      let cruiseDates = <span><strong>Dates:</strong> {moment.utc(cruise.start_ts).format("YYYY/MM/DD")} - {moment.utc(cruise.stop_ts).format("YYYY/MM/DD")}<br/></span>;
      let cruisePI = <span><strong>Chief Scientist:</strong> {cruise.cruise_additional_meta.cruise_pi}<br/></span>;
      let cruiseVessel = <span><strong>Vessel:</strong> {cruise.cruise_additional_meta.cruise_vessel}<br/></span>;
      let cruiseFiles = (cruise.cruise_additional_meta.cruise_files && cruise.cruise_additional_meta.cruise_files.length > 0)? <span><strong>Files:</strong><br/>{this.renderCruiseFiles(cruise.id, cruise.cruise_additional_meta.cruise_files)}</span>: null;
      
      return (          
        <Card key={cruise.id} >
          <Accordion.Toggle as={Card.Header} eventKey={cruise.id}>
            <h6>Cruise: <span className="text-primary">{cruise.cruise_id}</span></h6>
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
      );
    });      
  }

  renderYearList() {

    if(this.state.years && this.state.years.size > 1) {
      return (
        <Accordion id="accordion-controlled-year" activeKey={this.state.activeYear} onSelect={this.handleYearSelect}>
          {this.renderYearListItems()}
        </Accordion>
      );
    } else if(this.state.years && this.state.years.size > 0) {
      return (
        this.renderYearListItems()
      )
    }

    return (
      <Card>
        <Card.Body>No cruises found!</Card.Body>
      </Card>
    );
  } 

  renderCruiseList() {

    if(this.props.cruises && this.props.cruises.length > 0) {

      return (
        <Accordion id="accordion-controlled-example" activeKey={this.state.activeCruise} onSelect={this.handleCruiseSelect}>
          {this.renderCruiseListItems()}
        </Accordion>
      );
    }

    return (
      <Card>
        <Card.Body>No cruises found!</Card.Body>
      </Card>
    );
  }


  render(){
    return (
      <div>
        <Row>
          <Col xs={12}>
            <h4>Welcome to Sealog</h4>
            {MAIN_SCREEN_TXT}
            <br/><br/>
          </Col>
        </Row>
        <Row>
          <Col sm={4} md={3} lg={{'span':2, 'offset':1}}>
            {this.renderYearList()}
          </Col>
          <Col sm={8} md={9} lg={8}>
            {this.renderCruiseCard()}
          </Col>
        </Row>
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    cruise: state.cruise.cruise,
    cruises: state.cruise.cruises,
    roles: state.user.profile.roles
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(CruiseMenu);
