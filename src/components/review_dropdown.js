import React, { Component } from 'react'
import { Dropdown, OverlayTrigger, Tooltip } from 'react-bootstrap'
import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import * as mapDispatchToProps from '../actions'

class ReviewDropdown extends Component {
  constructor(props) {
    super(props)

    this.state = {
      id: this.props.id ? this.props.id : 'dropdown-review'
    }
  }

  render() {
    const { cruiseID } = this.props
    const reviewTooltip = <Tooltip id='reviewTooltip'>Review this cruise</Tooltip>
    const className = this.props.className ? 'p-0 ' + this.props.className : 'p-0'

    if (cruiseID) {
      return (
        <Dropdown as={'span'} id={this.state.id}>
          <Dropdown.Toggle
            className={className}
            style={{ fontSize: '.95rem', textDecoration: 'none', position: 'relative', bottom: '2px' }}
            variant='link'
            disabled={this.props.disabled}
          >
            <OverlayTrigger placement='top' overlay={reviewTooltip}>
              <span>{this.props.activeMode || 'Review'}</span>
            </OverlayTrigger>
          </Dropdown.Toggle>
          <Dropdown.Menu>
            {this.props.activeMode !== 'Replay' ? (
              <Dropdown.Item key='replay' onClick={() => this.props.gotoReviewReplay(this.props.cruiseID)}>
                Replay View
              </Dropdown.Item>
            ) : null}
            {this.props.activeMode ? null : <Dropdown.Divider />}
            {this.props.activeMode !== 'Map' ? (
              <Dropdown.Item key='map' onClick={() => this.props.gotoReviewMap(this.props.cruiseID)}>
                Map View
              </Dropdown.Item>
            ) : null}
          </Dropdown.Menu>
        </Dropdown>
      )
    }
    return null
  }
}

ReviewDropdown.propTypes = {
  activeMode: PropTypes.string,
  className: PropTypes.string,
  cruiseID: PropTypes.string,
  disabled: PropTypes.bool,
  gotoReviewMap: PropTypes.func.isRequired,
  gotoReviewReplay: PropTypes.func.isRequired,
  id: PropTypes.string
}

export default connect(null, mapDispatchToProps)(ReviewDropdown)
