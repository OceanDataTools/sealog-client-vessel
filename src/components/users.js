import React, { Component } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { connect } from 'react-redux'
import { Button, Col, Card, Form, FormControl, Row, Table, OverlayTrigger, Tooltip } from 'react-bootstrap'
import PropTypes from 'prop-types'
import UserForm from './user_form'
import DisplayUserTokenModal from './display_user_token_modal'
import ImportFromFileModal from './import_from_file_modal'
import DeleteModal from './delete_modal'
import UserPermissionsModal from './user_permissions_modal'
import CustomPagination from './custom_pagination'
import { USE_ACCESS_CONTROL } from '../client_settings'
import { _Cruise_ } from '../vocab'
import { create_user } from '../api'
import { generateRandomCharacters } from '../utils'
import { resetURL } from '../actions/index'
import * as mapDispatchToProps from '../actions'

const disabledAccounts = ['admin', 'guest', 'pi']

let fileDownload = require('js-file-download')

const maxSystemUsersPerPage = 4
const maxUsersPerPage = 6

const tableHeaderStyle = { width: USE_ACCESS_CONTROL ? '110px' : '90px' }

class Users extends Component {
  constructor(props) {
    super(props)

    this.state = {
      activePage: 1,
      activeSystemPage: 1,
      filteredUsers: null,
      filteredSystemUsers: null
    }

    this.userSearch = React.createRef()
    this.systemUserSearch = React.createRef()

    this.handlePageSelect = this.handlePageSelect.bind(this)
    this.handleUserImportClose = this.handleUserImportClose.bind(this)
    this.filterUsers = this.filterUsers.bind(this)
  }

  componentDidMount() {
    this.props.fetchUsers()
  }

  componentDidUpdate(prevProps) {
    if (prevProps.users !== this.props.users && this.systemUserSearch.current) {
      this.filterUsers(this.systemUserSearch.current.value, true)
      this.filterUsers(this.userSearch.current.value, false)
    }
  }

  handlePageSelect(eventKey, system = false) {
    this.setState(system ? { activeSystemPage: eventKey } : { activePage: eventKey })
  }

  handleUserDelete(id) {
    this.props.showModal('deleteModal', {
      id: id,
      handleDelete: async (id) => {
        this.props.deleteUser(id)
        this.props.fetchUsers()
      },
      message: 'this user'
    })
  }

  handleUserWipe() {
    this.props.showModal('deleteModal', {
      handleDelete: this.props.deleteAllNonSystemUsers,
      message: 'all non-system user records'
    })
  }

  handleDisplayUserToken(id) {
    this.props.showModal('displayUserToken', { id: id })
  }

  handleUserSelect(id) {
    this.props.leaveUserForm()
    this.props.initUser(id)
  }

  handleUserCreate() {
    this.props.leaveUserForm()
  }

  handleUserImportModal() {
    this.props.showModal('importFromFileModal')
  }

  handleUserImportClose() {
    this.props.fetchUsers()
  }

  handleUserPermissionsModal(user_id) {
    this.props.showModal('userPermissions', { user_id: user_id })
  }

  filterUsers(fieldVal, system) {
    if (fieldVal !== '') {
      const regex = RegExp(fieldVal, 'i')
      const filteredUsers = this.props.users.filter((user) => {
        if (user.system_user === system && (user.username.match(regex) || user.fullname.match(regex) || user.email.match(regex))) {
          return user
        }
      })

      this.setState(system ? { filteredSystemUsers: filteredUsers, activeSystemPage: 1 } : { filteredUsers, activePage: 1 })
    } else {
      this.setState(system ? { filteredSystemUsers: null } : { filteredUsers: null })
    }
    this.handlePageSelect(1, system)
  }

  handleSearchChange(input, system = false) {
    let fieldVal = input.target.value
    this.filterUsers(fieldVal, system)
  }

  exportUsersToJSON(system = false) {
    let users = system ? this.state.filteredSystemUsers : this.state.filteredUsers
    if (!users) {
      users = this.props.users.filter((user) => user.system_user === system)
    }

    if (users.length) {
      fileDownload(JSON.stringify(users, null, 2), `sealog_${system ? 'systemU' : 'u'}serExport.json`)
    }
  }

  async _insertUser({ id, username, fullname, email, password = generateRandomCharacters(12), roles = [], system_user = false }) {
    let result = {
      skipped: false,
      imported: false,
      error: null
    }

    // const item = await get_users({}, id)

    // if (item) {
    //   this.setState((prevState) => ({
    //     skipped: prevState.skipped + 1,
    //     pending: prevState.pending - 1
    //   }))
    //   return
    // }

    const response = await create_user({
      id,
      username,
      fullname,
      email,
      password,
      roles,
      system_user,
      resetURL
    })

    if (response.success) {
      result.imported = true
      return result
    }

    if (response.error.response.data.statusCode == 400 && response.error.response.data.message == 'duplicate uesr ID') {
      result.skipped = true
      return result
    }

    result.error = { ...response.error.response.data, id: id || 'unknown' }
    return result
  }
  renderAddUserButton() {
    if (!this.props.showform) {
      return (
        <Button variant='outline-primary' size='sm' onClick={() => this.handleUserCreate()} disabled={!this.props.userid}>
          Create User
        </Button>
      )
    }
  }

  renderImportUsersButton() {
    if (this.props.roles.includes('admin')) {
      return (
        <Button className='me-1' variant='outline-primary' size='sm' onClick={() => this.handleUserImportModal()}>
          Import
        </Button>
      )
    }
  }

  renderUsers(system = false) {
    const editTooltip = <Tooltip id='editTooltip'>Edit this user.</Tooltip>
    const tokenTooltip = <Tooltip id='tokenTooltip'>Show user&apos;s JWT token.</Tooltip>
    const deleteTooltip = <Tooltip id='deleteTooltip'>Delete this user.</Tooltip>
    const permissionTooltip = <Tooltip id='permissionTooltip'>{_Cruise_} permissions.</Tooltip>

    let usersPerPage = system ? maxSystemUsersPerPage : maxUsersPerPage
    let activePage = system ? this.state.activeSystemPage : this.state.activePage
    let users = system ? this.state.filteredSystemUsers : this.state.filteredUsers
    let edit_roles = system ? ['admin'] : ['admin', 'cruise_manager']

    let userList = Array.isArray(users) ? users : this.props.users.filter((user) => user.system_user === system)

    userList = userList.slice((this.state.activePage - 1) * usersPerPage, activePage * usersPerPage)

    if (!userList.length) {
      return (
        <tr key={system ? 'noSystemUsersFound' : 'noUsersFound'}>
          <td colSpan='3'> No users found!</td>
        </tr>
      )
    }

    return userList.map((user) => {
      const edit_icon = this.props.roles.some((item) => edit_roles.includes(item)) ? (
        <OverlayTrigger placement='top' overlay={editTooltip}>
          <FontAwesomeIcon className='text-warning' onClick={() => this.handleUserSelect(user.id)} icon='pencil-alt' fixedWidth />
        </OverlayTrigger>
      ) : null

      const jwt_icon = this.props.roles.includes('admin') ? (
        <OverlayTrigger placement='top' overlay={tokenTooltip}>
          <FontAwesomeIcon className='text-success' onClick={() => this.handleDisplayUserToken(user.id)} icon='eye' fixedWidth />
        </OverlayTrigger>
      ) : null

      const delete_icon =
        user.id !== this.props.profileid && !disabledAccounts.includes(user.username) ? (
          <OverlayTrigger placement='top' overlay={deleteTooltip}>
            <FontAwesomeIcon className='text-danger' onClick={() => this.handleUserDelete(user.id)} icon='trash' fixedWidth />
          </OverlayTrigger>
        ) : null

      const permission_icon =
        USE_ACCESS_CONTROL && this.props.roles.includes('admin') ? (
          <OverlayTrigger placement='top' overlay={permissionTooltip}>
            <FontAwesomeIcon
              className='text-primary'
              onClick={() => this.handleUserPermissionsModal(user.id)}
              icon='user-lock'
              fixedWidth
            />
          </OverlayTrigger>
        ) : null

      const style = user.disabled ? { textDecoration: 'line-through' } : {}
      const className = this.props.userid === user.id ? 'text-warning' : ''

      return (
        <tr key={user.id}>
          <td style={style} className={className}>
            {user.username}
          </td>
          <td style={style} className={className}>
            {user.fullname}
          </td>
          <td className='text-center'>
            {edit_icon} {jwt_icon} {delete_icon} {permission_icon}
          </td>
        </tr>
      )
    })
  }

  renderUserTable(system = false) {
    return (
      <Table className='mb-0' bordered striped size='sm'>
        <thead>
          <tr>
            <th>User Name</th>
            <th>Full Name</th>
            <th className='text-center' style={tableHeaderStyle}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody>{this.renderUsers(system)}</tbody>
      </Table>
    )
  }

  renderUsersHeader(system = false) {
    const exportTooltip = <Tooltip id='exportTooltip'>Export {system ? 'System ' : ''}Users</Tooltip>
    const deleteAllNonSystemTooltip = !system ? <Tooltip id='deleteAllNonSystemTooltip'>Delete all non-system Users</Tooltip> : null

    const disableBtn = this.props.users.filter((user) => user.system_user === system).length > 0 ? false : true

    return (
      <div>
        {system ? 'System ' : ''} Users
        <OverlayTrigger placement='top' overlay={exportTooltip}>
          <FontAwesomeIcon
            className='float-end ms-2 pt-2 text-primary'
            onClick={() => this.exportUsersToJSON(system)}
            disabled={disableBtn}
            icon='download'
            fixedWidth
          />
        </OverlayTrigger>
        {!system ? (
          <OverlayTrigger placement='top' overlay={deleteAllNonSystemTooltip}>
            <FontAwesomeIcon
              className='float-end pt-2 text-danger'
              onClick={() => this.handleUserWipe(system)}
              disabled={disableBtn}
              icon='trash'
              fixedWidth
            />
          </OverlayTrigger>
        ) : null}
        <Form className='float-end me-2'>
          <FormControl
            ref={system ? this.systemUserSearch : this.userSearch}
            size='sm'
            type='text'
            placeholder='Search'
            className='me-sm-2'
            onChange={(input) => this.handleSearchChange(input, system)}
          />
        </Form>
      </div>
    )
  }

  render() {
    if (!this.props.roles) {
      return <div>Loading...</div>
    }

    const filteredSystemUsers = this.state.filteredSystemUsers
      ? this.state.filteredSystemUsers.length
      : this.props.users.filter((user) => user.system_user === true).length

    const filteredUsers = this.state.filteredSystemUsers
      ? this.state.filteredSystemUsers.length
      : this.props.users.filter((user) => user.system_user === false).length

    if (this.props.roles.some((item) => ['admin', 'cruise_manager'].includes(item))) {
      return (
        <React.Fragment>
          <DeleteModal />
          <DisplayUserTokenModal />
          <ImportFromFileModal handleExit={this.handleUserImportClose} title='Import Users' insertItem={this._insertUser} />
          <UserPermissionsModal onClose={this.props.fetchCruises} />
          <Row className='py-2 px-1 d-flex justify-content-center'>
            <Col className='px-1' sm={8} md={6} lg={5} xl={5}>
              {this.props.roles.includes('admin') ? (
                <Card className='border-secondary'>
                  <Card.Header>{this.renderUsersHeader(true)}</Card.Header>
                  {this.renderUserTable(true)}
                  <CustomPagination
                    className='mt-2'
                    page={this.state.activeSystemPage}
                    count={filteredSystemUsers}
                    pageSelectFunc={(eventKey) => this.handlePageSelect(eventKey, true)}
                    maxPerPage={maxSystemUsersPerPage}
                  />
                </Card>
              ) : null}
              <Card className='border-secondary mt-2'>
                <Card.Header>{this.renderUsersHeader()}</Card.Header>
                {this.renderUserTable()}
                <CustomPagination
                  className='mt-2'
                  page={this.state.activePage}
                  count={filteredUsers}
                  pageSelectFunc={this.handlePageSelect}
                  maxPerPage={maxUsersPerPage}
                />
              </Card>
              <div className='float-end mt-2'>
                {this.renderImportUsersButton()}
                {this.renderAddUserButton()}
              </div>
            </Col>
            <Col className='px-1' sm={10} md={4} lg={5} xl={5}>
              <UserForm handleFormSubmit={this.props.fetchUsers} />
            </Col>
          </Row>
        </React.Fragment>
      )
    } else {
      return <div>What are YOU doing here?</div>
    }
  }
}

Users.propTypes = {
  deleteAllNonSystemUsers: PropTypes.func.isRequired,
  deleteUser: PropTypes.func.isRequired,
  fetchCruises: PropTypes.func.isRequired,
  fetchUsers: PropTypes.func.isRequired,
  initUser: PropTypes.func.isRequired,
  leaveUserForm: PropTypes.func.isRequired,
  profileid: PropTypes.string,
  roles: PropTypes.array,
  showform: PropTypes.bool,
  showModal: PropTypes.func.isRequired,
  userid: PropTypes.string,
  users: PropTypes.array.isRequired
}

const mapStateToProps = (state) => {
  return {
    users: state.user.users,
    userid: state.user.user.id,
    profileid: state.user.profile.id,
    roles: state.user.profile.roles
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(Users)
