import React, { Component } from 'react'
import { compose } from 'redux'
import { connect } from 'react-redux'
import cookies from '../../cookies'
import { reduxForm, Field } from 'redux-form'
import { Alert, Button, Col, Container, Form, Card, Row } from 'react-bootstrap'
import PropTypes from 'prop-types'
import { renderTextField } from '../form_elements'
import * as mapDispatchToProps from '../../actions'

class UserProfile extends Component {
  constructor(props) {
    super(props)

    this.state = {
      showToken: false
    }
  }

  componentWillUnmount() {
    this.props.leaveUpdateProfileForm()
  }

  handleFormSubmit(formProps) {
    this.props.updateProfile(formProps)
  }

  showToken() {
    if (this.state.showToken) {
      return (
        <div>
          <p>
            <strong className='text-danger'>Warning: DO NOT SHARE THIS!!!</strong>
          </p>
          <p>
            This token has <strong className='text-warning'>FULL</strong> privledges to your account including access to you username and
            email.
          </p>
          <span style={{ wordWrap: 'break-word' }}>{cookies.get('token')}</span>
        </div>
      )
    } else {
      return (
        <div className='d-grid'>
          <Button
            variant='outline-warning'
            size='sm'
            onClick={() => {
              this.setState({ showToken: true })
              setTimeout(() => {
                this.setState({ showToken: false })
              }, 10 * 1000)
            }}
          >
            Show API Token
          </Button>
        </div>
      )
    }
  }

  renderAlert() {
    if (this.props.errorMessage) {
      return (
        <Alert variant='danger'>
          <strong>Oops!</strong> {this.props.errorMessage}
        </Alert>
      )
    }
  }

  renderMessage() {
    if (this.props.message) {
      return (
        <Alert variant='success'>
          <strong>Success!</strong> {this.props.message}
        </Alert>
      )
    }
  }

  render() {
    const { handleSubmit, pristine, reset, submitting, valid } = this.props

    return (
      <Container>
        <Row>
          <Col className='pt-4 d-flex justify-content-center'>
            <Card style={{ width: '18rem', minWidth: '18rem' }}>
              <Card.Body>
                <Form className='mb-1' onSubmit={handleSubmit(this.handleFormSubmit.bind(this))}>
                  <Row>
                    <Field name='username' component={renderTextField} label='Username' required={true} />
                    <Field name='fullname' component={renderTextField} label='Full Name' required={true} />
                    <Field name='email' component={renderTextField} label='Email' disabled={true} />
                    <Field name='password' component={renderTextField} type='password' label='Password' />
                    <Field name='confirmPassword' component={renderTextField} type='password' label='Confirm Password' />
                  </Row>
                  {this.renderAlert()}
                  {this.renderMessage()}
                  <div className='float-end'>
                    <Button className='me-1' variant='outline-secondary' size='sm' disabled={pristine || submitting} onClick={reset}>
                      Reset Values
                    </Button>
                    <Button variant='outline-primary' size='sm' type='submit' disabled={pristine || submitting || !valid}>
                      Update
                    </Button>
                  </div>
                </Form>
                <br />
                <hr className='border-secondary' />
                {this.showToken()}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    )
  }
}

UserProfile.propTypes = {
  errorMessage: PropTypes.string.isRequired,
  handleSubmit: PropTypes.func.isRequired,
  leaveUpdateProfileForm: PropTypes.func.isRequired,
  message: PropTypes.string.isRequired,
  pristine: PropTypes.bool.isRequired,
  reset: PropTypes.func.isRequired,
  submitting: PropTypes.bool.isRequired,
  updateProfile: PropTypes.func.isRequired,
  valid: PropTypes.bool.isRequired
}

const validate = (formProps) => {
  const errors = {}

  if (!formProps.username) {
    errors.username = 'Required'
  } else if (formProps.username.length > 15) {
    errors.username = 'Must be 15 characters or less'
  } else if (formProps.username.match(/[A-Z]/)) {
    errors.username = 'Username can NOT include uppercase letters'
  }

  if (!formProps.fullname) {
    errors.fullname = 'Required'
  }

  if (!formProps.email) {
    errors.email = 'Required'
  } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i.test(formProps.email)) {
    errors.email = 'Invalid email address'
  }

  if (formProps.password !== formProps.confirmPassword) {
    errors.password = 'Passwords must match'
  }

  return errors
}

const mapStateToProps = (state) => {
  return {
    errorMessage: state.user.profile_error,
    message: state.user.profile_message,
    initialValues: state.user.profile,
    userID: state.user.profile.id
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  reduxForm({
    form: 'user_profile',
    enableReinitialize: true,
    validate: validate
  })
)(UserProfile)
