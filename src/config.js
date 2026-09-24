// Names shown around the site. Change them here.
export const SITE_NAME = 'MMS Question Bank'
export const SITE_TAGLINE = 'Revise by topic, practise practicals, learn from near-peer teachers.'
export const SHORT_NAME = 'MMS'

// Roles, lowest to highest. The database enforces what each can do.
export const ROLES = [
  { value: 'student', label: 'Student', help: 'Practise questions, read announcements, rate their own confidence per topic.' },
  { value: 'teacher', label: 'Student teacher', help: 'Also: write questions (reviewed before going live), make teaching slides, log teaching.' },
  { value: 'lead', label: 'Academic lead', help: 'Also: review and publish questions, post announcements.' },
  { value: 'admin', label: 'Committee admin', help: 'Also: change the structure, roles, sign-up rules and run imports.' },
]
