import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { getImageUrl, handleMissingImage } from '../utils';
import { Card, Col, Image } from 'react-bootstrap';

class ImageryCard extends Component {

  render() {
    return (
      <Col className="px-1 pb-2" key={this.props.source} sm={6} md={6} lg={4}>
        <Card  className="event-image-data-card" id={ `image_${this.props.source}` }>
          <Image fluid onError={ handleMissingImage } src={ this.props.filepath } onClick={ this.props.onClick || null } />
          <span>{ this.props.source }</span>
        </Card>
      </Col>
    );
  }
}

ImageryCard.propTypes = {
  source: PropTypes.string.isRequired,
  filepath: PropTypes.string.isRequired,
  onClick: PropTypes.func
}


class ImageryCards extends Component {

  render() {
    let imageryCards = []
    this.props.framegrab_data_sources.forEach((framegrab_data_source) => {
      for (let j = 0; j < framegrab_data_source.data_array.length; j+=2) {
        const source = framegrab_data_source.data_array[j].data_value
        const filepath = framegrab_data_source.data_array[j+1].data_value
        imageryCards.push(
          <ImageryCard
            source={source}
            filepath={getImageUrl(filepath)}
            onClick={ () => this.props.onClick(source, filepath) }
            key={`${framegrab_data_source.data_source}_${j}_col`}
          />
        )
      }
    })

    return imageryCards
  }
}

ImageryCards.propTypes = {
  framegrab_data_sources: PropTypes.array.isRequired,
  onClick: PropTypes.func
}

export default ImageryCards;
