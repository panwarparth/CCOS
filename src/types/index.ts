import {
  Role,
  MilestoneState,
  PaymentModel,
  EvidenceStatus,
  EligibilityState,
  EligibilityEventType,
  BOQStatus,
  FollowUpType,
  FollowUpStatus,
} from '@prisma/client';

// Re-export enums for convenience
export {
  Role,
  MilestoneState,
  PaymentModel,
  EvidenceStatus,
  EligibilityState,
  EligibilityEventType,
  BOQStatus,
  FollowUpType,
  FollowUpStatus,
};

// API Response types
export interface ApiResponse<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================
// PAYMENT ELIGIBILITY TYPES
// ============================================
//
// GOVERNANCE RULE: These types define the canonical
// payment eligibility structure. All roles read the
// same data. Permissions only change available actions.
// ============================================

/**
 * Canonical Payment Eligibility Record
 * This is the SINGLE SOURCE OF TRUTH for payment state.
 * Read-only for frontend. Written only by recalculatePaymentEligibility().
 */
export interface PaymentEligibilityRecord {
  id: string;
  milestoneId: string;

  // Computed values (system-only)
  boqValueCompleted: number;
  deductions: number;
  eligibleAmount: number;
  blockedAmount: number;

  // State machine state
  state: EligibilityState;

  // Due date
  dueDate: Date | null;

  // Block info (when BLOCKED)
  blockReasonCode: string | null;
  blockExplanation: string | null;
  blockedAt: Date | null;
  blockedByActorId: string | null;

  // Paid info (when MARKED_PAID)
  markedPaidAt: Date | null;
  markedPaidByActorId: string | null;
  paidExplanation: string | null;

  // Audit
  lastCalculatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Derived payment indicator for UI display.
 * Computed from PaymentEligibilityRecord - NOT stored in DB.
 *
 * GOVERNANCE RULE: These indicators are derived deterministically
 * from the canonical state. All roles see the same indicators.
 */
export interface PaymentIndicator {
  // Core indicator
  indicator: 'ELIGIBLE_DUE' | 'ELIGIBLE_NOT_DUE' | 'BLOCKED' | 'OVERDUE' | 'NOT_DUE' | 'PAID';

  // Display values
  displayLabel: string;
  displayColor: 'green' | 'yellow' | 'red' | 'gray' | 'purple';

  // Amounts
  eligibleAmount: number;
  blockedAmount: number;

  // Urgency
  isUrgent: boolean;
  daysUntilDue: number | null;
  daysOverdue: number | null;
}

/**
 * State transition definition for the payment state machine.
 * GOVERNANCE RULE: Only these transitions are valid.
 */
export const ValidStateTransitions: Record<EligibilityState, EligibilityState[]> = {
  NOT_DUE: [
    EligibilityState.DUE_PENDING_VERIFICATION,
    EligibilityState.VERIFIED_NOT_ELIGIBLE,
    EligibilityState.PARTIALLY_ELIGIBLE,
    EligibilityState.FULLY_ELIGIBLE,
  ],
  DUE_PENDING_VERIFICATION: [
    EligibilityState.VERIFIED_NOT_ELIGIBLE,
    EligibilityState.PARTIALLY_ELIGIBLE,
    EligibilityState.FULLY_ELIGIBLE,
  ],
  VERIFIED_NOT_ELIGIBLE: [
    EligibilityState.PARTIALLY_ELIGIBLE,
    EligibilityState.FULLY_ELIGIBLE,
  ],
  PARTIALLY_ELIGIBLE: [
    EligibilityState.FULLY_ELIGIBLE,
    EligibilityState.BLOCKED,
    EligibilityState.MARKED_PAID,
  ],
  FULLY_ELIGIBLE: [
    EligibilityState.BLOCKED,
    EligibilityState.MARKED_PAID,
  ],
  BLOCKED: [
    EligibilityState.PARTIALLY_ELIGIBLE,
    EligibilityState.FULLY_ELIGIBLE,
  ],
  MARKED_PAID: [], // Terminal state - no transitions out
};

// ============================================
// DASHBOARD TYPES
// ============================================

export interface OwnerDashboard {
  totalVerifiedValue: number;
  totalUnpaidValue: number;
  advanceExposure: number;
  boqOverruns: number;
  highRiskVendors: VendorRisk[];
  blockedPaymentsSummary: BlockedSummary[];
  projectsOverview: ProjectOverview[];
}

export interface PMCDashboard {
  pendingReviews: PendingReview[];
  duePayments: DuePayment[];
  blockedItems: BlockedItem[];
  upcomingDeadlines: UpcomingDeadline[];
}

export interface VendorDashboard {
  submittedMilestones: SubmittedMilestone[];
  rejections: RejectionRecord[];
  pendingApprovals: PendingApproval[];
  paymentStatus: PaymentStatusRecord[];
}

export interface VendorRisk {
  vendorId: string;
  vendorName: string;
  advancePaid: number;
  verifiedWork: number;
  exposureRatio: number;
}

export interface BlockedSummary {
  projectId: string;
  projectName: string;
  blockedCount: number;
  blockedValue: number;
}

export interface ProjectOverview {
  projectId: string;
  projectName: string;
  verifiedValue: number;
  paidValue: number;
  pendingValue: number;
}

export interface PendingReview {
  evidenceId: string;
  milestoneTitle: string;
  projectName: string;
  submittedAt: Date;
  vendorName: string;
  daysPending: number;
}

export interface DuePayment {
  eligibilityId: string;
  milestoneId: string;
  milestoneTitle: string;
  projectName: string;
  amount: number;
  dueDate: Date;
  state: EligibilityState;
}

export interface BlockedItem {
  eligibilityId: string;
  milestoneId: string;
  milestoneTitle: string;
  projectName: string;
  amount: number;
  blockedSince: Date;
  reason: string;
}

export interface UpcomingDeadline {
  milestoneId: string;
  milestoneTitle: string;
  projectName: string;
  deadline: Date;
  daysRemaining: number;
}

export interface SubmittedMilestone {
  milestoneId: string;
  title: string;
  projectName: string;
  submittedAt: Date;
  status: MilestoneState;
}

export interface RejectionRecord {
  evidenceId: string;
  milestoneTitle: string;
  projectName: string;
  rejectedAt: Date;
  reason: string;
}

export interface PendingApproval {
  evidenceId: string;
  milestoneTitle: string;
  projectName: string;
  submittedAt: Date;
}

export interface PaymentStatusRecord {
  eligibilityId: string;
  milestoneId: string;
  milestoneTitle: string;
  projectName: string;
  amount: number;
  state: EligibilityState;
  indicator: PaymentIndicator;
}

// Audit log action types
export const AuditActionTypes = {
  // Project actions
  PROJECT_CREATE: 'PROJECT_CREATE',
  PROJECT_UPDATE: 'PROJECT_UPDATE',
  PROJECT_DELETE: 'PROJECT_DELETE',
  PROJECT_STATUS_CHANGE: 'PROJECT_STATUS_CHANGE',

  // Role actions
  ROLE_ASSIGN: 'ROLE_ASSIGN',
  ROLE_REMOVE: 'ROLE_REMOVE',

  // BOQ actions
  BOQ_CREATE: 'BOQ_CREATE',
  BOQ_APPROVE: 'BOQ_APPROVE',
  BOQ_REVISE: 'BOQ_REVISE',
  BOQ_ITEM_ADD: 'BOQ_ITEM_ADD',
  BOQ_ITEM_UPDATE: 'BOQ_ITEM_UPDATE',
  BOQ_ITEM_REMOVE: 'BOQ_ITEM_REMOVE',

  // Milestone actions
  MILESTONE_CREATE: 'MILESTONE_CREATE',
  MILESTONE_UPDATE: 'MILESTONE_UPDATE',
  MILESTONE_DELETE: 'MILESTONE_DELETE',
  MILESTONE_STATE_TRANSITION: 'MILESTONE_STATE_TRANSITION',
  MILESTONE_BOQ_LINK: 'MILESTONE_BOQ_LINK',

  // Evidence actions
  EVIDENCE_SUBMIT: 'EVIDENCE_SUBMIT',
  EVIDENCE_APPROVE: 'EVIDENCE_APPROVE',
  EVIDENCE_REJECT: 'EVIDENCE_REJECT',
  EVIDENCE_FREEZE: 'EVIDENCE_FREEZE',

  // Verification actions
  VERIFICATION_CREATE: 'VERIFICATION_CREATE',

  // Payment eligibility actions
  ELIGIBILITY_RECALCULATED: 'ELIGIBILITY_RECALCULATED',
  ELIGIBILITY_BLOCKED: 'ELIGIBILITY_BLOCKED',
  ELIGIBILITY_UNBLOCKED: 'ELIGIBILITY_UNBLOCKED',
  ELIGIBILITY_MARKED_PAID: 'ELIGIBILITY_MARKED_PAID',

  // Follow-up actions
  FOLLOWUP_CREATE: 'FOLLOWUP_CREATE',
  FOLLOWUP_RESOLVE: 'FOLLOWUP_RESOLVE',
  FOLLOWUP_ESCALATE: 'FOLLOWUP_ESCALATE',
} as const;

export type AuditActionType = (typeof AuditActionTypes)[keyof typeof AuditActionTypes];

// Blocking reason codes
export const BlockingReasonCodes = {
  QUALITY_ISSUE: 'QUALITY_ISSUE',
  DOCUMENTATION_INCOMPLETE: 'DOCUMENTATION_INCOMPLETE',
  DISPUTE_PENDING: 'DISPUTE_PENDING',
  COMPLIANCE_ISSUE: 'COMPLIANCE_ISSUE',
  BUDGET_HOLD: 'BUDGET_HOLD',
  VENDOR_ISSUE: 'VENDOR_ISSUE',
  OTHER: 'OTHER',
} as const;

export type BlockingReasonCode = (typeof BlockingReasonCodes)[keyof typeof BlockingReasonCodes];

export const BlockingReasonLabels: Record<BlockingReasonCode, string> = {
  QUALITY_ISSUE: 'Quality Issue',
  DOCUMENTATION_INCOMPLETE: 'Documentation Incomplete',
  DISPUTE_PENDING: 'Dispute Pending',
  COMPLIANCE_ISSUE: 'Compliance Issue',
  BUDGET_HOLD: 'Budget Hold',
  VENDOR_ISSUE: 'Vendor Issue',
  OTHER: 'Other',
};

// ============================================
// STATE LABELS FOR UI
// ============================================

export const EligibilityStateLabels: Record<EligibilityState, string> = {
  NOT_DUE: 'Not Due',
  DUE_PENDING_VERIFICATION: 'Due - Pending Verification',
  VERIFIED_NOT_ELIGIBLE: 'Verified - Not Eligible',
  PARTIALLY_ELIGIBLE: 'Partially Eligible',
  FULLY_ELIGIBLE: 'Fully Eligible',
  BLOCKED: 'Blocked',
  MARKED_PAID: 'Paid',
};

export const EligibilityStateColors: Record<EligibilityState, string> = {
  NOT_DUE: 'gray',
  DUE_PENDING_VERIFICATION: 'yellow',
  VERIFIED_NOT_ELIGIBLE: 'gray',
  PARTIALLY_ELIGIBLE: 'yellow',
  FULLY_ELIGIBLE: 'green',
  BLOCKED: 'red',
  MARKED_PAID: 'purple',
};
