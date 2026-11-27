import React, { Component } from 'react'
import { compose } from 'redux'
import { connect } from 'react-redux'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { reduxForm, Field, FieldArray, formValueSelector, getFormSyncErrors } from 'redux-form'
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
import VocabularyOptionField, { clearVocabularyCache, VOCABULARY_OPTION_TYPES } from './vocabulary_option_field'
import VisibilityValuesField, { asList } from './visibility_values_field'
import { get_sequences } from '../api'
import { sequenceExample, sequenceRefs } from '../sequences'
import * as mapDispatchToProps from '../actions'
import { DEFAULT_EVENT_TEMPLATE_BUTTON_COLOR, WS_ROOT_URL } from '../client_settings'
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

// One line describing a collapsed option (its name is in the header)
const optionSummary = (option, sequences) => {
  const parts = [option.event_option_type || 'no type']
  const vocab = option.event_option_vocab

  if (option.event_option_type === 'sequence') {
    const sequence = sequences.find((item) => item.name === option.event_option_sequence)
    parts.push(sequence ? `${sequence.name} (${sequence.format})` : option.event_option_sequence || 'no sequence')
    const conditions = option.event_option_sequence_new_when || []
    if (conditions.length) {
      parts.push(
        `new when ${conditions.map((condition) => `${condition.event_option_name || '?'} = ${asList(condition.event_option_values).join('/') || '?'}`).join(', ')}`
      )
    }
  } else if (vocab && vocab.collection) {
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

// A text option's default value, which can hold placeholders filled in for
// each event: a sequence's ID, the cruise and the date (sealog-server
// lib/sequences.js)
const renderTextDefaultField = (field) => {
  const { input, sequences } = field
  const unknown = sequences.length ? sequenceRefs(input.value).filter((name) => !sequences.some((sequence) => sequence.name === name)) : []
  const example = sequences.length ? sequences[0].name : 'name'

  return (
    <div>
      {renderTextField({ ...field, className: 'pb-0' })}
      <Form.Text className={`d-block pb-2 ${unknown.length ? 'text-danger' : 'text-muted'}`}>
        {unknown.length ? (
          `No sequence named ${unknown.join(', ')}`
        ) : (
          <React.Fragment>
            Can include <code>{`{seq:${example}}`}</code> (the sequence&apos;s current ID), <code>{'{cruise_id}'}</code> and the
            event&apos;s date as <code>{'{yyyy}'}</code> <code>{'{yy}'}</code> <code>{'{mm}'}</code> <code>{'{dd}'}</code>{' '}
            <code>{'{doy}'}</code> (UTC), with any text around them, e.g. <code>{'{cruise_id}_XBT_{yyyy}{mm}{dd}.edf'}</code> or{' '}
            <code>{`{seq:${example}}.hex`}</code>
          </React.Fragment>
        )}
      </Form.Text>
    </div>
  )
}

class EventTemplateForm extends Component {
  constructor(props) {
    super(props)

    // Vocabularies may have changed while the editor was closed; its options
    // load as they mount, before componentDidMount
    clearVocabularyCache()

    this.renderOptions = this.renderOptions.bind(this)
    this.renderOptionOptions = this.renderOptionOptions.bind(this)
    this.renderVisibilityOptions = this.renderVisibilityOptions.bind(this)

    this.state = {
      // Bumped when a vocabulary changes, so vocabulary options reload terms
      vocabularyRevision: 0,
      // Indexes of the expanded options
      openOptions: new Set(),
      // For sequence options
      sequences: []
    }

    this.client = new Client(`${WS_ROOT_URL}`)
  }

  componentDidMount() {
    this.fetchSequences()
    connectWSClient(this.client, {
      '/ws/status/updateVocabularies': () => this.setState((state) => ({ vocabularyRevision: state.vocabularyRevision + 1 })),
      '/ws/status/updateSequences': () => this.fetchSequences()
    })
  }

  async fetchSequences() {
    const sequences = await get_sequences()
    if (!this.unmounted) {
      this.setState({ sequences })
    }
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
    this.unmounted = true
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

      // The server fills in sequence IDs when events are saved
      if (event_option.event_option_type === 'sequence') {
        event_option.event_option_default_value = ''
        const conditions = (event_option.event_option_sequence_new_when || [])
          .filter((condition) => condition && condition.event_option_name)
          .map((condition) => ({
            event_option_name: condition.event_option_name,
            event_option_values: asList(condition.event_option_values)
          }))
        if (conditions.length) {
          event_option.event_option_sequence_new_when = conditions
        } else {
          delete event_option.event_option_sequence_new_when
        }
      } else {
        delete event_option.event_option_sequence
        delete event_option.event_option_sequence_new_when
      }

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

  renderSequenceOptions(prefix, index) {
    const { sequences } = this.state
    const chosen = this.props.event_options[index].event_option_sequence
    const sequence = sequences.find((item) => item.name === chosen)
    const names = sequences.map((item) => item.name)
    // Keep an unknown choice selectable, so the form shows what it holds
    if (chosen && !sequence) {
      names.push(chosen)
    }

    return (
      <Row>
        <Field
          name={`${prefix}.event_option_sequence`}
          component={renderSelectField}
          options={names}
          label='Sequence'
          required={true}
          sm={6}
          lg={6}
        />
        <Col sm={6} lg={6} className='small text-muted pt-sm-4'>
          {sequence && (
            <React.Fragment>
              <code>{sequence.format}</code>, e.g. {sequenceExample(sequence)}. The server fills in the next ID (per {sequence.scope}) when
              an event is saved; loggers can type their own.
            </React.Fragment>
          )}
          {!sequences.length && 'No sequences on this server yet: an admin needs to create one.'}
          {chosen && !sequence && sequences.length > 0 && <span className='text-danger'>{chosen} doesn&apos;t exist on this server.</span>}
        </Col>
        {this.renderSequenceConditions(prefix, index)}
      </Row>
    )
  }

  // When the option takes a new ID: conditions on the template's other
  // options, all of which must match; otherwise the current ID is reused
  renderSequenceConditions(prefix, index) {
    const options = this.props.event_options || []
    const conditions = options[index].event_option_sequence_new_when || []
    const path = `${prefix}.event_option_sequence_new_when`
    const names = options
      .filter((option, i) => i !== index && option.event_option_name && !['static text', 'sequence'].includes(option.event_option_type))
      .map((option) => option.event_option_name)

    return (
      <Col xs={12} className='pb-2'>
        <Form.Label className='mb-0'>Take a new ID when</Form.Label>{' '}
        <small className='text-muted'>
          {conditions.length
            ? 'all of these match; other events reuse the current ID (e.g. a cast ID carried by the rest of the cast).'
            : 'always. Add a condition to reuse the current ID until it matches.'}
        </small>
        {conditions.map((condition, c) => {
          const choices =
            condition.event_option_name && !names.includes(condition.event_option_name) ? [...names, condition.event_option_name] : names
          const controller = options.find((option, i) => i !== index && option.event_option_name === condition.event_option_name)

          return (
            <Row key={`${prefix}.condition_${c}`} className='align-items-start'>
              <Field
                name={`${path}[${c}].event_option_name`}
                component={renderSelectField}
                options={choices}
                label='Option'
                required={true}
                onChange={() => this.props.change(`${path}[${c}].event_option_values`, [])}
                sm={4}
                lg={4}
              />
              <Col sm={7} lg={7}>
                <Row>
                  <Field
                    name={`${path}[${c}].event_option_values`}
                    component={VisibilityValuesField}
                    controller={controller}
                    label='Values'
                    revision={this.state.vocabularyRevision}
                  />
                </Row>
              </Col>
              <Col sm={1} lg={1} className='pt-sm-4'>
                <FontAwesomeIcon
                  className='text-danger'
                  icon='times'
                  fixedWidth
                  role='button'
                  title='Remove this condition'
                  onClick={() =>
                    this.props.change(
                      path,
                      conditions.filter((item, i) => i !== c)
                    )
                  }
                />
              </Col>
            </Row>
          )
        })}
        <div>
          <span
            className='text-primary small'
            role='button'
            onClick={() => this.props.change(path, [...conditions, { event_option_name: '', event_option_values: [] }])}
          >
            <FontAwesomeIcon icon='plus' fixedWidth /> Add condition
          </span>
        </div>
      </Col>
    )
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
            <Field
              name={`${prefix}.event_option_default_value`}
              component={renderTextDefaultField}
              label='Default Value'
              sequences={this.state.sequences}
            />
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
      } else if (this.props.event_options[index].event_option_type === 'sequence') {
        return this.renderSequenceOptions(prefix, index)
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

      ;(option.event_option_sequence_new_when || []).forEach((condition, c) => {
        if (condition && condition.event_option_name === from) {
          this.props.change(`event_options[${i}].event_option_sequence_new_when[${c}].event_option_name`, to)
        }
      })
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
    // Options with errors stay open (from redux-form's own run of validate)
    const optionErrors = (this.props.formSyncErrors && this.props.formSyncErrors.event_options) || []

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
          // While the form re-initializes (e.g. when the template list
          // refreshes), fields can briefly list an option that
          // this.props.event_options doesn't have yet; the next render has it
          if (!options[index]) {
            return null
          }

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
                  <Form.Label
                    className={`mb-0 text-nowrap ${options[index] && options[index].event_option_name ? '' : 'fst-italic text-muted'}`}
                  >
                    {(options[index] && options[index].event_option_name) || 'New option'}
                  </Form.Label>
                  {open ? (
                    this.renderVocabularyBadge(index)
                  ) : (
                    <span className='ms-2 small text-muted text-truncate'>{optionSummary(options[index] || {}, this.state.sequences)}</span>
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
                  defaultColor={DEFAULT_EVENT_TEMPLATE_BUTTON_COLOR}
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
                sequences={this.state.sequences}
                formSyncErrors={this.props.formSyncErrors}
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
  // Not syncErrors: reduxForm() takes that prop for itself
  formSyncErrors: PropTypes.object,
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

      if (event_option.event_option_type === 'sequence' && !event_option.event_option_sequence) {
        event_optionErrors.event_option_sequence = 'Choose a sequence'
      }

      if (event_option.event_option_type === 'sequence' && event_option.event_option_sequence_new_when) {
        const conditionErrors = event_option.event_option_sequence_new_when.map((condition) => {
          const conditionError = {}
          if (!condition || !condition.event_option_name || !event_option_names.includes(condition.event_option_name)) {
            conditionError.event_option_name = 'Choose an option'
          }
          if (!condition || !asList(condition.event_option_values).length) {
            conditionError.event_option_values = 'Pick at least one value'
          }
          return conditionError
        })
        if (conditionErrors.some((conditionError) => Object.keys(conditionError).length)) {
          event_optionErrors.event_option_sequence_new_when = conditionErrors
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
    formSyncErrors: getFormSyncErrors('editEventTemplate')(state),
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
