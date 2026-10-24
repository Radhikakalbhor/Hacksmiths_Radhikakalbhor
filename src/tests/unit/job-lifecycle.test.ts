/**
 * Automated Unit Tests: Job State Machine Lifecycle
 * Tests strictly governed transition states for job milestones.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canTransitionJob } from '@/types/jobs';
import { JobsService } from '@/lib/services/jobs.service';

describe('Job Lifecycle State Machine', () => {
  it('should allow valid sequential progression through all milestones', () => {
    // 1. DRAFT -> POSTED
    assert.equal(JobsService.validateTransition('DRAFT', 'POSTED'), true);
    // 2. POSTED -> BIDDING_OPEN
    assert.equal(JobsService.validateTransition('POSTED', 'BIDDING_OPEN'), true);
    // 3. BIDDING_OPEN -> ASSIGNED
    assert.equal(JobsService.validateTransition('BIDDING_OPEN', 'ASSIGNED'), true);
    // 4. ASSIGNED -> OTP_START_VERIFIED
    assert.equal(JobsService.validateTransition('ASSIGNED', 'OTP_START_VERIFIED'), true);
    // 5. OTP_START_VERIFIED -> IN_PROGRESS
    assert.equal(JobsService.validateTransition('OTP_START_VERIFIED', 'IN_PROGRESS'), true);
    // 6. IN_PROGRESS -> OTP_COMPLETION_VERIFIED
    assert.equal(JobsService.validateTransition('IN_PROGRESS', 'OTP_COMPLETION_VERIFIED'), true);
    // 7. OTP_COMPLETION_VERIFIED -> COMPLETED
    assert.equal(JobsService.validateTransition('OTP_COMPLETION_VERIFIED', 'COMPLETED'), true);
  });

  it('should allow cancellation from open states', () => {
    assert.equal(canTransitionJob('DRAFT', 'CANCELLED'), true);
    assert.equal(canTransitionJob('POSTED', 'CANCELLED'), true);
    assert.equal(canTransitionJob('BIDDING_OPEN', 'CANCELLED'), true);
    assert.equal(canTransitionJob('ASSIGNED', 'CANCELLED'), true);
  });

  it('should block premature or illegal jumps in state', () => {
    // Cannot jump from POSTED directly to COMPLETED
    assert.equal(canTransitionJob('POSTED', 'COMPLETED'), false);
    // Cannot jump from BIDDING_OPEN to IN_PROGRESS without assignment
    assert.equal(canTransitionJob('BIDDING_OPEN', 'IN_PROGRESS'), false);
    // Terminal state COMPLETED cannot transition to anything
    assert.equal(canTransitionJob('COMPLETED', 'IN_PROGRESS'), false);
    assert.equal(canTransitionJob('COMPLETED', 'POSTED'), false);
    // Cancelled job cannot be assigned
    assert.equal(canTransitionJob('CANCELLED', 'ASSIGNED'), false);
  });

  it('should allow escalation to DISPUTED only when active', () => {
    assert.equal(canTransitionJob('ASSIGNED', 'DISPUTED'), true);
    assert.equal(canTransitionJob('IN_PROGRESS', 'DISPUTED'), true);
    assert.equal(canTransitionJob('DRAFT', 'DISPUTED'), false);
  });
});
