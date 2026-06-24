import meetingNotesJa from './meeting-notes.ja';
import invoiceEn from './invoice.en';
import academicPaperEn from './academic-paper.en';
import mathCategoryTheoryJa from './math-category-theory.ja';
import bookmarkDoiUri from './bookmark-doi-uri';
import sourceCodeTs from './source-code.ts';

export const SUMMARY_FIXTURES = [
  { id: 'meeting-notes', label: 'Meeting Notes (EN)', content: meetingNotesJa },
  { id: 'invoice', label: 'Invoice (EN)', content: invoiceEn },
  { id: 'academic-paper', label: 'Academic Paper (EN)', content: academicPaperEn },
  { id: 'math-category-theory', label: 'Math/Category Theory (JA)', content: mathCategoryTheoryJa },
  { id: 'bookmark-doi', label: 'Bookmark / DOI', content: bookmarkDoiUri },
  { id: 'source-code', label: 'Source Code (TypeScript)', content: sourceCodeTs },
];
