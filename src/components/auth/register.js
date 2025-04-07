import React, { Component } from 'react'
import { compose } from 'redux'
import { connect } from 'react-redux'
import { reduxForm, Field } from 'redux-form'
import { Link } from 'react-router-dom'
import { Row, Container, Col, Card, Form, Button } from 'react-bootstrap'
import ReCAPTCHA from 'react-google-recaptcha'
import PropTypes from 'prop-types'
import { RECAPTCHA_SITE_KEY } from '../../client_settings'
import { renderTextField } from '../form_elements'
import * as mapDispatchToProps from '../../actions'

class Register extends Component {
  constructor(props) {
    super(props)

    this.recaptchaRef = React.createRef()
  }

  componentWillUnmount() {
    this.props.leaveRegisterForm()
  }

  async handleFormSubmit({ username, fullname, email, password }) {
    let reCaptcha = RECAPTCHA_SITE_KEY ? await this.recaptchaRef.current.executeAsync() : null
    username = username.toLowerCase()
    this.props.registerUser({ username, fullname, email, password, reCaptcha })
  }

  renderSuccess() {
    if (this.props.message) {
      return (
        <Card className='form-signin'>
          <Card.Body>
            <h5>User Registration</h5>
            <div className='alert alert-success'>
              <strong>Success!</strong> {this.props.message}
            </div>
            <div className='text-center'>
              <hr className='border-secondary' />
              <Link className='btn btn-outline-primary' to={`/login`}>
                Back to Login
              </Link>
            </div>
          </Card.Body>
        </Card>
      )
    }
  }

  renderAlert() {
    if (this.props.errorMessage) {
      return (
        <div className='alert alert-danger'>
          <strong>Oops!</strong> {this.props.errorMessage}
        </div>
      )
    }
  }

  renderForm() {
    if (!this.props.message) {
      const { handleSubmit, submitting, valid } = this.props
      const recaptcha = RECAPTCHA_SITE_KEY ? (
        <span>
          <ReCAPTCHA ref={this.recaptchaRef} sitekey={RECAPTCHA_SITE_KEY} size='invisible' />
          <br />
        </span>
      ) : null

      return (
        <Card className='form-signin'>
          <Card.Body>
            <h5>User Registration</h5>
            <Form onSubmit={handleSubmit(this.handleFormSubmit.bind(this))}>
              <Row>
                <Field name='username' component={renderTextField} label='Username' required={true} sm={6} md={6} lg={6} />
                <Field name='fullname' component={renderTextField} label='Full Name' required={true} sm={6} md={6} lg={6} />
              </Row>
              <Row>
                <Field name='email' component={renderTextField} label='Email' required={true} sm={10} md={10} lg={10} />
              </Row>
              <Row>
                <Field name='password' component={renderTextField} type='password' label='Password' required={true} sm={6} md={6} lg={6} />
                <Field
                  name='confirmPassword'
                  component={renderTextField}
                  type='password'
                  label='Confirm Password'
                  required={true}
                  sm={6}
                  md={6}
                  lg={6}
                />
              </Row>
              <Row>
                <Col>
                  {recaptcha}
                  {this.renderAlert()}
                </Col>
              </Row>
              <Row className='justify-content-center'>
                <Col sm='6'>
                  <div className='d-grid gap-2 pt-2'>
                    <Button className='w-100' variant='outline-primary' type='submit' disabled={submitting || !valid}>
                      Register
                    </Button>
                  </div>
                </Col>
              </Row>
              <hr />
              <Row className='h-100'>
                <Col className='d-flex justify-content-center'>
                  <Link className='text-muted text-link' to={'/login'}>
                    Back to Login
                  </Link>
                </Col>
              </Row>
            </Form>
          </Card.Body>
        </Card>
      )
    }
  }

  render() {
    return (
      <Container>
        <Row className='pt-4 justify-content-center'>
          <Col sm={10} md={8} lg={6} xl={5}>
            {this.renderSuccess()}
            {this.renderForm()}
          </Col>
        </Row>
      </Container>
    )
  }
}

Register.propTypes = {
  errorMessage: PropTypes.string,
  handleSubmit: PropTypes.func.isRequired,
  leaveRegisterForm: PropTypes.func.isRequired,
  message: PropTypes.string,
  registerUser: PropTypes.func.isRequired,
  submitting: PropTypes.bool.isRequired,
  valid: PropTypes.bool.isRequired
}

const validate = (formProps) => {
  const errors = {}

  if (!formProps.username) {
    errors.username = 'Required'
  } else if (formProps.username.length > 15) {
    errors.username = 'Username must be 15 characters or less'
  } else if (formProps.username.match(/[ ]/)) {
    errors.username = 'Username can not include whitespace'
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

  if (!formProps.password) {
    errors.password = 'Required'
  } else if (formProps.password.length < 8) {
    errors.password = 'Password must be 8 characters or more'
  } else if (formProps.password.match(/[ ]/)) {
    errors.password = 'Password can not include whitespace'
  }

  if (formProps.password !== formProps.confirmPassword) {
    errors.confirmPassword = 'Passwords must match'
  }

  return errors
}

let recaptchaInstance = null

const afterSubmit = () => {
  if (recaptchaInstance) {
    recaptchaInstance.reset()
  }
}

const mapStateToProps = (state) => {
  return {
    errorMessage: state.user.register_error,
    message: state.user.register_message
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  reduxForm({
    form: 'register',
    validate: validate,
    onSubmitSuccess: afterSubmit
  })
)(Register)
