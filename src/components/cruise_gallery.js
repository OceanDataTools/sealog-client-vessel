import React, { Component } from 'react';
import path from 'path';
import { connect } from 'react-redux';
import axios from 'axios';
import Cookies from 'universal-cookie';
import { Row, Col, Tabs, Tab } from 'react-bootstrap';
import EventShowDetailsModal from './event_show_details_modal';
import CruiseGalleryTab from './cruise_gallery_tab';
import CruiseDropdown from './cruise_dropdown';
import CruiseModeDropdown from './cruise_mode_dropdown';
import * as mapDispatchToProps from '../actions';
import { API_ROOT_URL, IMAGE_PATH } from '../client_config';

const cookies = new Cookies();

class CruiseGallery extends Component {

  constructor (props) {
    super(props);

    this.state = {
      fetching: false,
      aux_data: []
    };

    this.handleCruiseSelect = this.handleCruiseSelect.bind(this);
    this.handleCruiseModeSelect = this.handleCruiseModeSelect.bind(this);

  }

  componentDidMount() {
    this.initCruiseImages(this.props.match.params.id);

    if(!this.props.cruise.id || this.props.cruise.id !== this.props.match.params.id || this.props.event.events.length === 0) {
      this.props.initCruise(this.props.match.params.id);
    }
  }

  componentDidUpdate() {
  }

  componentWillUnmount(){
  }

  initCruiseImages(id, auxDatasourceFilter = 'vesselRealtimeFramegrabberData') {
    this.setState({ fetching: true});

    let url = `${API_ROOT_URL}/api/v1/event_aux_data/bycruise/${id}?datasource=${auxDatasourceFilter}`;
    axios.get(url,
      {
        headers: {
          authorization: cookies.get('token')
        }
      }).then((response) => {

      let image_data = {};
      response.data.forEach((data) => {
        for (let i = 0; i < data.data_array.length; i+=2) {
          if(!(data.data_array[i].data_value in image_data)){
            image_data[data.data_array[i].data_value] = { images: [] };
          }

          image_data[data.data_array[i].data_value].images.unshift({ event_id: data.event_id, filepath: API_ROOT_URL + IMAGE_PATH + '/' + path.basename(data.data_array[i+1].data_value) });
        }
      });

      this.setState({ aux_data: image_data, fetching: false });
    }).catch((error)=>{
      if(error.response.data.statusCode === 404) {
        this.setState({ aux_data: [], fetching: false });
      } else {
        console.log(error);
      }
    });
  }

  handleCruiseSelect(id) {
    this.props.gotoCruiseGallery(id);
    this.props.initCruise(id, this.state.hideASNAP);
    this.initCruiseImages(id);

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

  renderGalleries() {

    let galleries = [];
    for (const [key, value] of Object.entries(this.state.aux_data)) {
      galleries.push((
        <Tab key={`tab_${key}`} eventKey={`tab_${key}`} title={key}>
          <CruiseGalleryTab imagesSource={key} imagesData={value}/>
        </Tab>

      ));
    }

    return (galleries.length > 0 )?
      (
        <Tabs id="galleries">
          { galleries }
        </Tabs>
      ) :  (<div><hr className="border-secondary"/><span style={{paddingLeft: "8px"}}>No images found</span></div>);
  }

  render(){

    const cruise_id = (this.props.cruise.cruise_id)? this.props.cruise.cruise_id : "loading...";
    const galleries = (this.state.fetching)? <div><hr className="border-secondary"/><span style={{paddingLeft: "8px"}}>Loading...</span></div> : this.renderGalleries();
    return (
      <div>
        <EventShowDetailsModal />
        <Row>
          <Col lg={12}>
            <span style={{paddingLeft: "8px"}}>
              <span onClick={() => this.props.gotoCruiseMenu()} className="text-warning">Cruises</span>
              {' '}/{' '}
              <span><CruiseDropdown onClick={this.handleCruiseSelect} active_cruise={this.props.cruise} active_cruise={this.props.cruise}/></span>
              {' '}/{' '}
              <span><CruiseModeDropdown onClick={this.handleCruiseModeSelect} active_mode={"Gallery"} modes={["Review", "Replay", "Map"]}/></span>
            </span>
          </Col>
          <Col lg={12}>
            {galleries}
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

export default connect(mapStateToProps, mapDispatchToProps)(CruiseGallery);