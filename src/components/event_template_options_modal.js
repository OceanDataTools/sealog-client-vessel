import React, { Component } from 'react'
import { compose } from 'redux'
import { connectModal } from 'redux-modal'
import { reduxForm, Field } from 'redux-form'
import { FilePond, registerPlugin } from 'react-filepond'
import FilePondPluginFileValidateType from 'filepond-plugin-file-validate-type'
import { connect } from 'react-redux'
import PropTypes from 'prop-types'
import moment from 'moment'
import {
  renderCheckboxGroup,
  renderDateTimePicker,
  renderRadioGroup,
  renderSelectField,
  renderStaticTextField,
  renderTextArea,
  renderTextField
} from './form_elements'
import { Alert, Button, Form, Modal } from 'react-bootstrap'
import { authorizationHeader, create_event_aux_data, get_cruises_at, get_sequence_current, get_sequence_next, IMAGE_ROUTE } from '../api'
import { API_ROOT_URL } from '../client_settings'
import { DATE_PLACEHOLDERS, dateValues, fillPlaceholders, placeholders } from '../sequences'

registerPlugin(FilePondPluginFileValidateType)

const required = (value) => (!value ? 'Required' : undefined)
const requiredArray = (value) => (!value || value.length === 0 ? 'Must select at least one option' : undefined)

// The number of an ID typed in a sequence's format, read with the prefix and
// suffix of the next ID's preview; null if it isn't in the format
const typedNumber = (value, hint) => {
  const { prefix, suffix } = hint
  if (!value.startsWith(prefix) || !value.endsWith(suffix) || value.length <= prefix.length + suffix.length) {
    return null
  }

  const digits = value.slice(prefix.length, value.length - suffix.length)
  return /^\d+$/.test(digits) ? Number(digits) : null
}

// The values that make a sequence option take a new ID, e.g.
// 'Process: deployment and Action: start'
const describeConditions = (option) =>
  (option.event_option_sequence_new_when || [])
    .map((condition) => `${condition.event_option_name}: ${condition.event_option_values.join(' or ')}`)
    .join(' and ')

// A text option whose default holds placeholders ({seq:name}, {cruise_id}, {yyyy}...)
const hasPlaceholders = (option) => option.event_option_type === 'text' && placeholders(option.event_option_default_value).length > 0

// The texts of an option that can hold placeholders: a text option's
// default, or a plain static text option's value and those it picks by condition
const placeholderTexts = (option) => {
  if (option.event_option_type === 'text') {
    return [option.event_option_default_value || '']
  }

  if (option.event_option_type === 'static text' && !option.event_option_vocab) {
    return [option.event_option_default_value || '', ...(option.event_option_static_values || []).map((entry) => entry.value || '')]
  }

  return []
}

// What a text's placeholders stand for, e.g. 'the ctd_cast ID and the date'
const describePlaceholders = (text) => {
  const found = placeholders(text)
  const parts = [
    ...found.filter((placeholder) => placeholder.startsWith('seq:')).map((placeholder) => `the ${placeholder.slice(4)} ID`),
    ...(found.includes('cruise_id') ? ['the cruise ID'] : []),
    ...(found.some((placeholder) => DATE_PLACEHOLDERS.includes(placeholder)) ? ["the event's date"] : [])
  ]
  return parts.join(' and ')
}

// An ID with the preview's prefix, suffix and zero padding
const idWithNumber = (n, hint) => {
  const digits = hint.id.slice(hint.prefix.length, hint.id.length - hint.suffix.length)
  const width = digits.startsWith('0') ? digits.length : 0
  return `${hint.prefix}${String(n).padStart(width, '0')}${hint.suffix}`
}

class EventTemplateOptionsModal extends Component {
  constructor(props) {
    super(props)

    this.state = {
      event_id: this.props.event ? this.props.event.id : null,
      // Previews of sequence options' IDs, by option index: the next ID
      // ({ id, n, prefix, suffix, mode: 'next' }) or, for an option that
      // doesn't take a new one, the current ID ({ id, mode: 'current' }),
      // or { error, mode }
      hints: {},
      // A typed sequence ID that skips ahead, waiting to be confirmed
      jump: null,
      // Typed sequence IDs confirmed to skip ahead, by option index
      confirmed: {},
      // The values of text placeholders the dialog looks up, by placeholder:
      // the current IDs of sequences the template has no option on
      // ('seq:name') and the cruise ('cruise_id'): { id } or { error }
      refIds: {},
      submitError: null
    }

    this.finalized = false

    // The IDs the dialog filled sequence fields with, by option index: a
    // field still holding one is untouched (see prefillSequenceFields)
    this.prefilled = {}

    // The same for text fields with placeholders (see prefillTextFields)
    this.prefilledText = {}

    this.handleFormHide = this.handleFormHide.bind(this)
  }

  componentDidMount() {
    this.populateDefaultValues()
    this.fetchHints()
  }

  componentDidUpdate(prevProps) {
    // The previews depend on the event's time (its cruise)
    const key = (ts) => (ts && moment(ts).isValid() ? moment(ts).toISOString() : '')
    // ...and, for options with conditions, on whether they take a new ID
    if (key(prevProps.ts) !== key(this.props.ts) || this.sequenceModes() !== this.fetchedModes) {
      this.fetchHints()
    }

    // Placeholders follow the template's own sequence fields
    if (this.sequenceFieldValues() !== this.textPrefilledFrom) {
      this.prefillTextFields()
    }

    // Static text picked by condition follows the values chosen
    if (this.staticValues() !== this.staticApplied) {
      this.applyStaticValues()
    }
  }

  // The value a static text option shows with the values chosen: the first
  // of its values by condition whose conditions match, else its own
  staticValue(option) {
    const picked = (option.event_option_static_values || []).find((entry) => this.meetsConditions(entry.when))
    return picked ? picked.value || '' : option.event_option_default_value || ''
  }

  // The values of the static text options picked by condition, as a string to compare
  staticValues() {
    const { eventTemplate } = this.props
    if (!eventTemplate) {
      return ''
    }

    return eventTemplate.event_options
      .map((option) => ((option.event_option_static_values || []).length ? this.staticValue(option) : ''))
      .join('\n')
  }

  applyStaticValues() {
    if (this.finalized) {
      return
    }

    this.staticApplied = this.staticValues()
    this.props.eventTemplate.event_options.forEach((option, index) => {
      if (!(option.event_option_static_values || []).length) {
        return
      }

      const value = this.staticValue(option)
      const current = this.props.formValues ? this.props.formValues[`option_${index}`] : undefined
      if (value !== (current || '')) {
        this.props.change(`event_options.option_${index}`, value)
      }
    })
  }

  // The template's sequence option taking its ID from the named sequence
  // with the values picked, by index, or -1
  ownSequenceIndex(name) {
    return this.props.eventTemplate.event_options.findIndex(
      (option) => option.event_option_type === 'sequence' && this.pickedSequence(option) === name
    )
  }

  // The sequence fields' values, as a string to compare
  sequenceFieldValues() {
    const { eventTemplate, formValues } = this.props
    if (!eventTemplate) {
      return ''
    }

    return eventTemplate.event_options
      .map((option, index) => (option.event_option_type === 'sequence' ? (formValues && formValues[`option_${index}`]) || '' : ''))
      .join('\n')
  }

  // A text with its placeholders filled in for the event's time: { value },
  // or { missing } naming a placeholder with no value
  resolveText(text) {
    const dates = dateValues(new Date(this.eventTs()))
    const values = {}
    for (const placeholder of placeholders(text)) {
      const own = placeholder.startsWith('seq:') ? this.ownSequenceIndex(placeholder.slice(4)) : -1
      const value =
        dates[placeholder] ||
        (own !== -1
          ? (this.props.formValues && this.props.formValues[`option_${own}`]) || (this.state.hints[own] && this.state.hints[own].id)
          : this.state.refIds[placeholder] && this.state.refIds[placeholder].id)
      if (!value) {
        return { missing: placeholder }
      }
      values[placeholder] = value
    }

    return { value: fillPlaceholders(text, values) }
  }

  // Fill text fields with placeholders with their resolved default, so a
  // logger can edit it. Fields the logger has changed are left alone.
  prefillTextFields() {
    const { eventTemplate } = this.props
    if (!eventTemplate || this.finalized) {
      return
    }

    this.textPrefilledFrom = this.sequenceFieldValues()
    eventTemplate.event_options.forEach((option, index) => {
      if (!hasPlaceholders(option)) {
        return
      }

      const current = this.props.formValues ? this.props.formValues[`option_${index}`] : undefined
      if (current && current !== this.prefilledText[index]) {
        return
      }

      // Set even when empty, so an untouched field is told from a hidden one
      const value = this.resolveText(option.event_option_default_value).value || ''
      if (value !== (current || '') || current === undefined) {
        this.props.change(`event_options.option_${index}`, value)
      }
      this.prefilledText[index] = value
    })
  }

  // The values of text and static text placeholders looked up for ts: the
  // current IDs of sequences the template has no option on, and the cruise
  async fetchRefIds(ts) {
    const found = new Set(this.props.eventTemplate.event_options.flatMap(placeholderTexts).flatMap(placeholders))

    const refIds = {}
    await Promise.all(
      [...found].map(async (placeholder) => {
        if (placeholder === 'cruise_id') {
          const cruises = await get_cruises_at(ts)
          refIds[placeholder] =
            cruises && cruises.length
              ? { id: cruises[0].cruise_id }
              : { error: cruises ? 'no cruise covers this time' : 'the cruise could not be looked up' }
        } else if (placeholder.startsWith('seq:') && this.ownSequenceIndex(placeholder.slice(4)) === -1) {
          const response = await get_sequence_current(placeholder.slice(4), ts)
          refIds[placeholder] = response.data || { error: response.error }
        }
      })
    )

    return refIds
  }

  // Whether the values picked meet all the conditions (any ticked value, for
  // checkboxes)
  meetsConditions(conditions) {
    const options = this.props.eventTemplate.event_options

    return conditions.every((condition) => {
      const index = options.findIndex((item) => item.event_option_name === condition.event_option_name)
      const value = this.props.formValues ? this.props.formValues[`option_${index}`] : undefined
      const values = Array.isArray(value) ? value : value ? String(value).split(';') : []
      return values.some((item) => condition.event_option_values.includes(item))
    })
  }

  // Whether a sequence option takes a new ID with the values picked: its
  // conditions match, or it has none
  takesNewId(option) {
    return this.meetsConditions(option.event_option_sequence_new_when || [])
  }

  // The sequence a sequence option takes its ID from with the values picked,
  // as the server picks it: the first of its sequences by condition whose
  // conditions match, else its sequence (null when it has none)
  pickedSequence(option) {
    const picked = (option.event_option_sequences || []).find((entry) => this.meetsConditions(entry.when))
    return picked ? picked.sequence : option.event_option_sequence || null
  }

  // 'next' or 'current', and the sequence, for each sequence option, as a
  // string to compare
  sequenceModes() {
    const { eventTemplate } = this.props
    if (!eventTemplate) {
      return ''
    }

    return eventTemplate.event_options
      .map((option) =>
        option.event_option_type === 'sequence'
          ? `${this.takesNewId(option) ? 'next' : 'current'}:${this.pickedSequence(option) || ''}`
          : ''
      )
      .join(',')
  }

  // The event's time: the form's Custom Time, else the event's
  eventTs() {
    const ts = this.props.ts || (this.props.event && this.props.event.ts)
    return ts && moment(ts).isValid() ? moment(ts).toISOString() : new Date().toISOString()
  }

  async fetchHints() {
    const { eventTemplate } = this.props
    if (!eventTemplate) {
      return {}
    }

    const ts = this.eventTs()
    this.fetchedModes = this.sequenceModes()
    // Responses can arrive out of order: only the latest request's are used
    const request = (this.hintRequest = (this.hintRequest || 0) + 1)
    const hints = {}
    const [refIds] = await Promise.all([
      this.fetchRefIds(ts),
      ...eventTemplate.event_options.map(async (option, index) => {
        if (option.event_option_type !== 'sequence') {
          return
        }

        const sequence = this.pickedSequence(option)
        const mode = this.takesNewId(option) ? 'next' : 'current'
        if (!sequence) {
          hints[index] = { mode, none: true }
          return
        }

        const response = await (mode === 'next' ? get_sequence_next : get_sequence_current)(sequence, ts)
        hints[index] = { ...(response.data || { error: response.error }), mode, sequence }
      })
    ])

    if (!this.finalized && request === this.hintRequest) {
      this.setState({ hints, refIds }, () => this.prefillTextFields())
      this.prefillSequenceFields(hints)
    }

    return hints
  }

  // Fill sequence fields with their hint's ID, so a logger can edit part of
  // it. Fields the logger has changed are left alone.
  prefillSequenceFields(hints) {
    Object.entries(hints).forEach(([index, hint]) => {
      const current = this.props.formValues ? this.props.formValues[`option_${index}`] : undefined
      if (current && current !== this.prefilled[index]) {
        return
      }

      const id = hint.id || ''
      if (id !== (current || '')) {
        this.props.change(`event_options.option_${index}`, id)
      }
      this.prefilled[index] = id
    })
  }

  // A typed sequence ID that skips numbers, not yet confirmed: { index, value, skipped }
  async findJump(raw_event_options) {
    const { eventTemplate } = this.props
    const typed = eventTemplate.event_options
      .map((option, index) => ({ option, index, value: raw_event_options[`option_${index}`] }))
      .filter(({ option, value }) => option.event_option_type === 'sequence' && value)

    if (!typed.length) {
      return null
    }

    // Fresh previews: others may have logged since the dialog opened
    const hints = await this.fetchHints()
    for (const { index, value } of typed) {
      const hint = hints[index]
      // Only an ID taken new can skip numbers; reused ones are any earlier ID
      const n = hint && !hint.error && hint.mode === 'next' ? typedNumber(value, hint) : null
      if (n !== null && n > hint.n && this.state.confirmed[index] !== value) {
        const skipped = n - 1 === hint.n ? idWithNumber(hint.n, hint) : `${idWithNumber(hint.n, hint)} to ${idWithNumber(n - 1, hint)}`
        return { index, value, skipped }
      }
    }

    return null
  }

  handleConfirmJump() {
    const { index, value } = this.state.jump
    this.setState(
      (state) => ({ jump: null, confirmed: { ...state.confirmed, [index]: value } }),
      () => this.props.handleSubmit(this.handleFormSubmit.bind(this))()
    )
  }

  componentWillUnmount() {
    // if the modal unmounts (e.g. the user navigates away) without the
    // event being explicitly submitted or canceled, delete the
    // optimistically-created event so it isn't orphaned in the database
    if (this.props.event && !this.finalized) {
      this.finalized = true
      // abort/revert any in-flight or just-completed uploads so they don't
      // land (or persist) after the event they're attached to is deleted
      this.pond?.removeFiles()
      this.props.handleDeleteEvent(this.props.event.id)
    }
  }

  async populateDefaultValues() {
    const ts = this.props.event ? moment.utc(this.props.event.ts) : moment.utc()
    let event_options = {}

    this.props.eventTemplate.event_options.forEach((option, index) => {
      // Filled in once the IDs are fetched (see prefillTextFields)
      if (hasPlaceholders(option)) {
        return
      }

      if (option.event_option_default_value && option.event_option_type !== 'checkboxes') {
        event_options[`option_${index}`] = option.event_option_default_value
      } else if (option.event_option_default_value && option.event_option_type === 'checkboxes') {
        event_options[`option_${index}`] = option.event_option_default_value.split(',').map((item) => item.trim())
      }
    })
    this.props.initialize({ id: this.state.event_id, ts, event_options })
  }

  async handleFormSubmit(values) {
    // A copy: the dialog can stay open after a failed submit, so the form's
    // own values must survive for the next try
    const formProps = { ...values }
    formProps.event_free_text = formProps.event_free_text ? formProps.event_free_text : ''

    if (formProps.ts) {
      if (moment.isMoment(formProps.ts)) {
        formProps.ts = formProps.ts.toISOString()
      } else if (typeof formProps.ts === 'string') {
        const validMoment = moment(formProps.ts, moment.ISO_8601, true)
        if (validMoment.isValid()) {
          formProps.ts = validMoment.toISOString()
        }
      } else {
        formProps.ts = null
      }
    }

    let raw_event_options = JSON.parse(JSON.stringify(formProps.event_options))

    // Untouched pre-filled IDs are sent blank, so the server assigns the ID
    // (atomically: another logger may have taken the one shown)
    Object.entries(this.prefilled).forEach(([index, id]) => {
      if (id && raw_event_options[`option_${index}`] === id) {
        raw_event_options[`option_${index}`] = ''
      }
    })

    // Likewise, untouched text with placeholders is sent as the template's
    // default, so the server fills it in for the event as saved: with the IDs
    // it's given, and also when the dialog couldn't (e.g. a hidden cruise)
    Object.entries(this.prefilledText).forEach(([index, value]) => {
      if (raw_event_options[`option_${index}`] === value) {
        raw_event_options[`option_${index}`] = this.props.eventTemplate.event_options[index].event_option_default_value
      }
    })

    this.setState({ submitError: null })
    const jump = await this.findJump(raw_event_options)
    if (jump) {
      this.setState({ jump })
      return
    }

    //Convert objects to arrays, leaving out empty fields
    const filled = Object.keys(raw_event_options)
      .sort()
      .filter((key) => raw_event_options[key] !== '')
    const optionIndex = filled.map((key) => parseInt(key.split('_')[1]))
    const optionValue = filled.map((key) => raw_event_options[key])

    //Build event_options array
    formProps.event_options = optionIndex.map((value, index) => {
      if (Array.isArray(optionValue[index])) {
        optionValue[index] = optionValue[index].join(';')
      }

      return {
        event_option_name: this.props.eventTemplate.event_options[value].event_option_name,
        event_option_value: optionValue[index]
      }
    })

    const fileMap = new Map(
      this.pond
        .getFiles()
        .filter((file) => file.serverId)
        .map((file) => [file.serverId, file.filename])
    )

    //Submit event
    if (this.props.event) {
      // Keep the dialog open on errors, e.g. a sequence ID already in use
      const result = await this.props.handleUpdateEvent(formProps)
      if (result && result.error) {
        this.setState({ submitError: result.error })
        return
      }

      if (fileMap.size) {
        await create_event_aux_data({
          event_id: this.props.event.id,
          data_source: 'eventFileAttachments',
          data_array: [...fileMap.entries()].flatMap(([serverId, originalName]) => [
            { data_name: 'source', data_value: originalName },
            { data_name: 'filename', data_value: serverId }
          ])
        })
      }
    }
    this.finalized = true
    this.props.handleHide()
  }

  handleFormHide() {
    if (this.props.event) {
      this.finalized = true
      // abort/revert any in-flight or just-completed uploads so they don't
      // land (or persist) after the event they're attached to is deleted
      this.pond?.removeFiles()
      this.props.handleDeleteEvent(this.props.event.id)
    }
    this.props.handleHide()
  }

  renderEventOptions() {
    const { eventTemplate, formValues } = this.props
    const { event_options } = eventTemplate

    return event_options.map((option, index) => {
      let visible = true

      if (option.event_option_visibility) {
        const { show_hide, event_option_name, event_option_values } = option.event_option_visibility

        const controllingIndex = event_options.findIndex((o) => o.event_option_name === event_option_name)

        if (controllingIndex !== -1) {
          const controllingField = `option_${controllingIndex}`
          const controllingValue = formValues?.[controllingField]

          const matches = Array.isArray(controllingValue)
            ? controllingValue.some((v) => event_option_values.includes(v))
            : event_option_values.includes(controllingValue)

          visible = show_hide === 'show if' ? matches : !matches
        }
      }

      if (!visible) {
        const fieldName = `event_options.option_${index}`
        if (formValues?.[`option_${index}`] !== undefined) {
          this.props.change(fieldName, undefined)
        }
        return null
      }

      // ✅ render normally
      if (option.event_option_type === 'dropdown') {
        return (
          <div key={`event_options.option_${index}`}>
            <Field
              name={`event_options.option_${index}`}
              component={renderSelectField}
              label={option.event_option_name}
              required={option.event_option_required}
              validate={option.event_option_required ? required : undefined}
              options={option.event_option_values}
            />
          </div>
        )
      }

      if (option.event_option_type === 'checkboxes') {
        const optionList = option.event_option_values.map((v) => ({ value: v, label: v }))
        return (
          <div key={`event_options.option_${index}`}>
            <Field
              name={`event_options.option_${index}`}
              component={renderCheckboxGroup}
              label={option.event_option_name}
              options={optionList}
              inline
              required={option.event_option_required}
              validate={option.event_option_required ? requiredArray : undefined}
            />
          </div>
        )
      }

      if (option.event_option_type === 'radio buttons') {
        const optionList = option.event_option_values.map((v) => ({ value: v, label: v }))
        return (
          <div key={`event_options.option_${index}`}>
            <Field
              name={`event_options.option_${index}`}
              component={renderRadioGroup}
              label={option.event_option_name}
              options={optionList}
              inline
              required={option.event_option_required}
              validate={option.event_option_required ? requiredArray : undefined}
            />
          </div>
        )
      }

      if (hasPlaceholders(option)) {
        const { value, missing } = this.resolveText(option.event_option_default_value)
        // A missing ID of the template's own sequence field is explained there
        const error = missing && this.state.refIds[missing] && this.state.refIds[missing].error
        const missingName = missing === 'cruise_id' ? 'cruise ID' : missing && `${missing.slice(4)} ID`
        return (
          <div key={`event_options.option_${index}`}>
            <Field
              name={`event_options.option_${index}`}
              component={renderTextField}
              label={option.event_option_name}
              required={option.event_option_required}
              validate={option.event_option_required ? required : undefined}
              className='pb-0'
            />
            <Form.Text className='d-block pb-2 text-muted'>
              {value &&
                `Filled in with ${describePlaceholders(option.event_option_default_value)} when you submit. Edit it to use other text.`}
              {error && `No ${missingName} to fill in (${error}): type the text instead.`}
            </Form.Text>
          </div>
        )
      }

      if (option.event_option_type === 'text') {
        return (
          <div key={`event_options.option_${index}`}>
            <Field
              name={`event_options.option_${index}`}
              component={renderTextField}
              label={option.event_option_name}
              required={option.event_option_required}
              validate={option.event_option_required ? required : undefined}
            />
          </div>
        )
      }

      if (option.event_option_type === 'static text') {
        // Nothing to show when no value by condition applies and it has none of its own
        if ((option.event_option_static_values || []).length && !(formValues && formValues[`option_${index}`])) {
          return null
        }

        // A value with placeholders is shown filled in; it's sent as is and
        // the server fills it in on save
        const raw = (formValues && formValues[`option_${index}`]) || ''
        if (option.event_option_vocab || !placeholders(raw).length) {
          return (
            <div key={`event_options.option_${index}`}>
              <Field name={`event_options.option_${index}`} component={renderStaticTextField} label={option.event_option_name} />
            </div>
          )
        }

        const { value, missing } = this.resolveText(raw)
        // A missing ID of the template's own sequence field is explained there
        const error = missing && this.state.refIds[missing] && this.state.refIds[missing].error
        const missingName = missing === 'cruise_id' ? 'cruise ID' : missing && `${missing.slice(4)} ID`
        return (
          <div key={`event_options.option_${index}`}>
            <Field
              name={`event_options.option_${index}`}
              component={renderStaticTextField}
              label={option.event_option_name}
              format={() => value || ''}
            />
            <Form.Text className={`d-block pb-2 ${error ? 'text-danger' : 'text-muted'}`}>
              {value && `Filled in with ${describePlaceholders(raw)} when you submit.`}
              {error && `No ${missingName} to fill in (${error}), so ${option.event_option_name} will be left out.`}
            </Form.Text>
          </div>
        )
      }

      if (option.event_option_type === 'sequence') {
        const hint = this.state.hints[index]
        // Name the sequence when the option picks it by condition
        const from =
          hint && hint.sequence && option.event_option_sequences && option.event_option_sequences.length ? `${hint.sequence} ` : ''
        return (
          <div key={`event_options.option_${index}`}>
            <Field
              name={`event_options.option_${index}`}
              component={renderTextField}
              label={option.event_option_name}
              placeholder={hint && hint.id ? hint.id : ''}
              className='pb-0'
            />
            <Form.Text className={`d-block pb-2 ${hint && hint.error ? 'text-danger' : 'text-muted'}`}>
              {hint &&
                hint.id &&
                (hint.mode === 'current'
                  ? `Current ${from}ID: ${hint.id}, reused from the earlier events. Edit it to use another ID.`
                  : `Next ${from}ID: ${hint.id}, assigned when you submit (it may differ if someone logs first). Edit it to use another ID.`)}
              {hint && hint.none && "No ID: none of this option's sequences apply to the values picked."}
              {hint && hint.error}
              {hint && hint.error && hint.mode === 'current' && `. Pick ${describeConditions(option)} to take a new one.`}
            </Form.Text>
          </div>
        )
      }

      return null
    })
  }

  render() {
    const { show, handleSubmit, eventTemplate, submitting, valid } = this.props

    if (eventTemplate) {
      return (
        <Modal size='md' show={show} onHide={this.handleFormHide}>
          <form onSubmit={handleSubmit(this.handleFormSubmit.bind(this))}>
            <Modal.Header className='bg-light' closeButton>
              <Modal.Title>{eventTemplate.event_value}</Modal.Title>
            </Modal.Header>

            <Modal.Body>
              {this.renderEventOptions()}
              {this.state.jump && (
                <Alert variant='warning' className='py-2'>
                  {this.state.jump.value} skips {this.state.jump.skipped}, which won&apos;t be assigned automatically.{' '}
                  <Button size='sm' variant='outline-dark' onClick={() => this.handleConfirmJump()}>
                    Use it anyway
                  </Button>
                </Alert>
              )}
              {this.state.submitError && (
                <Alert variant='danger' className='py-2'>
                  {this.state.submitError}
                </Alert>
              )}
              <Field
                name='event_free_text'
                component={renderTextArea}
                label='Additional Text'
                required={eventTemplate.event_free_text_required}
                validate={eventTemplate.event_free_text_required ? required : undefined}
                rows={2}
              />
              Attachments
              <FilePond
                ref={(ref) => (this.pond = ref)}
                allowMultiple={true}
                maxFiles={5}
                acceptedFileTypes={['image/png', 'image/jpeg']}
                server={{
                  url: API_ROOT_URL,
                  process: this.props.event
                    ? {
                        url: IMAGE_ROUTE + '/filepond/process/' + this.props.event.id,
                        ...authorizationHeader()
                      }
                    : null,
                  revert: {
                    url: IMAGE_ROUTE + '/filepond/revert',
                    ...authorizationHeader()
                  }
                }}
                disabled={!this.props.event}
              ></FilePond>
              <Field name='ts' label='Custom Time (UTC)' component={renderDateTimePicker} disabled={this.props.disabled} required={true} />
            </Modal.Body>
            <Modal.Footer>
              <span className='float-end'>
                <Button className='me-1' size='sm' variant='secondary' disabled={submitting} onClick={this.handleFormHide}>
                  Cancel
                </Button>
                {this.props.event ? (
                  <Button size='sm' variant='primary' type='submit' disabled={submitting || !valid}>
                    Submit
                  </Button>
                ) : null}
              </span>
            </Modal.Footer>
          </form>
        </Modal>
      )
    } else {
      return null
    }
  }
}

EventTemplateOptionsModal.propTypes = {
  disabled: PropTypes.bool,
  event: PropTypes.object,
  eventTemplate: PropTypes.object,
  formValues: PropTypes.object,
  initialize: PropTypes.func.isRequired,
  handleDeleteEvent: PropTypes.func,
  handleHide: PropTypes.func.isRequired,
  handleSubmit: PropTypes.func.isRequired,
  handleUpdateEvent: PropTypes.func,
  change: PropTypes.func.isRequired,
  show: PropTypes.bool.isRequired,
  submitting: PropTypes.bool.isRequired,
  // The form's Custom Time: a moment or an ISO string
  ts: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
  valid: PropTypes.bool.isRequired
}

const validate = (formProps) => {
  const errors = {}

  if (formProps.ts === '') {
    errors.ts = 'Required'
  }

  if (formProps.ts !== '' && !moment.utc(formProps.ts).isValid()) {
    errors.ts = 'Invalid timestamp'
  }

  return errors
}

const mapStateToProps = (state) => {
  const formState = state.form.eventTemplateOptionsModal?.values || {}
  const eo = formState.event_options

  // Normalize event_options to always be an object like:
  // { option_0: value, option_1: value, ... }
  let formValues = {}

  if (Array.isArray(eo)) {
    // Convert array → object
    eo.forEach((v, i) => {
      formValues[`option_${i}`] = v
    })
  } else if (eo && typeof eo === 'object') {
    // Already an object → use as-is
    formValues = eo
  } else {
    // undefined/null → empty object
    formValues = {}
  }

  return {
    formValues,
    ts: formState.ts
  }
}

export default compose(
  connectModal({ name: 'eventOptions' }),
  reduxForm({
    form: 'eventTemplateOptionsModal',
    validate
  }),
  connect(mapStateToProps)
)(EventTemplateOptionsModal)
