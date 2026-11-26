// Shared by the vocabulary pages and the template editor's vocabulary options

// Who can manage vocabularies (and see their pages)
export const VOCABULARY_EDIT_ROLES = ['admin', 'cruise_manager', 'template_manager']

// Term queries that include hidden and deprecated terms
export const ALL_TERMS = { include_hidden: true, include_deprecated: true }

// Device catalogues (and local equipment lists) are grouped by their L05
// device category
export const hasCategories = (vocabulary) => vocabulary.collection === 'L22' || vocabulary.source === 'local'
