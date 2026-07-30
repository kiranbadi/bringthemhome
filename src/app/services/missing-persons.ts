import { Injectable } from '@angular/core';

import {
  MissingPerson,
  MissingPersonPage,
  MissingPersonSearchCriteria,
} from '../models/missing-person';

const MISSING_PERSONS: readonly MissingPerson[] = [
  {
    id: 1,
    fullName: 'Ava Johnson',
    zipcode: '10001',
    city: 'New York',
    state: 'New York',
    lastSeenDate: 'Jan 14, 2026',
    photos: [
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=720&q=80',
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=720&q=80',
    ],
  },
  {
    id: 2,
    fullName: 'Marcus Lee',
    zipcode: '60611',
    city: 'Chicago',
    state: 'Illinois',
    lastSeenDate: 'Feb 02, 2026',
    photos: [
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=720&q=80',
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=720&q=80',
    ],
  },
  {
    id: 3,
    fullName: 'Sofia Martinez',
    zipcode: '78701',
    city: 'Austin',
    state: 'Texas',
    lastSeenDate: 'Mar 19, 2026',
    photos: [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=720&q=80',
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=720&q=80',
    ],
  },
  {
    id: 4,
    fullName: 'Ethan Carter',
    zipcode: '98101',
    city: 'Seattle',
    state: 'Washington',
    lastSeenDate: 'Apr 08, 2026',
    photos: [
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=720&q=80',
      'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?auto=format&fit=crop&w=720&q=80',
    ],
  },
  {
    id: 5,
    fullName: 'Mia Thompson',
    zipcode: '33131',
    city: 'Miami',
    state: 'Florida',
    lastSeenDate: 'May 27, 2026',
    photos: [
      'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=720&q=80',
      'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=720&q=80',
    ],
  },
  {
    id: 6,
    fullName: 'Noah Williams',
    zipcode: '80202',
    city: 'Denver',
    state: 'Colorado',
    lastSeenDate: 'Jun 11, 2026',
    photos: [
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=720&q=80',
      'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=720&q=80',
    ],
  },
  {
    id: 7,
    fullName: 'Lena Patel',
    zipcode: '94105',
    city: 'San Francisco',
    state: 'California',
    lastSeenDate: 'Jun 29, 2026',
    photos: [
      'https://images.unsplash.com/photo-1524250502761-1ac6f2e30d43?auto=format&fit=crop&w=720&q=80',
      'https://images.unsplash.com/photo-1512316609839-ce289d3eba0a?auto=format&fit=crop&w=720&q=80',
    ],
  },
  {
    id: 8,
    fullName: 'Oliver Brown',
    zipcode: '02108',
    city: 'Boston',
    state: 'Massachusetts',
    lastSeenDate: 'Jul 05, 2026',
    photos: [
      'https://images.unsplash.com/photo-1504257432389-52343af06ae3?auto=format&fit=crop&w=720&q=80',
      'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=720&q=80',
    ],
  },
  {
    id: 9,
    fullName: 'Grace Nguyen',
    zipcode: '97205',
    city: 'Portland',
    state: 'Oregon',
    lastSeenDate: 'Jul 12, 2026',
    photos: [
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=720&q=80',
      'https://images.unsplash.com/photo-1517365830460-955ce3ccd263?auto=format&fit=crop&w=720&q=80',
    ],
  },
  {
    id: 10,
    fullName: 'Daniel Kim',
    zipcode: '30303',
    city: 'Atlanta',
    state: 'Georgia',
    lastSeenDate: 'Jul 16, 2026',
    photos: [
      'https://images.unsplash.com/photo-1507591064344-4c6ce005b128?auto=format&fit=crop&w=720&q=80',
      'https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=720&q=80',
    ],
  },
  {
    id: 11,
    fullName: 'Isabella Garcia',
    zipcode: '85004',
    city: 'Phoenix',
    state: 'Arizona',
    lastSeenDate: 'Jul 20, 2026',
    photos: [
      'https://images.unsplash.com/photo-1499952127939-9bbf5af6c51c?auto=format&fit=crop&w=720&q=80',
      'https://images.unsplash.com/photo-1509967419530-da38b4704bc6?auto=format&fit=crop&w=720&q=80',
    ],
  },
  {
    id: 12,
    fullName: 'James Wilson',
    zipcode: '20001',
    city: 'Washington',
    state: 'District of Columbia',
    lastSeenDate: 'Jul 23, 2026',
    photos: [
      'https://images.unsplash.com/photo-1508341591423-4347099e1f19?auto=format&fit=crop&w=720&q=80',
      'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=720&q=80',
    ],
  },
];

@Injectable({ providedIn: 'root' })
export class MissingPersonsService {
  search(
    criteria: MissingPersonSearchCriteria,
    pageIndex: number,
    pageSize: number,
  ): MissingPersonPage {
    const filtered = MISSING_PERSONS.filter((person) => {
      return (
        this.matchesText(person.fullName, criteria.fullName) &&
        this.matchesText(person.zipcode, criteria.zipcode) &&
        this.matchesText(person.city, criteria.city) &&
        this.matchesText(person.state, criteria.state)
      );
    });

    const startIndex = pageIndex * pageSize;

    return {
      items: filtered.slice(startIndex, startIndex + pageSize),
      total: filtered.length,
    };
  }

  private matchesText(value: string, criteria: string): boolean {
    return criteria.length === 0 || value.toLowerCase().includes(criteria.toLowerCase());
  }
}
