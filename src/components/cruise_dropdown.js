import React, { Component, useState } from 'react';
import { Dropdown } from 'react-bootstrap';
import PropTypes from 'prop-types';
import axios from 'axios';
import Cookies from 'universal-cookie';
import { API_ROOT_URL } from '../client_config';

const cookies = new Cookies();

const CruiseDropdownToggle = React.forwardRef(
  ({ children, onClick }, ref) => {

    return (
      <span
        className="text-primary dropdown-toggle"
        ref={ref}
        onClick={e => {
          e.preventDefault();
          onClick(e);
        }}
      >
        {children}
      </span>
    );
  }
);

const CruiseDropdownMenu = React.forwardRef(
  ({ children, style, className, 'aria-labelledby': labeledBy }, ref) => {
    const [value, setValue] = useState('');

    return (
      <div
        ref={ref}
        style={style}
        className={className}
        aria-labelledby={labeledBy}
      >
        <ul className="list-unstyled">
          {React.Children.toArray(children).filter(
            child =>
              !value || child.props.children.toLowerCase().startsWith(value),
          )}
        </ul>
      </div>
    );
  }
);


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
  }

  componentDidUpdate(prevProps) {
    if(prevProps.active_cruise !== this.props.active_cruise){
      this.setState({toggleText: this.props.active_cruise.cruise_id})
      this.buildMenuItems();
    }
  }

  async buildMenuItems() {

    let cruise_start_ts = new Date(this.props.active_cruise.start_ts);
    let startOfYear = new Date(Date.UTC(cruise_start_ts.getFullYear(), 0, 1, 0, 0, 0));
    let endOfYear = new Date(Date.UTC(cruise_start_ts.getFullYear(), 11, 31, 23, 59, 59));
  
    try {
      const response = await axios.get(`${API_ROOT_URL}/api/v1/cruises?startTS=${startOfYear.toISOString()}&stopTS=${endOfYear.toISOString()}`,
      {
        headers: {
          authorization: cookies.get('token')
        }
      })
      
      const cruises = await response.data;
      this.setState({menuItems: cruises.map((cruise) => (<Dropdown.Item className="text-primary" onClick={() => this.props.onClick(cruise.id)} key={cruise.id}>{cruise.cruise_id}</Dropdown.Item>))})
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
