import React, { Component } from 'react';
import { Dropdown } from 'react-bootstrap';
import PropTypes from 'prop-types';
import axios from 'axios';
import Cookies from 'universal-cookie';
import { API_ROOT_URL } from '../client_config';

const cookies = new Cookies();

class CruiseDropdownToggle extends Component {
  constructor(props) {
    super(props);

    this.handleClick = this.handleClick.bind(this);
  }

  handleClick(e) {
    e.preventDefault();

    this.props.onClick(e);
  }

  render() {
    return (
      <span className="text-warning dropdown-toggle" onClick={this.handleClick}>
        {this.props.children}
      </span>
    );
  }
}

class CruiseDropdownMenu extends Component {
  constructor(props) {
    super(props);

    this.handleChange = this.handleChange.bind(this);

  }

  handleChange(e) {
    this.setState({ value: e.target.value.toLowerCase().trim() });
  }

  render() {
    const { children, style, className, 'aria-labelledby': labeledBy, } = this.props;

    return (
      <div style={style} className={className} aria-labelledby={labeledBy}>
        {this.props.children}
      </div>
    );
  }
}

class CruiseDropdown extends Component {

  constructor(props) {
    super(props);

    this.state = {
      menuItems: [],
      toggleText: this.props.active_cruise.cruise_id,
    }

    this.menuItemStyle = {paddingLeft: "10px"};
  }

  static propTypes = {
    active_cruise: PropTypes.object.isRequired,
    onClick: PropTypes.func
  };

  componentDidMount() {
    this.getCruises(this.props.onClick)
  }

  componentDidUpdate(prevProps) {
    if(prevProps.active_cruise !== this.props.active_cruise){
      this.setState({toggleText: this.props.active_cruise.cruise_id})
    }
  }

  async getCruises(onClick) {

    try {
      const response = await axios.get(`${API_ROOT_URL}/api/v1/cruises`,
      {
        headers: {
          authorization: cookies.get('token')
        }
      })
      
      const cruises = await response.data;
      this.setState({menuItems: cruises.map((cruise) => (<Dropdown.Item className="text-warning" onClick={() => onClick(cruise.id)} key={cruise.id}>{cruise.cruise_id}</Dropdown.Item>))})
    }
    catch(error){
      console.log(error)
    }
  }


  render() {

    return (
      <Dropdown as={'span'} id="dropdown-custom-menu">
        <Dropdown.Toggle as={CruiseDropdownToggle}>{this.state.toggleText}</Dropdown.Toggle>
        <Dropdown.Menu as={CruiseDropdownMenu} style={this.dropdownMenuStyle}>
          {this.state.menuItems}
        </Dropdown.Menu>
      </Dropdown>
    )
  }
}

export default CruiseDropdown;
