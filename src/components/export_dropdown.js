import React, { Component } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Dropdown, OverlayTrigger, Tooltip } from 'react-bootstrap';
import PropTypes from 'prop-types';
import axios from 'axios';
import moment from 'moment';
import Cookies from 'universal-cookie';
import { connect } from 'react-redux';
import { API_ROOT_URL } from '../client_config';

let fileDownload = require('js-file-download');

const dateFormat = "YYYYMMDD";
const timeFormat = "HHmm";

class ExportDropdown extends Component {

  constructor (props) {
    super(props);

    this.state = {
      id: (this.props.id)? this.props.id : "dropdown-download",
      prefix: (this.props.prefix)? this.props.prefix : null,
      disabled: (this.props.disabled != undefined )? this.props.disabled : false,
      hideASNAP: (this.props.hideASNAP != undefined )? this.props.hideASNAP : false,
      eventFilter: (this.props.eventFilter)? this.props.eventFilter : {},
      cruiseID: (this.props.cruiseID)? this.props.cruiseID : undefined,
      sort: (this.props.sort)? this.props.sort : undefined
    };
  }

  static propTypes = {
    id: PropTypes.string,
    prefix: PropTypes.string,
    disabled: PropTypes.bool,
    hideASNAP: PropTypes.bool,
    eventFilter: PropTypes.object,
    cruiseID: PropTypes.string,
    sort: PropTypes.string
  };

  componentDidUpdate(prevProps) {

    if (this.props.prefix !== prevProps.prefix) {
      this.setState({prefix: this.props.prefix});
    }

    if (this.props.disabled !== prevProps.disabled) {
      this.setState({disabled: this.props.disabled});
    }

    if (this.props.hideASNAP !== prevProps.hideASNAP) {
      this.setState({hideASNAP: this.props.hideASNAP});
    }

    if (this.props.eventFilter !== prevProps.eventFilter) {
      this.setState({eventFilter: this.props.eventFilter});
    }
  }

  async fetchEvents(format, eventFilter, hideASNAP) {

    const cookies = new Cookies();
    format = `format=${format}`;
    let apiRoute = (this.state.cruiseID)? `/api/v1/events/bycruise/${this.props.cruiseID}` : `/api/v1/events/`;
    let startTS = (eventFilter.startTS)? `&startTS=${eventFilter.startTS}` : '';
    let stopTS = (eventFilter.stopTS)? `&stopTS=${eventFilter.stopTS}` : '';
    let value = (eventFilter.value)? `&value=${eventFilter.value.split(',').join("&value=")}` : '';
    value = (hideASNAP)? `&value=!ASNAP${value}` : value;
    let author = (eventFilter.author)? `&author=${eventFilter.author.split(',').join("&author=")}` : '';
    let freetext = (eventFilter.freetext)? `&freetext=${eventFilter.freetext}` : '';
    let datasource = (eventFilter.datasource)? `&datasource=${eventFilter.datasource}` : '';
    let sort = (this.state.sort)? `&sort=${this.state.sort}` : '';

    return await axios.get(`${API_ROOT_URL}${apiRoute}?${format}${startTS}${stopTS}${value}${author}${freetext}${datasource}${sort}`,
      {
        headers: {
          authorization: cookies.get('token')
        }
      }).then((response) => {
      return response.data;
    }).catch((error)=>{
      if(error.response.data.statusCode === 404){
        return [];
      } else {
        console.log(error.response);
        return [];
      }
    }
    );
  }

  async fetchEventAuxData(eventFilter, hideASNAP) {

    const cookies = new Cookies();
    let apiRoute = (this.state.cruiseID)? `/api/v1/event_aux_data/bycruise/${this.props.cruiseID}` : `/api/v1/event_aux_data/`
    let startTS = (eventFilter.startTS)? `startTS=${eventFilter.startTS}` : '';
    let stopTS = (eventFilter.stopTS)? `&stopTS=${eventFilter.stopTS}` : '';
    let value = (eventFilter.value)? `&value=${eventFilter.value.split(',').join("&value=")}` : '';
    value = (hideASNAP)? `&value=!ASNAP${value}` : value;
    let author = (eventFilter.author)? `&author=${eventFilter.author.split(',').join("&author=")}` : '';
    let freetext = (eventFilter.freetext)? `&freetext=${eventFilter.freetext}` : '';
    let datasource = (eventFilter.datasource)? `&datasource=${eventFilter.datasource}` : '';
    let sort = (this.state.sort)? `&sort=${this.state.sort}` : '';

    return await axios.get(`${API_ROOT_URL}${apiRoute}?${startTS}${stopTS}${value}${author}${freetext}${datasource}${sort}`,
      {
        headers: {
          authorization: cookies.get('token')
        }
      }).then((response) => {
      return response.data;
    }).catch((error)=>{
      if(error.response.data.statusCode === 404){
        return [];
      } else {
        console.log(error.response);
        return [];
      }
    }
    );
  }

  async fetchEventsWithAuxData(format, eventFilter, hideASNAP) {

    const cookies = new Cookies();
    format = `format=${format}`;
    let apiRoute = (this.state.cruiseID)? `/api/v1/event_exports/bycruise/${this.props.cruiseID}` : `/api/v1/event_exports/`;
    let startTS = (eventFilter.startTS)? `&startTS=${eventFilter.startTS}` : '';
    let stopTS = (eventFilter.stopTS)? `&stopTS=${eventFilter.stopTS}` : '';
    let value = (eventFilter.value)? `&value=${eventFilter.value.split(',').join("&value=")}` : '';
    value = (hideASNAP)? `&value=!ASNAP${value}` : value;
    let author = (eventFilter.author)? `&author=${eventFilter.author.split(',').join("&author=")}` : '';
    let freetext = (eventFilter.freetext)? `&freetext=${eventFilter.freetext}` : '';
    let datasource = (eventFilter.datasource)? `&datasource=${eventFilter.datasource}` : '';
    let sort = (this.state.sort)? `&sort=${this.state.sort}` : '';

    return await axios.get(`${API_ROOT_URL}${apiRoute}?${format}${startTS}${stopTS}${value}${author}${freetext}${datasource}${sort}`,
      {
        headers: {
          authorization: cookies.get('token')
        }
      }).then((response) => {
      return response.data;
    }).catch((error)=>{
      if(error.response.data.statusCode === 404){
        return [];
      } else {
        console.log(error.response);
        return [];
      }
    }
    );
  }

  exportEventsWithAuxData(format='json') {
    this.fetchEventsWithAuxData(format, this.state.eventFilter, this.state.hideASNAP).then((results) => {
      let prefix = (this.state.prefix)? this.state.prefix : moment.utc(results[0].ts).format(dateFormat + "_" + timeFormat);
      fileDownload((format == 'json')? JSON.stringify(results) : results, `${prefix}_sealog_export.${format}`);
    }).catch((error) => {
      console.log(error);
    });
  }

  exportEvents(format='json') {
    this.fetchEvents(format, this.state.eventFilter, this.state.hideASNAP).then((results) => {
      let prefix = (this.state.prefix)? this.state.prefix : moment.utc(results[0].ts).format(dateFormat + "_" + timeFormat);
      fileDownload((format == 'json')? JSON.stringify(results) : results, `${prefix}_sealog_eventExport.${format}`);
    }).catch((error) => {
      console.log(error);
    });
  }

  exportAuxData() {
    this.fetchEventAuxData(this.state.eventFilter, this.state.hideASNAP).then((results) => {
      let prefix = (this.state.prefix)? this.state.prefix : moment.utc(results[0].ts).format(dateFormat + "_" + timeFormat);
      fileDownload(JSON.stringify(results), `${prefix}_sealog_auxDataExport.json`);
    }).catch((error) => {
      console.log(error);
    });
  }

  render() {
    const exportTooltip = (<Tooltip id="exportTooltip">Export events</Tooltip>);

    return (
      <Dropdown as={'span'} disabled={this.state.disabled} id={this.state.id}>
        <Dropdown.Toggle as={'span'}><OverlayTrigger placement="top" overlay={exportTooltip}><FontAwesomeIcon icon='download' fixedWidth/></OverlayTrigger></Dropdown.Toggle>
        <Dropdown.Menu>
          <Dropdown.Header className="text-warning" key="toJSONHeader">JSON format</Dropdown.Header>
          <Dropdown.Item key="toJSONAll" onClick={ () => this.exportEventsWithAuxData('json')}>Events w/aux data</Dropdown.Item>
          <Dropdown.Item key="toJSONEvents" onClick={ () => this.exportEvents('json')}>Events Only</Dropdown.Item>
          <Dropdown.Item key="toJSONAuxData" onClick={ () => this.exportAuxData()}>Aux Data Only</Dropdown.Item>
          <Dropdown.Divider />
          <Dropdown.Header className="text-warning" key="toCSVHeader">CSV format</Dropdown.Header>
          <Dropdown.Item key="toCSVAll" onClick={ () => this.exportEventsWithAuxData('csv')}>Events w/aux data</Dropdown.Item>
          <Dropdown.Item key="toCSVEvents" onClick={ () => this.exportEvents('csv')}>Events Only</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
    );
  }
}

// function mapStateToProps(state) {
//   return {};
// }

export default connect(null, null)(ExportDropdown);
