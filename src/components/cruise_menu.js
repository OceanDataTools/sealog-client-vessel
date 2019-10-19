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
      activeYearKey: null,
      years: null,
      activeCruiseKey: null,
      activeCruise: null,

    };

    this.handleYearSelect = this.handleYearSelect.bind(this);
    this.handleCruiseSelect = this.handleCruiseSelect.bind(this);
    this.handleCruiseFileDownload = this.handleCruiseFileDownload.bind(this);

  }

  componentDidMount(){
    this.props.fetchCruises();
  }

  componentDidUpdate(){

    if(this.props.cruises.length > 0 && this.state.years === null) {
      this.buildYearList();
    }

    if(this.props.cruise && this.props.cruise.id && this.props.cruises.length > 0 && this.state.activeCruise === null) {
      this.handleYearSelect(moment.utc(this.props.cruise.start_ts).format("YYYY"));
      this.handleCruiseSelect(this.props.cruise.id);
    }
  }

  componentWillUnmount(){
  }

  handleCruiseSelect(id) {
    if(this.state.activeCruise === null || this.state.activeCruise && this.state.activeCruise.id !== id) {
      window.scrollTo(0, 0);
      const activeCruise = this.props.cruises.find(cruise => cruise.id === id);
      this.setState({activeCruiseKey: activeCruise.id, activeCruise: activeCruise});
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

  handleYearSelect(activeYearKey) {
    if(this.state.activeYearKey !== activeYearKey) {
      this.setState({ activeYearKey: activeYearKey, activeCruise: null});
      this.buildCruiseList(activeYearKey);
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
          <Card.Header>Cruise: <span className="text-warning">{this.state.activeCruise.cruise_id}</span></Card.Header>
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

    const activeYearKey = (years.size == 1) ? years.values().next().value : null;

    this.setState({years});

    this.handleYearSelect(activeYearKey);
  }

  buildCruiseList(year) {
    let startOfYear = new Date(year);
    let endOfYear = new Date(startOfYear.getFullYear()+1, startOfYear.getMonth(), startOfYear.getDate());
    // let yearCruises = this.props.cruises.filter(cruise => moment.utc(cruise.start_ts).isBetween(startOfYear, endOfYear));
    let yearCruises = this.props.cruises.filter(cruise => moment.utc(cruise.start_ts).isBetween(moment.utc(startOfYear), moment.utc(endOfYear)));

    this.setState({ yearCruises });

    if(yearCruises.length === 1 && this.state.activeCruise === null) {
      this.handleCruiseSelect(yearCruises[0].id);
    }
  }

  renderYearListItems() {

    let years = [];

    let cruises = (this.state.yearCruises)? (
      <ul>
        { this.state.yearCruises.map((cruise) => {
          if(this.state.activeCruise && cruise.id === this.state.activeCruise.id) {
            return (<li key={`select_${cruise.id}`} ><span className="text-warning">{cruise.cruise_id}</span><br/></li>);
          }

          return (<li key={`select_${cruise.id}`} ><Link to="#" onClick={ () => this.handleCruiseSelect(cruise.id) }>{cruise.cruise_id}</Link><br/></li>);
        })
        }
      </ul>
    ): null;

    this.state.years.forEach((year) => {

      let yearTxt = null;
      if(year == this.state.activeYearKey) {
        yearTxt = <span className="text-warning">{year}</span>
      }
      else {
        yearTxt = <span className="text-primary">{year}</span> 
      }

      years.push(          
        <Card key={`year_${year}`} >
          <Accordion.Toggle as={Card.Header} eventKey={year}>
            <h6>Year: {yearTxt}</h6>
          </Accordion.Toggle>
          <Accordion.Collapse eventKey={year}>
            <Card.Body>
              <strong>Cruises:</strong>
              {cruises}
            </Card.Body>
          </Accordion.Collapse>
        </Card>
      );
    });

    return years;    
  }

  renderCruiseListItems() {

    return this.props.cruises.map((cruise) => {

      let cruiseName = (cruise.cruise_additional_meta.cruise_name)? <span><strong>Cruise Name:</strong> {cruise.cruise_additional_meta.cruise_name}<br/></span> : null;
      let cruiseDescription = (cruise.cruise_additional_meta.cruise_description)? <span><strong>Description:</strong> {cruise.cruise_additional_meta.cruise_description}<br/></span> : null;
      let cruiseLocation = (cruise.cruise_location)? <span><strong>Location:</strong> {cruise.cruise_location}<br/></span> : null;
      let cruiseDates = <span><strong>Dates:</strong> {moment.utc(cruise.start_ts).format("YYYY/MM/DD")} - {moment.utc(cruise.stop_ts).format("YYYY/MM/DD")}<br/></span>;
      let cruisePI = <span><strong>Chief Scientist:</strong> {cruise.cruise_pi}<br/></span>;
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
              {cruiseDates}
              {cruisePI}
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
          </Accordion.Collapse>
        </Card>
      );
    });      
  }

  renderYearList() {

    if(this.state.years && this.state.years.size > 0){
      return (
        <Accordion id="accordion-controlled-year" activeKey={this.state.activeYearKey} onSelect={this.handleYearSelect}>
          {this.renderYearListItems()}
        </Accordion>
      );
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
        <Accordion id="accordion-controlled-example" activeKey={this.state.activeCruiseKey} onSelect={this.handleCruiseSelect}>
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
          <Col sm={3} md={3} lg={2}>
            {this.renderYearList()}
          </Col>
          <Col sm={4} md={4} lg={5}>
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
