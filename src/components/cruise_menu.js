import axios from 'axios';
import React, { Component } from 'react';
import Cookies from 'universal-cookie';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import moment from 'moment';
import momentDurationFormatSetup from 'moment-duration-format';
import { Link } from 'react-router-dom';
import { connect } from 'react-redux';
import { Accordion, Row, Col, Card } from 'react-bootstrap';
import FileDownload from 'js-file-download';
import { API_ROOT_URL, MAIN_SCREEN_TXT } from '../client_config';

import * as mapDispatchToProps from '../actions';

const CRUISE_ROUTE = "/files/cruises";

const cookies = new Cookies();

class CruiseMenu extends Component {

  constructor (props) {
    super(props);

    this.state = {
      activeYear: null,
      years: null,
      yearCruises: null,
      activeCruise: null,

    };

    this.handleYearSelect = this.handleYearSelect.bind(this);
    this.handleCruiseSelect = this.handleCruiseSelect.bind(this);
    this.handleCruiseFileDownload = this.handleCruiseFileDownload.bind(this);

  }

  componentDidMount(){
    this.props.fetchCruises();
  }

  componentDidUpdate(prevProps, prevState){

    if(this.props.cruise !== prevProps.cruise && this.props.cruise.id){
      this.setState({activeYear: moment.utc(this.props.cruise.start_ts).format("YYYY"), activeCruise: this.props.cruise})
    }

    if(this.props.cruises !== prevProps.cruises && this.props.cruises.length > 0 ) {
      // console.log("building year list");
      this.buildYearList();
    }

    if(this.state.years !== prevState.years && this.state.years.size > 0) {
      // console.log("building cruises-by-year list");
      this.buildCruiseList();
    }
  }

  componentWillUnmount(){
  }

  handleCruiseSelect(id) {
    if(this.state.activeCruise === null || this.state.activeCruise && this.state.activeCruise.id !== id) {
      window.scrollTo(0, 0);
      const activeCruise = this.props.cruises.find(cruise => cruise.id === id);
      this.setState({activeCruise: activeCruise});
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

  handleCruiseFileDownload(cruiseID, filename) {
    axios.get(`${API_ROOT_URL}${CRUISE_ROUTE}/${cruiseID}/${filename}`,
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

  handleYearSelect(activeYear) {
    if(this.state.activeYear !== activeYear) {
      // console.log("set active year state 1");
      this.setState({ activeYear: activeYear, activeCruise: null});
      // this.buildCruiseList(activeYear);
    }
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
      let cruiseVessel = (this.state.activeCruise.cruise_additional_meta.cruise_vessel)? <span><strong>Vessel:</strong> {this.state.activeCruise.cruise_additional_meta.cruise_vessel}<br/></span> : null;
      let cruiseLocation = (this.state.activeCruise.cruise_location)? <span><strong>Location:</strong> {this.state.activeCruise.cruise_location}<br/></span> : null;
      let cruiseDates = <span><strong>Dates:</strong> {moment.utc(this.state.activeCruise.start_ts).format("YYYY/MM/DD")} - {moment.utc(this.state.activeCruise.stop_ts).format("YYYY/MM/DD")}<br/></span>;
      let cruisePi = (this.state.activeCruise.cruise_pi)? <span><strong>Chief Scientist:</strong> {this.state.activeCruise.cruise_pi}<br/></span> : null;
      // let cruiseLinkToR2R = (this.state.activeCruise.cruise_additional_meta.cruise_linkToR2R)? <span><strong>R2R Cruise Link :</strong> <a href={`${this.state.activeCruise.cruise_additional_meta.cruise_linkToR2R}`} target="_blank"><FontAwesomeIcon icon='link' fixedWidth/></a><br/></span> : null

      return (          
        <Card key={`cruise_${this.state.activeCruise.cruise_id}`}>
          <Card.Header>Cruise: <span className="text-primary">{this.state.activeCruise.cruise_id}</span></Card.Header>
          <Card.Body>
            {cruiseName}
            {cruiseDescription}
            {cruiseVessel}
            {cruiseLocation}
            {cruiseDates}
            {cruisePi}
            {cruiseFiles}
            <Row>
              <Col sm={12} md={6} xl={3}>
                <div className="text-primary" onClick={ () => this.handleCruiseSelectForReplay() }>Goto replay<FontAwesomeIcon icon='arrow-right' fixedWidth /></div>
              </Col>
              <Col sm={12} md={6} xl={3}>
                <div className="text-primary" onClick={ () => this.handleCruiseSelectForReview() }>Goto review<FontAwesomeIcon icon='arrow-right' fixedWidth /></div>
              </Col>
              <Col sm={12} md={6} xl={3}>
                <div className="text-primary" onClick={ () => this.handleCruiseSelectForMap() }>Goto map<FontAwesomeIcon icon='arrow-right' fixedWidth /></div>
              </Col>
              <Col sm={12} md={6} xl={3}>
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

    this.handleYearSelect(activeYear);
  }

  buildCruiseList() {

    const yearCruises = {}

    if (this.state.years && this.state.years.size > 0) {
      this.state.years.forEach((year) => {

        // let cruise_start_ts = new Date(Date.UTC(year));
        // console.log("cruise_start_ts:", cruise_start_ts);
        // let startOfYear1 = new Date(Date.UTC(cruise_start_ts.getFullYear(), 0, 1, 0, 0, 0));
        // console.log("startOfYear1:", startOfYear1);
        // let endOfYear1 = new Date(Date.UTC(cruise_start_ts.getFullYear(), 11, 31, 23, 59, 59));
        // console.log("endOfYear1:", endOfYear1);

        let startOfYear = new Date(year);
        // console.log("startOfYear:", startOfYear);
        let endOfYear = new Date(startOfYear.getFullYear()+1, startOfYear.getMonth(), startOfYear.getDate());
        // console.log("endOfYear:", endOfYear);

        // let yearCruises = this.props.cruises.filter(cruise => moment.utc(cruise.start_ts).isBetween(startOfYear, endOfYear));
        const yearCruisesTemp = this.props.cruises.filter(cruise => moment.utc(cruise.start_ts).isBetween(moment.utc(startOfYear), moment.utc(endOfYear)))
        // console.log("yearCruisesTemp:",yearCruisesTemp);
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
                return (<li key={`select_${cruise.id}`} ><Link to="#" onClick={ () => this.handleCruiseSelect(cruise.id) }>{cruise.cruise_id}</Link><br/></li>);
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
          <Col sm={4} md={{offset:1, span:3}} lg={{offset:2, span:2}}>
            {this.renderYearList()}
          </Col>
          <Col sm={8} md={7} lg={6}>
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
