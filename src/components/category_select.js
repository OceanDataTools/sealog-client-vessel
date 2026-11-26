import React from 'react'
import PropTypes from 'prop-types'
import { Form } from 'react-bootstrap'

// A filter by L05 device category: categories are L05 terms
const CategorySelect = ({ categories, value, onChange }) => (
  <Form.Select size='sm' value={value} onChange={(e) => onChange(e.target.value)}>
    <option value=''>All categories (L05)</option>
    {categories.map((item) => (
      <option key={item.notation} value={item.notation}>
        {item.prefLabel} ({item.id})
      </option>
    ))}
  </Form.Select>
)

CategorySelect.propTypes = {
  categories: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
  value: PropTypes.string.isRequired
}

export default CategorySelect
