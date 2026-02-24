import React, { Component } from 'react'
import { compose } from 'redux'
import { connectModal } from 'redux-modal'
import PropTypes from 'prop-types'
import { Form, ListGroup, Modal } from 'react-bootstrap'
import { get_cruises, get_users, update_cruise_permissions } from '../api'

const updateType = {
  ADD: true,
  REMOVE: false
}

class RenderTableRow extends Component {
  constructor(props) {
    super(props)

    this.state = {
      open: false
    }

    this.toggleRowCollapse = this.toggleRowCollapse.bind(this)
  }

  toggleRowCollapse() {
    this.setState((prevState) => {
      return { open: !prevState.open }
    })
  }

  render() {
    return <ListGroup.Item onClick={this.toggleRowCollapse}>{this.props.cruise}</ListGroup.Item>
  }
}

RenderTableRow.propTypes = {
  cruise: PropTypes.object.isRequired
}

class UserPermissionsModal extends Component {
  constructor(props) {
    super(props)

    this.state = {
      cruises: [],
      user: {},
      Permissions: {}
    }

    this.fetchCruises = this.fetchCruises.bind(this)
    this.fetchUser = this.fetchUser.bind(this)
    this.handleHide = this.handleHide.bind(this)
    this.updateCruisePermissions = this.updateCruisePermissions.bind(this)
  }

  componentDidMount() {
    this.fetchCruises()
    this.fetchUser()
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.props.user_id && this.state.cruises && prevState.cruises !== this.state.cruises) {
      let permissions = { cruises: [] }

      permissions = this.state.cruises.reduce((cruise_permissions, cruise) => {
        if (cruise.cruise_access_list && cruise.cruise_access_list.includes(this.props.user_id)) {
          cruise_permissions.cruises.push(cruise.id)
        }
        return cruise_permissions
      }, permissions)

      this.setState({ permissions })
    }
  }

  async fetchCruises() {
    const cruises = await get_cruises()
    this.setState({ cruises })
  }

  async fetchUser() {
    const user = await get_users({}, this.props.user_id)
    this.setState({ user })
  }

  handleHide() {
    this.props.onClose()
    this.props.handleHide()
  }

  async updateCruisePermissions(cruise_id, type) {
    const payload = {}
    if (type === updateType.ADD) {
      payload.add = [this.props.user_id]
    } else if (type === updateType.REMOVE) {
      payload.remove = [this.props.user_id]
    }

    await update_cruise_permissions(payload, cruise_id, async () => await this.fetchCruises())
  }

  render() {
    const { show, user_id } = this.props

    return this.state.user.username ? (
      <Modal size='md' show={show} onHide={this.handleHide}>
        <form>
          <Modal.Header className='bg-light' closeButton>
            <Modal.Title>
              Access permissions for{' '}
              <i>
                <b>{this.state.user.username}</b>
              </i>
            </Modal.Title>
          </Modal.Header>
          <ListGroup>
            {this.state.cruises.map((cruise) => {
              return (
                <ListGroup.Item key={`user_${cruise.id}`}>
                  <Form.Check
                    type='switch'
                    id={`cruise_${cruise.id}`}
                    label={`${cruise.cruise_id}${cruise.cruise_additional_meta.cruise_name ? ': ' + cruise.cruise_additional_meta.cruise_name : ''}`}
                    checked={cruise.cruise_access_list && cruise.cruise_access_list.includes(user_id)}
                    onChange={(e) => {
                      this.updateCruisePermissions(cruise.id, e.target.checked)
                    }}
                  />
                </ListGroup.Item>
              )
            })}
          </ListGroup>
        </form>
      </Modal>
    ) : null
  }
}

UserPermissionsModal.propTypes = {
  user_id: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  handleHide: PropTypes.func.isRequired,
  show: PropTypes.bool.isRequired
}

export default compose(connectModal({ name: 'userPermissions' }))(UserPermissionsModal)
