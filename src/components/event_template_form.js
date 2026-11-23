import React, { Component } from 'react'
import { compose } from 'redux'
import { connect } from 'react-redux'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { reduxForm, Field, FieldArray, formValueSelector } from 'redux-form'
import { Alert, Badge, Button, Card, Col, Form, OverlayTrigger, Row, Tooltip } from 'react-bootstrap'
import PropTypes from 'prop-types'
import { Client } from '@hapi/nes/lib/client'
import {
  renderAlert,
  renderColorSelectField,
  renderHidden,
  renderMessage,
  renderSelectField,
  renderSwitch,
  renderTextField,
  renderTextArea
} from './form_elements'
import VocabularyOptionField, { VOCABULARY_OPTION_TYPES } from './vocabulary_option_field'
import VisibilityValuesField, { asList } from './visibility_values_field'
import * as mapDispatchToProps from '../actions'
import { WS_ROOT_URL } from '../client_settings'
import { connectWSClient } from '../utils'
import {
  EventTemplateOptionTypes,
  EventTemplateVisibilityOptionTypes,
  EventTemplateButtonColorOptions
} from '../event_template_option_types'

const isConditional = (option) =>
  Boolean(option && option.event_option_visibility && ['show if', 'hide if'].includes(option.event_option_visibility.show_hide))

// The option names around a loop of visibility conditions that leads back
// to the option at index, or null
const visibilityLoop = (options, index) => {
  const names = []
  const visited = new Set()
  let current = index

  while (isConditional(options[current]) && !visited.has(current)) {
    visited.add(current)
    names.push(options[current].event_option_name)

    const controller = options[current].event_option_visibility.event_option_name
    current = options.findIndex((option) => option.event_option_name === controller)
    if (current === index) {
      return [...names, options[index].event_option_name]
    }
  }

  return null
}

// Switches that sit side by side on one line
const SWITCH_COL = { xs: 'auto', sm: 'auto', md: 'auto', lg: 'auto' }

const vocabularySummary = (vocab) =>
  `${vocab.collection}: ${vocab.terms ? `${vocab.terms.length} term${vocab.terms.length === 1 ? '' : 's'}` : 'all shown terms'}`

// One line describing a collapsed option
const optionSummary = (option) => {
  const parts = [option.event_option_name || 'Unnamed', option.event_option_type || 'no type']
  const vocab = option.event_option_vocab

  if (vocab && vocab.collection) {
    parts.push(vocabularySummary(vocab))
  } else if (['dropdown', 'radio buttons', 'checkboxes'].includes(option.event_option_type)) {
    const values = asList(option.event_option_values)
    if (values.length) {
      parts.push(values.length > 3 ? `${values.slice(0, 3).join(', ')} +${values.length - 3} more` : values.join(', '))
    }
  } else if (option.event_option_default_value) {
    parts.push(
      option.event_option_type === 'static text' ? option.event_option_default_value : `default ${option.event_option_default_value}`
    )
  }

  if (isConditional(option)) {
    parts.push(`${option.event_option_visibility.show_hide} ${option.event_option_visibility.event_option_name || '?'}`)
  }

  if (option.event_option_required) {
    parts.push('required')
  }

  return parts.join(' · ')
}

const hasErrors = (errors) => Boolean(errors) && (typeof errors === 'string' || Object.values(errors).some((value) => hasErrors(value)))

class EventTemplateForm extends Component {
  constructor(props) {
    super(props)

    this.renderOptions = this.renderOptions.bind(this)
    this.renderOptionOptions = this.renderOptionOptions.bind(this)
    this.renderVisibilityOptions = this.renderVisibilityOptions.bind(this)

    this.state = {
      // Bumped when a vocabulary changes, so vocabulary options reload terms
      vocabularyRevision: 0,
      // Indexes of the expanded options
      openOptions: new Set()
    }

    this.client = new Client(`${WS_ROOT_URL}`)
  }

  componentDidMount() {
    connectWSClient(this.client, {
      '/ws/status/updateVocabularies': () => this.setState((state) => ({ vocabularyRevision: state.vocabularyRevision + 1 }))
    })
  }

  componentDidUpdate(prevProps) {
    // Another template: start with its options collapsed
    if (prevProps.event_template.id !== this.props.event_template.id) {
      this.setState({ openOptions: new Set() })
    }
  }

  // Expanded options follow theirs through moves and removals
  remapOpenOptions(map) {
    this.setState((state) => ({
      openOptions: new Set([...state.openOptions].map(map).filter((index) => index !== null))
    }))
  }

  toggleOption(index) {
    this.setState((state) => {
      const openOptions = new Set(state.openOptions)
      openOptions.has(index) ? openOptions.delete(index) : openOptions.add(index)
      return { openOptions }
    })
  }

  componentWillUnmount() {
    this.client.disconnect()
    this.props.leaveEventTemplateForm()
  }

  handleFormSubmit(formProps) {
    formProps.system_template = formProps.system_template || false
    formProps.disabled = formProps.disabled || false
    formProps.admin_only = !formProps.system_template ? false : formProps.admin_only || false
    formProps.template_categories = formProps.template_categories || []

    if (typeof formProps.template_categories === 'string') {
      formProps.template_categories = formProps.template_categories.split(',').map((item) => item.trim().toLowerCase())
    }

    formProps.event_free_text_required = formProps.event_free_text_required || false
    formProps.event_options = formProps.event_options || []

    formProps.event_options = formProps.event_options.map((event_option) => {
      event_option.event_option_allow_freeform = event_option.event_option_allow_freeform || false
      event_option.event_option_required = event_option.event_option_required || false

      // The server fills in the values of vocabulary options
      if (!event_option.event_option_vocab || !VOCABULARY_OPTION_TYPES.includes(event_option.event_option_type)) {
        delete event_option.event_option_vocab
      } else {
        event_option.event_option_values = []
        if (event_option.event_option_type === 'static text') {
          event_option.event_option_default_value = ''
        }
      }

      if (['dropdown', 'checkboxes', 'radio buttons'].includes(event_option.event_option_type)) {
        if (typeof event_option.event_option_values === 'string') {
          event_option.event_option_values = event_option.event_option_values.split(',').map((item) => item.trim())
        }
      } else {
        event_option.event_option_values = []
      }

      if (event_option.event_option_visibility) {
        if (event_option.event_option_visibility.show_hide == 'always') {
          delete event_option.event_option_visibility
        } else {
          if (typeof event_option.event_option_visibility.event_option_values === 'string') {
            event_option.event_option_visibility.event_option_values = event_option.event_option_visibility.event_option_values
              .split(',')
              .map((item) => item.trim())
          }
        }
      }

      return event_option
    })

    if (formProps.id) {
      this.props.updateEventTemplate(formProps)
    } else {
      this.props.createEventTemplate(formProps)
    }

    this.props.handleFormSubmit()
  }

  renderVocabularyField(prefix, index) {
    const option = this.props.event_options[index]

    if (!VOCABULARY_OPTION_TYPES.includes(option.event_option_type)) {
      return null
    }

    return (
      <Field
        name={`${prefix}.event_option_vocab`}
        component={VocabularyOptionField}
        optionType={option.event_option_type}
        defaultValue={option.event_option_default_value || ''}
        onDefaultChange={(value) => this.props.change(`${prefix}.event_option_default_value`, value)}
        onDetach={(values) => this.props.change(`${prefix}.event_option_values`, values)}
        revision={this.state.vocabularyRevision}
      />
    )
  }

  renderOptionOptions(prefix, index) {
    if (this.props.event_options && this.props.event_options.length > 0) {
      // The value fields stay mounted (hidden) while a vocabulary supplies
      // the values: unmounting them makes redux-form drop the option's errors
      return (
        <React.Fragment>
          {this.renderVocabularyField(prefix, index)}
          <div className={this.props.event_options[index].event_option_vocab ? 'd-none' : undefined}>
            {this.renderValueOptions(prefix, index)}
          </div>
        </React.Fragment>
      )
    }
  }

  renderValueOptions(prefix, index) {
    if (this.props.event_options && this.props.event_options.length > 0) {
      if (this.props.event_options[index].event_option_type === 'static text') {
        return (
          <div>
            <Field name={`${prefix}.event_option_default_value`} component={renderTextField} label='Value' required={true} />
          </div>
        )
      } else if (this.props.event_options[index].event_option_type === 'text') {
        return (
          <div>
            <Field name={`${prefix}.event_option_default_value`} component={renderTextField} label='Default Value' />
          </div>
        )
      } else if (this.props.event_options[index].event_option_type === 'dropdown') {
        return (
          <Row>
            <Field
              name={`${prefix}.event_option_values`}
              component={renderTextArea}
              label='Dropdown Options'
              required={true}
              rows={2}
              sm={6}
              lg={6}
            />
            <Field
              name={`${prefix}.event_option_default_value`}
              component={renderTextField}
              label='Default Selection'
              placeholder='i.e. a value from the list of options'
              sm={6}
              lg={6}
            />
          </Row>
        )
      } else if (this.props.event_options[index].event_option_type === 'checkboxes') {
        return (
          <div>
            <Field name={`${prefix}.event_option_values`} component={renderTextArea} label='Checkbox Options' required={true} rows={2} />
            <Field
              name={`${prefix}.event_option_default_value`}
              component={renderTextField}
              label='Default Selections'
              placeholder='i.e. a value from the list of options'
            />
          </div>
        )
      } else if (this.props.event_options[index].event_option_type === 'radio buttons') {
        return (
          <Row>
            <Field
              name={`${prefix}.event_option_values`}
              component={renderTextArea}
              label='Radio Button Options'
              required={true}
              rows={2}
            />
            <Field
              name={`${prefix}.event_option_default_value`}
              component={renderTextField}
              label='Default Selection'
              placeholder='i.e. a value from the list of options'
            />
          </Row>
        )
      } else {
        return
      }
    }
  }

  // Keep visibility conditions pointing at an option when it's renamed
  handleRename(index, from, to) {
    const options = this.props.event_options || []
    if (!from || from === to || options.some((option, i) => i !== index && option.event_option_name === from)) {
      return
    }

    options.forEach((option, i) => {
      if (option.event_option_visibility && option.event_option_visibility.event_option_name === from) {
        this.props.change(`event_options[${i}].event_option_visibility.event_option_name`, to)
      }
    })
  }

  renderVisibilityOptions(prefix, index) {
    const options = this.props.event_options || []
    const visibility = options[index] && options[index].event_option_visibility

    if (!visibility || !['show if', 'hide if'].includes(visibility.show_hide)) {
      return null
    }

    // Any other named option except static text, whose value never changes
    const names = options
      .filter((option, i) => i !== index && option.event_option_name && option.event_option_type !== 'static text')
      .map((option) => option.event_option_name)
    if (visibility.event_option_name && !names.includes(visibility.event_option_name)) {
      names.push(visibility.event_option_name)
    }

    const controller = options.find((option, i) => i !== index && option.event_option_name === visibility.event_option_name)
    const loop = visibilityLoop(options, index)

    return (
      <>
        <Field
          name={`${prefix}.event_option_visibility.event_option_name`}
          component={renderSelectField}
          options={names}
          label='Event option name'
          required={true}
          onChange={() => this.props.change(`${prefix}.event_option_visibility.event_option_values`, [])}
          sm={6}
          lg={6}
        />
        <Field
          name={`${prefix}.event_option_visibility.event_option_values`}
          component={VisibilityValuesField}
          controller={controller}
          revision={this.state.vocabularyRevision}
        />
        {loop && (
          <Col xs={12}>
            <Alert variant='warning' className='py-1 small'>
              Circular visibility: {loop.join(' → ')}. These options depend on each other and may never be shown.
            </Alert>
          </Col>
        )}
      </>
    )
  }

  renderVocabularyBadge(index) {
    const option = this.props.event_options && this.props.event_options[index]
    const vocab = option && option.event_option_vocab

    if (!vocab || !vocab.collection) {
      return null
    }

    return (
      <Badge bg='info' className='ms-2 fw-normal'>
        {vocabularySummary(vocab)}
      </Badge>
    )
  }

  renderOptions({ fields, meta: { touched, error } }) {
    const options = this.props.event_options || []
    // Options with errors stay open
    const optionErrors = validate({ event_options: options }).event_options || []

    const swap = (from, to) => {
      fields.swap(from, to)
      this.remapOpenOptions((i) => (i === from ? to : i === to ? from : i))
    }

    const remove = (index) => {
      fields.remove(index)
      this.remapOpenOptions((i) => (i === index ? null : i > index ? i - 1 : i))
    }

    const add = () => {
      const index = fields.length
      fields.push({})
      this.setState((state) => ({ openOptions: new Set([...state.openOptions, index]) }))
    }

    return (
      <div>
        {fields.map((prefix, index) => {
          const invalid = hasErrors(optionErrors[index])
          const open = invalid || this.state.openOptions.has(index)

          return (
            <div key={`option_${index}`}>
              <hr className='border-secondary my-2' />
              <div className='d-flex align-items-center mb-1'>
                <span
                  className='d-flex align-items-center flex-grow-1 text-truncate'
                  role='button'
                  title={invalid ? 'Fix this option to collapse it' : open ? 'Collapse' : 'Expand'}
                  onClick={() => !invalid && this.toggleOption(index)}
                >
                  <FontAwesomeIcon className='text-primary me-1' icon={open ? 'chevron-down' : 'chevron-right'} fixedWidth />
                  <Form.Label className='mb-0 text-nowrap'>Option #{index + 1}</Form.Label>
                  {open ? (
                    this.renderVocabularyBadge(index)
                  ) : (
                    <span className='ms-2 small text-muted text-truncate'>{optionSummary(options[index] || {})}</span>
                  )}
                </span>
                {/* Missing arrows keep their space so the arrows line up */}
                <FontAwesomeIcon
                  className={`text-primary ms-1 ${index < fields.length - 1 ? '' : 'invisible'}`}
                  icon='chevron-down'
                  fixedWidth
                  role='button'
                  title='Move down'
                  onClick={() => index < fields.length - 1 && swap(index, index + 1)}
                />
                <FontAwesomeIcon
                  className={`text-primary ms-1 ${index > 0 ? '' : 'invisible'}`}
                  icon='chevron-up'
                  fixedWidth
                  role='button'
                  title='Move up'
                  onClick={() => index > 0 && swap(index, index - 1)}
                />
                <FontAwesomeIcon
                  className='text-danger ms-1'
                  icon='times'
                  fixedWidth
                  role='button'
                  title='Remove'
                  onClick={() => remove(index)}
                />
              </div>
              {/* Collapsed options stay mounted so their errors still count */}
              <div className={open ? undefined : 'd-none'}>
                <Row>
                  <Field
                    name={`${prefix}.event_option_name`}
                    component={renderTextField}
                    label='Name'
                    required={true}
                    onFocus={() => (this.nameAtFocus = this.props.event_options[index].event_option_name)}
                    onBlur={(event, name) => this.handleRename(index, this.nameAtFocus, name)}
                    sm={5}
                    lg={5}
                  />
                  <Field
                    name={`${prefix}.event_option_type`}
                    component={renderSelectField}
                    options={EventTemplateOptionTypes}
                    label='Type'
                    required={true}
                    sm={4}
                    lg={4}
                  />
                  <Field
                    name={`${prefix}.event_option_required`}
                    component={renderSwitch}
                    label='Required'
                    className='pb-3 d-flex align-items-end'
                    sm={3}
                    lg={3}
                  />
                </Row>
                {this.renderOptionOptions(prefix, index)}
                <Row>
                  <Field
                    name={`${prefix}.event_option_visibility.show_hide`}
                    component={renderSelectField}
                    options={EventTemplateVisibilityOptionTypes}
                    addDefaultOption={false}
                    label='Visibility'
                    required={true}
                    sm={6}
                    lg={6}
                  />
                  {this.renderVisibilityOptions(prefix, index)}
                </Row>
              </div>
            </div>
          )
        })}
        <span className='text-primary' role='button' onClick={add}>
          <FontAwesomeIcon icon='plus' fixedWidth /> Add Option
        </span>
        {touched && error && <span>{error}</span>}
      </div>
    )
  }

  renderAdminOptions() {
    if (this.props.roles.includes('admin')) {
      return (
        <React.Fragment>
          <Field name='system_template' component={renderSwitch} label='System template' {...SWITCH_COL} />
          {this.props.system_template ? (
            <Field name='admin_only' component={renderSwitch} label='Only available to admins' {...SWITCH_COL} />
          ) : null}
        </React.Fragment>
      )
    }
  }

  render() {
    const { handleSubmit, pristine, reset, submitting, valid, initialValues } = this.props
    const formHeader = <div>{this.props.event_template.id ? 'Update' : 'Add'} Event Template</div>

    if (this.props.roles && this.props.roles.some((item) => ['admin', 'cruise_manager', 'template_manager'].includes(item))) {
      return (
        <Card className='border-secondary'>
          <Card.Header>{formHeader}</Card.Header>
          <Card.Body>
            <Form onSubmit={handleSubmit(this.handleFormSubmit.bind(this))}>
              <Field name='id' component={renderHidden} />
              <Row>
                <Field
                  name='event_name'
                  component={renderTextField}
                  label={
                    <OverlayTrigger
                      placement='top'
                      overlay={<Tooltip id='event_name_tooltip'>Button Name is not included in data</Tooltip>}
                    >
                      <span>
                        Button Name <FontAwesomeIcon className='text-muted' icon='circle-info' />
                      </span>
                    </OverlayTrigger>
                  }
                  required={true}
                  sm={6}
                  lg={6}
                />
                <Field name='event_value' component={renderTextField} label='Event Value' required={true} sm={6} lg={6} />
              </Row>
              <Row>
                <Field
                  name='event_button_color'
                  component={renderColorSelectField}
                  options={EventTemplateButtonColorOptions}
                  label='Button Color'
                  sm={4}
                  lg={4}
                />
                <Field
                  name={'template_categories'}
                  component={renderTextField}
                  label='Template Categories (comma delimited)'
                  placeholder='i.e. biology,geology'
                  sm={8}
                  lg={8}
                />
              </Row>
              <Row>
                <Field
                  name='event_free_text_required'
                  id='event_free_text_required'
                  component={renderSwitch}
                  label={'Free text Required?'}
                  {...SWITCH_COL}
                />
                <Field name='disabled' component={renderSwitch} label='Disable template' {...SWITCH_COL} />
                {this.renderAdminOptions(initialValues.system_template)}
              </Row>
              {/* FieldArray re-renders only on its own props: these pass the state the options use */}
              <FieldArray
                name='event_options'
                component={this.renderOptions}
                vocabularyRevision={this.state.vocabularyRevision}
                openOptions={this.state.openOptions}
              />
              {renderAlert(this.props.errorMessage)}
              {renderMessage(this.props.message)}
              <div className='float-end'>
                <Button className='me-1' variant='outline-secondary' size='sm' disabled={pristine || submitting} onClick={reset}>
                  Reset Form
                </Button>
                <Button variant='outline-primary' size='sm' type='submit' disabled={pristine || submitting || !valid}>
                  {this.props.event_template.id ? 'Update' : 'Add'}
                </Button>
              </div>
            </Form>
          </Card.Body>
        </Card>
      )
    } else {
      return <div>What are YOU doing here?</div>
    }
  }
}

EventTemplateForm.propTypes = {
  change: PropTypes.func.isRequired,
  createEventTemplate: PropTypes.func.isRequired,
  errorMessage: PropTypes.string.isRequired,
  event_options: PropTypes.array.isRequired,
  event_template: PropTypes.object.isRequired,
  handleFormSubmit: PropTypes.func.isRequired,
  handleSubmit: PropTypes.func.isRequired,
  initialValues: PropTypes.object.isRequired,
  leaveEventTemplateForm: PropTypes.func.isRequired,
  message: PropTypes.string.isRequired,
  pristine: PropTypes.bool.isRequired,
  reset: PropTypes.func.isRequired,
  roles: PropTypes.array,
  submitting: PropTypes.bool.isRequired,
  system_template: PropTypes.object.isRequired,
  updateEventTemplate: PropTypes.func.isRequired,
  valid: PropTypes.bool.isRequired
}

const validate = (formProps) => {
  const errors = {}

  if (!formProps.event_name) {
    errors.event_name = 'Required'
  } else if (formProps.event_name.length > 32) {
    errors.event_name = 'Must be 32 characters or less'
  }

  if (!formProps.event_value) {
    errors.event_value = 'Required'
  }

  if (typeof formProps.template_categories === 'string' && formProps.template_categories !== '') {
    try {
      formProps.template_categories.split(',')
    } catch (err) {
      errors.template_categories = 'Invalid csv list'
    }
  }

  const event_optionsArrayErrors = []

  if (formProps.event_options) {
    // look for duplicate keys
    let seen = []
    let dupes = []

    formProps.event_options.forEach((event_option) => {
      if (event_option.event_option_name && event_option.event_option_name.length > 0) {
        if (seen.indexOf(event_option.event_option_name.toLowerCase()) >= 0) {
          dupes.push(event_option.event_option_name.toLowerCase())
        } else {
          seen.push(event_option.event_option_name.toLowerCase())
        }
      }
    })

    const event_option_names = formProps.event_options.map((event_option) => {
      return event_option.event_option_name
    })

    formProps.event_options.forEach((event_option, event_optionIndex) => {
      const event_optionErrors = { event_option_visibility: {} }

      if (!event_option.event_option_name) {
        event_optionErrors.event_option_name = 'Required'
      }

      if (event_option.event_option_name && dupes.indexOf(event_option.event_option_name.toLowerCase()) >= 0) {
        event_optionErrors.event_option_name = 'Option name must be unique'
        event_optionsArrayErrors[event_optionIndex] = event_optionErrors
      }

      if (!event_option.event_option_type) {
        event_optionErrors.event_option_type = 'Required'
      }

      const vocab = VOCABULARY_OPTION_TYPES.includes(event_option.event_option_type) && event_option.event_option_vocab

      if (vocab) {
        if (!vocab.collection) {
          event_optionErrors.event_option_vocab = 'Choose a vocabulary'
        } else if (event_option.event_option_type === 'static text' && (!vocab.terms || vocab.terms.length !== 1)) {
          event_optionErrors.event_option_vocab = 'Pick a term'
        } else if (vocab.terms && !vocab.terms.length) {
          event_optionErrors.event_option_vocab = 'Tick at least one term, or use all shown terms'
        }
      } else if (['dropdown', 'checkboxes', 'radio buttons'].includes(event_option.event_option_type)) {
        let valueArray = []

        if (event_option.event_option_values === '') {
          event_optionErrors.event_option_values = 'Required'
        } else {
          try {
            valueArray = (
              typeof event_option.event_option_values === 'object'
                ? event_option.event_option_values
                : event_option.event_option_values.split(',')
            ).map((item) => item.trim())
          } catch (err) {
            event_optionErrors.event_option_values = 'Invalid csv list'
          }
        }

        if (['dropdown', 'radio buttons'].includes(event_option.event_option_type)) {
          if (event_option.event_option_default_value && !valueArray.includes(event_option.event_option_default_value.trim())) {
            event_optionErrors.event_option_default_value = 'Value is not in options list'
          }
        } else if (event_option.event_option_default_value) {
          let defaultValueArray = (
            typeof event_option.event_option_default_value === 'object'
              ? event_option.event_option_default_value
              : event_option.event_option_default_value.split(',')
          ).map((item) => item.trim())
          if (event_option.event_option_default_value && !defaultValueArray.every((element) => valueArray.includes(element))) {
            event_optionErrors.event_option_default_value = 'Value(s) is/are not in options list'
          }
        }
      }

      if (event_option.event_option_type === 'static text' && !vocab) {
        if (!event_option.event_option_default_value || event_option.event_option_default_value.trim() === '') {
          event_optionErrors.event_option_default_value = 'Required'
        }
      }

      if (event_option.event_option_visibility && ['show if', 'hide if'].includes(event_option.event_option_visibility.show_hide)) {
        if (!event_option_names.includes(event_option.event_option_visibility.event_option_name)) {
          event_optionErrors.event_option_visibility.event_option_name = 'Invalid event option name'
        }

        const values = event_option.event_option_visibility.event_option_values
        if (!values || (Array.isArray(values) ? !values.length : !values.trim())) {
          event_optionErrors.event_option_visibility.event_option_values = 'Pick at least one value'
        }
      }

      event_optionsArrayErrors[event_optionIndex] = event_optionErrors
    })
  }

  if (event_optionsArrayErrors.length) {
    errors.event_options = event_optionsArrayErrors
  }

  return errors
}

EventTemplateForm.propTypes = {
  handleFormSubmit: PropTypes.func.isRequired
}

const mapStateToProps = (state) => {
  let initialValues = { ...state.event_template.event_template }

  return {
    errorMessage: state.event_template.event_template_error,
    message: state.event_template.event_template_message,
    initialValues: initialValues,
    event_template: state.event_template.event_template,
    roles: state.user.profile.roles,
    event_options: selector(state, 'event_options'),
    system_template: selector(state, 'system_template')
  }
}

const selector = formValueSelector('editEventTemplate')

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  reduxForm({
    form: 'editEventTemplate',
    enableReinitialize: true,
    validate: validate
  })
)(EventTemplateForm)
