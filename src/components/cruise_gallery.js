import React, { Component } from 'react';
import { connect } from 'react-redux';
import axios from 'axios';
import Cookies from 'universal-cookie';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ButtonToolbar, Container, Row, Col, Tabs, Tab, Form } from 'react-bootstrap';
import EventShowDetailsModal from './event_show_details_modal';
import CruiseGalleryTab from './cruise_gallery_tab';
import CruiseModeDropdown from './cruise_mode_dropdown';
import * as mapDispatchToProps from '../actions';
import { API_ROOT_URL, CUSTOM_CRUISE_NAME } from '../client_config';
import { getImageUrl } from '../utils';

const cookies = new Cookies();

const imageAuxDataSources = ['vesselRealtimeFramegrabberData'];

class CruiseGallery extends Component {

  constructor (props) {
    super(props);

    this.state = {
      fetching: false,
      aux_data: [],
      maxImagesPerPage: 16,
      cruises_name: (CUSTOM_CRUISE_NAME)? CUSTOM_CRUISE_NAME[1].charAt(0).toUpperCase() + CUSTOM_CRUISE_NAME[1].slice(1) : "Cruises"
    };

    this.handleImageCountChange = this.handleImageCountChange.bind(this);
    this.handleCruiseModeSelect = this.handleCruiseModeSelect.bind(this);

  }

  componentDidMount() {
    this.initCruiseImages(this.props.match.params.id, this.props.event.hideASNAP);

    if(!this.props.cruise.id || this.props.cruise.id !== this.props.match.params.id || this.props.event.events.length === 0) {
      this.props.initCruise(this.props.match.params.id);
    }
  }

  componentDidUpdate(prevProps) {

    if(prevProps.event.hideASNAP !== this.props.event.hideASNAP) {
      this.initCruiseImages(this.props.match.params.id, this.props.event.hideASNAP);
    }  
  }

  toggleASNAP() {
    this.props.eventUpdateCruiseReplay(this.props.match.params.id, this.props.event.hideASNAP);

    if(this.props.event.hideASNAP) {
      this.props.showASNAP();
    }
    else {
      this.props.hideASNAP();
    }
  }

  componentWillUnmount(){
  }

  async initCruiseImages(id, hideASNAP=false, auxDatasourceFilter=imageAuxDataSources) {
    this.setState({ fetching: true});

    let url = `${API_ROOT_URL}/api/v1/event_aux_data/bycruise/${id}?datasource=${auxDatasourceFilter.join('&datasource=')}`

    if(hideASNAP) {
      url += '&value=!ASNAP'
    }

    const image_data = await axios.get(url,
      {
        headers: { Authorization: 'Bearer ' + cookies.get('token') }
      }).then((response) => {

      let image_data = {};
      response.data.forEach((data) => {
        for (let i = 0; i < data.data_array.length; i+=2) {
          if(!(data.data_array[i].data_value in image_data)){
            image_data[data.data_array[i].data_value] = { images: [] };
          }

          image_data[data.data_array[i].data_value].images.push({
            event_id: data.event_id,
            filepath: getImageUrl(data.data_array[i+1].data_value)
          });
        }
      });

      return image_data;
    }).catch((error)=>{
      if(error.response.data.statusCode !== 404) {
        console.debug(error);
      }
      return [];
    });

    this.setState({ aux_data: image_data, fetching: false });
  }

  handleImageCountChange(event) {
    this.setState({ maxImagesPerPage: parseInt(event.target.value)});
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
          <CruiseGalleryTab imagesSource={key} imagesData={value} maxImagesPerPage={this.state.maxImagesPerPage} />
        </Tab>
      ));
    }

    return (galleries.length > 0 )?
      (
        <Tabs className="category-tab" variant="pills" id="galleries" mountOnEnter={true} unmountOnExit={true}>
          { galleries }
        </Tabs>
      ) :  (<div><hr className="border-secondary"/><span className="pl-2">No images found</span></div>);
  }

  render(){

    const cruise_id = (this.props.cruise.cruise_id)? this.props.cruise.cruise_id : "loading...";
    const galleries = (this.state.fetching)? <div><hr className="border-secondary"/><span className="pl-2">Loading...</span></div> : this.renderGalleries();

    const ASNAPToggle = (<Form.Check id="ASNAP" type='switch' inline checked={!this.props.event.hideASNAP} onChange={() => this.toggleASNAP()} disabled={this.props.event.fetching} label='ASNAP'/>);

    return (
      <Container className="mt-2">
        <EventShowDetailsModal />
        <Row className="d-flex align-items-center justify-content-between">
          <ButtonToolbar className="align-items-center">
            <span onClick={() => this.props.gotoCruiseMenu()} className="text-warning">{this.state.cruises_name}</span>
            <FontAwesomeIcon icon="chevron-right" fixedWidth/>
            <span  className="text-warning">{cruise_id}</span>
            <FontAwesomeIcon icon="chevron-right" fixedWidth/>
            <CruiseModeDropdown onClick={this.handleCruiseModeSelect} active_mode={"Gallery"} modes={["Replay", "Review", "Map"]}/>
          </ButtonToolbar>
          <span className="float-right">
            <Form style={{marginTop: '-4px'}} className='float-right' inline>
              <Form.Group controlId="selectMaxImagesPerPage" >
                <Form.Control size="sm" as="select" onChange={this.handleImageCountChange}>
                  <option>16</option>
                  <option>32</option>
                  <option>48</option>
                  <option>64</option>
                  <option>80</option>
                </Form.Control>
                <Form.Label>&nbsp;&nbsp;Images/Page&nbsp;&nbsp;</Form.Label>
              </Form.Group>
            </Form>
            {ASNAPToggle}
          </span>
        </Row>
        <Row>
          <Col>
            {galleries}
          </Col>
        </Row>
      </Container>
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
