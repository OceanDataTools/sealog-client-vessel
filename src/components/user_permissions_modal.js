import React, { Component } from 'react';
import { compose } from 'redux';
import { connectModal } from 'redux-modal';
import PropTypes from 'prop-types';
import axios from 'axios';
import Cookies from 'universal-cookie';
import { Form, ListGroup, Modal } from 'react-bootstrap';
import { API_ROOT_URL } from '../client_config';

const updateType = {
    ADD: true,
    REMOVE: false
}

const cookies = new Cookies();

class RenderTableRow extends Component {

  constructor (props) {
    super(props);

    this.state = {
      open: false
    }

    this.toggleRowCollapse = this.toggleRowCollapse.bind(this);
  }

  toggleRowCollapse() {
    this.setState((prevState) => {
      return {open: !prevState.open};
    })
  }

  render () {
    const { cruise } = this.props

    return (
      <ListGroup.Item onClick={this.toggleRowCollapse}>
        {cruise}
      </ListGroup.Item> 
    );
  }
}

class UserPermissionsModal extends Component {

  constructor (props) {
    super(props);

    this.state = {
      cruises: null,
      Permissions: {}
    }

    this.fetchCruises = this.fetchCruises.bind(this);
  }

  static propTypes = {
    user_id: PropTypes.string,
    handleHide: PropTypes.func.isRequired
  };

  componentDidMount() {
    this.fetchCruises();
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.props.user_id && this.state.cruises && (prevState.cruises !== this.state.cruises )) {
      let permissions = { cruises: [] };

      permissions = this.state.cruises.reduce((cruise_permissions, cruise) => {
        if(cruise.cruise_access_list && cruise.cruise_access_list.includes(this.props.user_id)) {
          cruise_permissions.cruises.push(cruise.id);
        }

        return cruise_permissions;

      }, permissions);

      this.setState({ permissions })
    }
  }

  componentWillUnmount() {
  }

  async updateCruisePermissions(cruise_id, user_id, type) {
    try {

      const payload = {};
      if (type === updateType.ADD) {
        payload.add = [user_id];
      }
      else if (type === updateType.REMOVE) {
        payload.remove = [user_id];
      }

      await axios.patch(`${API_ROOT_URL}/api/v1/cruises/${cruise_id}/permissions`,
      payload,
      {
        headers: {
          Authorization: 'Bearer ' + cookies.get('token'),
          'content-type': 'application/json'
        }
      }).then(async (response) => {
        await this.fetchCruises();
        return response.data;
      }).catch((err) => {
        console.error(err);
        return null;
      });

    } catch(error) {
      console.log(error);
    }
  }

  async fetchCruises() {
    try {

      const cruises = await axios.get(`${API_ROOT_URL}/api/v1/cruises`,
      {
        headers: {
          Authorization: 'Bearer ' + cookies.get('token'),
          'content-type': 'application/json'
        }
      }).then((response) => {
        return response.data;
      }).catch((err) => {
        console.error(err);
        return [];
      });

      this.setState({ cruises })

    } catch(error) {
      console.log(error);
    }
  }

  render() {

    const { show, user_id, handleHide } = this.props

    const body = ( this.props.user_id && this.state.cruises) ?
      this.state.cruises.map((cruise) => {

        const cruiseCheckbox = <Form.Check 
          type="switch"
          id={`cruise_${cruise.id}`}
          label={`${cruise.cruise_id}${(cruise.cruise_additional_meta.cruise_name) ? ': ' + cruise.cruise_additional_meta.cruise_name : ''}`}
          checked={(cruise.cruise_access_list && cruise.cruise_access_list.includes(user_id))}
          onChange={ (e) => { this.updateCruisePermissions(cruise.id, user_id, e.target.checked) }}
        />

        return <RenderTableRow key={cruise.id} cruise={cruiseCheckbox}/>;
      }) :
      null;
      
    if (body) {
      return (
        <Modal show={show} onHide={handleHide}>
          <form>
            <Modal.Header className="bg-light" closeButton>
              <Modal.Title>User Permissions</Modal.Title>
            </Modal.Header>
            { body }
          </form>
        </Modal>
      );
    }
    else {
      return null;
    }
  }
}

export default compose(
  connectModal({ name: 'userPermissions' }),
)(UserPermissionsModal)
