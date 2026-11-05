/**
 * Automated Unit Tests: Service Date & Time Selection (Scheduling & Slots)
 * Tests Standard, Same Day, and Emergency urgency calculations,
 * strictly verifying individual selectable booking times (NO duration ranges).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getKolkataNow,
  getStandardDateOptions,
  getStandardTimeOptions,
  getSameDayTimeOptions,
  getEmergencyTimeOptions,
  formatScheduledDisplay,
} from '@/lib/utils/scheduling';
import { validateCreateJob } from '@/lib/validations/jobs';

describe('Service Date & Time Selection Utilities', () => {
  it('should correctly determine Asia/Kolkata current date and time', () => {
    const kolkata = getKolkataNow();
    assert.match(kolkata.dateStr, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(kolkata.dateString, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(kolkata.hours >= 0 && kolkata.hours <= 23);
    assert.ok(kolkata.minutes >= 0 && kolkata.minutes <= 59);
  });

  describe('Standard Urgency Selection', () => {
    it('should provide preferred service dates within the next 2-3 days (excluding today and past dates)', () => {
      const dates = getStandardDateOptions(3);
      assert.equal(dates.length, 3);

      const now = getKolkataNow();
      // Ensure none of the standard dates are today or past
      for (const d of dates) {
        assert.ok(d.dateStr > now.dateStr, `Date ${d.dateStr} should be in the future`);
        assert.ok(d.label.length > 0);
        assert.ok(d.sub.length > 0);
      }
    });

    it('should generate individual selectable booking times from 9:00 AM to 8:00 PM', () => {
      const standardTimes = getStandardTimeOptions();
      assert.ok(standardTimes.length >= 10);

      // Verify individual start times
      const expectedStarts = ['9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '4:00 PM', '7:00 PM', '8:00 PM'];
      for (const expected of expectedStarts) {
        const found = standardTimes.some((t) => t.value === expected || t.time === expected);
        assert.ok(found, `Expected individual time ${expected} to be in standard options`);
      }
    });

    it('RULE ENFORCEMENT: standard times must NEVER contain duration ranges (e.g. 4:00 PM – 5:00 PM)', () => {
      const standardTimes = getStandardTimeOptions();
      for (const t of standardTimes) {
        assert.doesNotMatch(t.value, /–|-/, `Time value "${t.value}" should not have a range separator`);
        assert.doesNotMatch(t.label, /–|-/, `Time label "${t.label}" should not have a range separator`);
      }
    });
  });

  describe('Same Day Urgency Selection', () => {
    it('should exclude past times and only show upcoming booking times (simulated 1:30 PM / 13:30 IST)', () => {
      // Simulate 1:30 PM IST (13:30)
      const simulatedDate = new Date('2026-11-05T08:00:00Z'); // 08:00 UTC = 13:30 IST
      const sameDayTimes = getSameDayTimeOptions(simulatedDate);

      // Times at or before 1:00 PM should be excluded
      const pastTimes = ['9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM'];
      for (const pt of pastTimes) {
        const found = sameDayTimes.some((t) => t.value === pt || t.time === pt);
        assert.equal(found, false, `Past time ${pt} should be excluded`);
      }

      // Times from 2:00 PM onward should be available
      const upcomingTimes = ['2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM'];
      for (const ut of upcomingTimes) {
        const found = sameDayTimes.some((t) => t.value === ut || t.time === ut);
        assert.ok(found, `Upcoming time ${ut} should be available`);
      }
    });

    it('RULE ENFORCEMENT: same day times must NEVER contain duration ranges', () => {
      const simulatedDate = new Date('2026-11-05T04:30:00Z'); // 10:00 AM IST
      const sameDayTimes = getSameDayTimeOptions(simulatedDate);

      for (const t of sameDayTimes) {
        assert.doesNotMatch(t.value, /–|-/, `Time value "${t.value}" should not have a range separator`);
        assert.doesNotMatch(t.label, /–|-/, `Time label "${t.label}" should not have a range separator`);
      }
    });
  });

  describe('Emergency Urgency Selection', () => {
    it('should prioritize earliest upcoming individual booking times within 1-2 hours', () => {
      // Simulate 2:15 PM IST (14:15)
      const simulatedDate = new Date('2026-11-05T08:45:00Z'); // 08:45 UTC = 14:15 IST
      const emergencyTimes = getEmergencyTimeOptions(simulatedDate);

      assert.ok(emergencyTimes.length > 0);
      // The earliest upcoming time should have priority flag
      assert.equal(emergencyTimes[0].isPriority, true);
      assert.ok(emergencyTimes[0].hint?.includes('mins') || emergencyTimes[0].hint?.includes('Earliest'));

      // The earliest time should be upcoming (e.g. 3:00 PM)
      assert.notEqual(emergencyTimes[0].value, '1:00 PM');
      assert.notEqual(emergencyTimes[0].value, '2:00 PM');
    });

    it('RULE ENFORCEMENT: emergency times must NEVER contain duration ranges', () => {
      const simulatedDate = new Date('2026-11-05T06:00:00Z'); // 11:30 AM IST
      const emergencyTimes = getEmergencyTimeOptions(simulatedDate);

      for (const t of emergencyTimes) {
        assert.doesNotMatch(t.value, /–|-/, `Emergency time "${t.value}" should not have a range separator`);
        assert.doesNotMatch(t.label, /–|-/, `Emergency label "${t.label}" should not have a range separator`);
      }
    });
  });

  describe('Scheduled Display Formatter', () => {
    it('should format valid date and individual time into clean human-readable schedule', () => {
      const formatted = formatScheduledDisplay('2026-11-06', '10:00 AM');
      assert.ok(formatted.includes('10:00 AM'));
      assert.ok(formatted.includes('Nov') || formatted.includes('November'));
    });

    it('should return fallback if date or time is missing', () => {
      assert.equal(formatScheduledDisplay(undefined, undefined), 'Not scheduled');
      assert.equal(formatScheduledDisplay(null, null), 'Not scheduled');
      const dateOnly = formatScheduledDisplay('2026-11-06', undefined);
      assert.ok(dateOnly.includes('Nov'));
    });
  });

  describe('Job Creation Validation Schema Integration', () => {
    it('should accept valid scheduledDate and scheduledTimeSlot in validateCreateJob', () => {
      const validInput = {
        category: 'electrical' as const,
        title: 'Ceiling fan making loud bearing noise',
        description: 'Need urgent inspection and bearing replacement',
        urgency: 'same_day' as const,
        scheduledDate: '2026-11-05',
        scheduledTimeSlot: '4:00 PM',
        latitude: 28.6139,
        longitude: 77.2090,
        addressLine: 'Flat 302, Green Valley Apartments',
        city: 'Delhi NCR',
        pincode: '110001',
        estimatedBudgetInr: 450,
      };

      const result = validateCreateJob(validInput);
      assert.equal(result.success, true);
      assert.equal(result.data?.scheduledDate, '2026-11-05');
      assert.equal(result.data?.scheduledTimeSlot, '4:00 PM');
    });
  });
});
