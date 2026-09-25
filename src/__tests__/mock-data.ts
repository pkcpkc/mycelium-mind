import { EntityMetadata } from '../utils/overview-runner.js';

export function getMockTimelineGraph(): EntityMetadata[] {
  return [
    {
      name: 'Event One',
      type: 'Summary',
      timestamp: '2026-07-05T12:00:00Z',
      tags: ['tagA', 'tagB'],
      filePath: 'summaries/Event1.md',
      properties: {
        title: 'Event One',
        tags: ['tagA', 'tagB'],
        times: [
          {
            date: '2026-07-05',
            title: 'First Event Description'
          }
        ]
      }
    },
    {
      name: 'Event Two',
      type: 'Summary',
      timestamp: '2025-06-15T12:00:00Z',
      tags: ['tagC'],
      filePath: 'summaries/Event2.md',
      properties: {
        title: 'Event Two',
        tags: ['tagC'],
        times: [
          '2025-06-15: Second Event Description'
        ]
      }
    },
    {
      name: 'First Event Description',
      type: 'Concept',
      timestamp: '2025-06-15T12:00:00Z',
      tags: ['tagA'],
      filePath: 'collections/concept/Concept1.md',
      properties: {
        title: 'First Event Description'
      }
    }
  ];
}

export function getMockSocialGraph(): EntityMetadata[] {
  return [
    {
      name: 'General Summary',
      type: 'Summary',
      timestamp: '2026-07-05T12:00:00Z',
      tags: [],
      filePath: 'summaries/GeneralSummary.md',
      properties: {
        title: 'General Summary'
      }
    },
    {
      name: 'Alice Smith',
      type: 'Person',
      timestamp: '2026-07-05T12:00:00Z',
      tags: [],
      filePath: 'collections/persons/Alice Smith.md',
      properties: {
        title: 'Alice Smith',
        relationships: [
          {
            person: 'Bob Jones',
            relation: 'colleague of'
          }
        ]
      }
    },
    {
      name: 'Charlie Brown',
      type: 'Person',
      timestamp: '2026-07-05T12:00:00Z',
      tags: [],
      filePath: 'collections/persons/Charlie Brown.md',
      properties: {
        title: 'Charlie Brown',
        relationships: [
          {
            person: 'Alice Smith',
            relation: 'mentor of'
          }
        ]
      }
    },
    {
      name: 'Bob Jones',
      type: 'Person',
      timestamp: '2026-07-05T12:00:00Z',
      tags: [],
      filePath: 'collections/persons/Bob Jones.md',
      properties: {
        title: 'Bob Jones',
        relationships: [
          {
            person: 'Dana White',
            relation: 'advises'
          }
        ]
      }
    }
  ];
}

export function getMockConceptsCloudGraph(): EntityMetadata[] {
  return [
    {
      name: 'Deep Learning',
      type: 'Concept',
      timestamp: '2026-07-05T12:00:00Z',
      tags: ['ai', 'math'],
      filePath: 'collections/concept/DL.md',
      properties: {
        title: 'Deep Learning',
        tags: ['ai', 'math']
      }
    },
    {
      name: 'Machine Learning',
      type: 'Concept',
      timestamp: '2026-07-05T12:00:00Z',
      tags: ['ai', 'math', 'statistics'],
      filePath: 'collections/concept/ML.md',
      properties: {
        title: 'Machine Learning',
        tags: ['ai', 'math', 'statistics']
      }
    }
  ];
}
