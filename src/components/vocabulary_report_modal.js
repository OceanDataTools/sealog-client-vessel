import React, { Component } from 'react'
import { compose } from 'redux'
import { connect } from 'react-redux'
import { connectModal } from 'redux-modal'
import PropTypes from 'prop-types'
import { Button, Modal, Table } from 'react-bootstrap'
import * as mapDispatchToProps from '../actions'

// What a refresh, import or URL pull changed, one section per vocabulary
class VocabularyReportModal extends Component {
  handleTemplateSelect(id) {
    this.props.initEventTemplate(id)
    this.props.gotoEventTemplates()
    this.props.handleHide()
  }

  renderNotations(label, notations, note) {
    if (!notations.length) {
      return (
        <div>
          {label}: 0{note && <span className='text-muted'> ({note})</span>}
        </div>
      )
    }

    return (
      <details>
        <summary>
          {label}: {notations.length}
          {note && <span className='text-muted'> ({note})</span>}
        </summary>
        <small className='d-block ps-3' style={{ maxHeight: '10em', overflowY: 'auto' }}>
          {notations.join(', ')}
        </small>
      </details>
    )
  }

  renderAffectedTemplates(report) {
    if (!report.affected_templates.length) {
      return null
    }

    return (
      <React.Fragment>
        <div className='mt-2'>Event templates using deprecated or removed terms:</div>
        <Table size='sm' bordered className='mt-1 mb-0'>
          <thead>
            <tr>
              <th>Template</th>
              <th>Option</th>
              <th>Value</th>
              <th>Status</th>
              <th>Replacement</th>
            </tr>
          </thead>
          <tbody>
            {report.affected_templates.map((item, index) => (
              <tr key={`${item.template_id}_${index}`}>
                <td>
                  <Button variant='link' size='sm' className='p-0' onClick={() => this.handleTemplateSelect(item.template_id)}>
                    {item.event_name}
                  </Button>
                </td>
                <td>{item.event_option_name}</td>
                <td title={item.notation}>{item.value}</td>
                <td>{item.status}</td>
                <td>{item.replaced_by.join(', ') || '-'}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </React.Fragment>
    )
  }

  renderReport(report) {
    let version = report.version ? `v${report.version}` : ''
    if (report.previous_version && report.previous_version !== report.version) {
      version = `v${report.previous_version} → ${version}`
    }

    return (
      <div key={report.collection} className='mb-3'>
        <h6>
          {report.collection} <small className='text-muted'>{version}</small>
          <small className='text-muted float-end'>{report.term_count} terms</small>
        </h6>
        {this.renderNotations('Added', report.added)}
        {this.renderNotations('Newly deprecated', report.deprecated)}
        {this.renderNotations('Removed', report.removed)}
        {this.renderNotations('Kept as deprecated', report.retained, 'no longer in the source, but recorded on events')}
        {this.renderAffectedTemplates(report)}
      </div>
    )
  }

  render() {
    // redux-modal drops the props while the modal animates closed
    const { show, handleHide, reports = [], title } = this.props

    return (
      <Modal size='lg' show={show} onHide={handleHide}>
        <Modal.Header className='bg-light' closeButton>
          <Modal.Title>{title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>{reports.map((report) => this.renderReport(report))}</Modal.Body>
        <Modal.Footer>
          <Button size='sm' variant='secondary' onClick={handleHide}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    )
  }
}

VocabularyReportModal.propTypes = {
  gotoEventTemplates: PropTypes.func.isRequired,
  handleHide: PropTypes.func.isRequired,
  initEventTemplate: PropTypes.func.isRequired,
  reports: PropTypes.array,
  show: PropTypes.bool.isRequired,
  title: PropTypes.string
}

export default compose(
  connectModal({ name: 'vocabularyReport', destroyOnHide: true }),
  connect(null, mapDispatchToProps)
)(VocabularyReportModal)
