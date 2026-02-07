import { PrismaClient, Role, BOQStatus, MilestoneState, PaymentModel, EvidenceStatus, EligibilityState, EligibilityEventType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clear existing data
  await prisma.auditLog.deleteMany();
  await prisma.followUp.deleteMany();
  await prisma.eligibilityEvent.deleteMany();
  await prisma.paymentEligibility.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.evidenceFile.deleteMany();
  await prisma.evidence.deleteMany();
  await prisma.milestoneStateTransition.deleteMany();
  await prisma.milestoneBOQLink.deleteMany();
  await prisma.milestone.deleteMany();
  await prisma.bOQRevision.deleteMany();
  await prisma.bOQItem.deleteMany();
  await prisma.bOQ.deleteMany();
  await prisma.customView.deleteMany();
  await prisma.projectRole.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();

  // Create users
  const hashedPassword = await bcrypt.hash('password123', 10);

  const owner = await prisma.user.create({
    data: {
      name: 'Alex Owner',
      email: 'owner@example.com',
      hashedPassword,
    },
  });

  const pmc = await prisma.user.create({
    data: {
      name: 'Pat PMC',
      email: 'pmc@example.com',
      hashedPassword,
    },
  });

  const vendor = await prisma.user.create({
    data: {
      name: 'Victor Vendor',
      email: 'vendor@example.com',
      hashedPassword,
    },
  });

  const viewer = await prisma.user.create({
    data: {
      name: 'Vera Viewer',
      email: 'viewer@example.com',
      hashedPassword,
    },
  });

  console.log('Created users');

  // Date helpers
  const now = new Date();
  const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const daysFromNow = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  // ============================================
  // PROJECT 1: Downtown Office Building
  // Balanced milestones, one rejected evidence, one pending verification, payment due soon, healthy exposure
  // ============================================

  const project1 = await prisma.project.create({
    data: {
      name: 'Downtown Office Building',
      description: 'A 10-story office building construction project in the downtown area. Features modern design with LEED certification targets.',
      isExampleProject: true,
    },
  });

  await prisma.projectRole.createMany({
    data: [
      { projectId: project1.id, userId: owner.id, role: Role.OWNER },
      { projectId: project1.id, userId: pmc.id, role: Role.PMC },
      { projectId: project1.id, userId: vendor.id, role: Role.VENDOR },
      { projectId: project1.id, userId: viewer.id, role: Role.VIEWER },
    ],
  });

  const boq1 = await prisma.bOQ.create({
    data: {
      projectId: project1.id,
      status: BOQStatus.APPROVED,
    },
  });

  const boq1Items = await Promise.all([
    prisma.bOQItem.create({
      data: { boqId: boq1.id, description: 'Foundation concrete work', unit: 'cum', plannedQty: 500, rate: 150, plannedValue: 75000 },
    }),
    prisma.bOQItem.create({
      data: { boqId: boq1.id, description: 'Structural steel framework', unit: 'MT', plannedQty: 200, rate: 2500, plannedValue: 500000 },
    }),
    prisma.bOQItem.create({
      data: { boqId: boq1.id, description: 'Floor slab casting', unit: 'sqm', plannedQty: 5000, rate: 80, plannedValue: 400000 },
    }),
    prisma.bOQItem.create({
      data: { boqId: boq1.id, description: 'External glazing', unit: 'sqm', plannedQty: 2000, rate: 200, plannedValue: 400000 },
    }),
    prisma.bOQItem.create({
      data: { boqId: boq1.id, description: 'MEP installations', unit: 'LS', plannedQty: 1, rate: 300000, plannedValue: 300000 },
    }),
  ]);

  // Milestone 1: CLOSED (fully paid)
  const p1m1 = await prisma.milestone.create({
    data: {
      projectId: project1.id,
      title: 'Foundation Work',
      description: 'Complete foundation concrete work',
      paymentModel: PaymentModel.MILESTONE_COMPLETE,
      plannedEnd: daysAgo(7),
      actualStart: daysAgo(30),
      actualSubmission: daysAgo(14),
      actualVerification: daysAgo(7),
      state: MilestoneState.CLOSED,
      value: 75000,
      advancePercent: 10,
    },
  });

  await prisma.milestoneBOQLink.create({ data: { milestoneId: p1m1.id, boqItemId: boq1Items[0].id, plannedQty: 500 } });
  await prisma.milestoneStateTransition.createMany({
    data: [
      { milestoneId: p1m1.id, fromState: null, toState: MilestoneState.DRAFT, actorId: pmc.id, role: Role.PMC, createdAt: daysAgo(35) },
      { milestoneId: p1m1.id, fromState: MilestoneState.DRAFT, toState: MilestoneState.IN_PROGRESS, actorId: vendor.id, role: Role.VENDOR, createdAt: daysAgo(30) },
      { milestoneId: p1m1.id, fromState: MilestoneState.IN_PROGRESS, toState: MilestoneState.SUBMITTED, actorId: vendor.id, role: Role.VENDOR, createdAt: daysAgo(14) },
      { milestoneId: p1m1.id, fromState: MilestoneState.SUBMITTED, toState: MilestoneState.VERIFIED, actorId: pmc.id, role: Role.PMC, createdAt: daysAgo(10) },
      { milestoneId: p1m1.id, fromState: MilestoneState.VERIFIED, toState: MilestoneState.CLOSED, actorId: owner.id, role: Role.OWNER, createdAt: daysAgo(7) },
    ],
  });
  await prisma.evidence.create({
    data: { milestoneId: p1m1.id, submittedById: vendor.id, qtyOrPercent: 100, remarks: 'Foundation work completed as per specifications', frozen: true, status: EvidenceStatus.APPROVED, reviewedAt: daysAgo(10), reviewNote: 'Work verified on site' },
  });
  await prisma.verification.create({
    data: { milestoneId: p1m1.id, verifiedById: pmc.id, qtyVerified: 500, valueEligibleComputed: 75000, notes: 'All foundation work completed and verified' },
  });
  const p1m1Eligibility = await prisma.paymentEligibility.create({
    data: {
      milestoneId: p1m1.id,
      boqValueCompleted: 75000,
      deductions: 0,
      eligibleAmount: 75000,
      advanceAmount: 7500,
      remainingAmount: 67500,
      blockedAmount: 0,
      state: EligibilityState.MARKED_PAID,
      dueDate: daysAgo(7),
      markedPaidAt: daysAgo(5),
      markedPaidByActorId: owner.id,
      paidExplanation: 'Payment processed per contract terms',
    },
  });
  await prisma.eligibilityEvent.create({
    data: {
      paymentEligibilityId: p1m1Eligibility.id,
      eventType: EligibilityEventType.MARKED_PAID_BY_OWNER,
      fromState: EligibilityState.FULLY_ELIGIBLE,
      toState: EligibilityState.MARKED_PAID,
      actorId: owner.id,
      actorRole: Role.OWNER,
      eligibleAmountBefore: 75000,
      eligibleAmountAfter: 75000,
      explanation: 'Payment processed per contract terms',
      createdAt: daysAgo(5),
    },
  });

  // Milestone 2: VERIFIED - Payment due soon
  const p1m2 = await prisma.milestone.create({
    data: {
      projectId: project1.id,
      title: 'Structural Framework - Phase 1',
      description: 'Steel framework for floors 1-5',
      paymentModel: PaymentModel.PROGRESS_BASED,
      plannedEnd: daysFromNow(7),
      actualStart: daysAgo(21),
      actualSubmission: daysAgo(5),
      actualVerification: daysAgo(2),
      state: MilestoneState.VERIFIED,
      value: 250000,
      advancePercent: 15,
    },
  });

  await prisma.milestoneBOQLink.create({ data: { milestoneId: p1m2.id, boqItemId: boq1Items[1].id, plannedQty: 100 } });
  await prisma.milestoneStateTransition.createMany({
    data: [
      { milestoneId: p1m2.id, fromState: null, toState: MilestoneState.DRAFT, actorId: pmc.id, role: Role.PMC, createdAt: daysAgo(25) },
      { milestoneId: p1m2.id, fromState: MilestoneState.DRAFT, toState: MilestoneState.IN_PROGRESS, actorId: vendor.id, role: Role.VENDOR, createdAt: daysAgo(21) },
      { milestoneId: p1m2.id, fromState: MilestoneState.IN_PROGRESS, toState: MilestoneState.SUBMITTED, actorId: vendor.id, role: Role.VENDOR, createdAt: daysAgo(5) },
      { milestoneId: p1m2.id, fromState: MilestoneState.SUBMITTED, toState: MilestoneState.VERIFIED, actorId: pmc.id, role: Role.PMC, createdAt: daysAgo(2) },
    ],
  });
  await prisma.evidence.create({
    data: { milestoneId: p1m2.id, submittedById: vendor.id, qtyOrPercent: 100, remarks: 'Floors 1-5 steel framework completed', frozen: true, status: EvidenceStatus.APPROVED, reviewedAt: daysAgo(3) },
  });
  await prisma.verification.create({
    data: { milestoneId: p1m2.id, verifiedById: pmc.id, qtyVerified: 100, valueEligibleComputed: 250000 },
  });
  const p1m2Eligibility = await prisma.paymentEligibility.create({
    data: {
      milestoneId: p1m2.id,
      boqValueCompleted: 250000,
      deductions: 0,
      eligibleAmount: 250000,
      advanceAmount: 37500,
      remainingAmount: 212500,
      blockedAmount: 0,
      state: EligibilityState.FULLY_ELIGIBLE,
      dueDate: daysFromNow(3),
    },
  });
  await prisma.eligibilityEvent.create({
    data: {
      paymentEligibilityId: p1m2Eligibility.id,
      eventType: EligibilityEventType.VERIFICATION_CREATED,
      fromState: EligibilityState.NOT_DUE,
      toState: EligibilityState.FULLY_ELIGIBLE,
      actorId: pmc.id,
      actorRole: Role.PMC,
      eligibleAmountBefore: 0,
      eligibleAmountAfter: 250000,
      triggerEntityType: 'Verification',
      createdAt: daysAgo(2),
    },
  });

  // Milestone 3: SUBMITTED - Pending verification
  const p1m3 = await prisma.milestone.create({
    data: {
      projectId: project1.id,
      title: 'Floor Slab - Levels 1-3',
      description: 'Concrete slab casting for floors 1-3',
      paymentModel: PaymentModel.MILESTONE_COMPLETE,
      plannedEnd: daysFromNow(14),
      actualStart: daysAgo(14),
      actualSubmission: daysAgo(3),
      state: MilestoneState.SUBMITTED,
      value: 120000,
      advancePercent: 0,
    },
  });

  await prisma.milestoneBOQLink.create({ data: { milestoneId: p1m3.id, boqItemId: boq1Items[2].id, plannedQty: 1500 } });
  await prisma.milestoneStateTransition.createMany({
    data: [
      { milestoneId: p1m3.id, fromState: null, toState: MilestoneState.DRAFT, actorId: pmc.id, role: Role.PMC, createdAt: daysAgo(20) },
      { milestoneId: p1m3.id, fromState: MilestoneState.DRAFT, toState: MilestoneState.IN_PROGRESS, actorId: vendor.id, role: Role.VENDOR, createdAt: daysAgo(14) },
      { milestoneId: p1m3.id, fromState: MilestoneState.IN_PROGRESS, toState: MilestoneState.SUBMITTED, actorId: vendor.id, role: Role.VENDOR, createdAt: daysAgo(3) },
    ],
  });
  await prisma.evidence.create({
    data: { milestoneId: p1m3.id, submittedById: vendor.id, qtyOrPercent: 100, remarks: 'Slab casting complete. Curing in progress.', frozen: true, status: EvidenceStatus.SUBMITTED, submittedAt: daysAgo(3) },
  });
  await prisma.paymentEligibility.create({
    data: {
      milestoneId: p1m3.id,
      boqValueCompleted: 0,
      deductions: 0,
      eligibleAmount: 0,
      advanceAmount: 0,
      remainingAmount: 120000,
      blockedAmount: 0,
      state: EligibilityState.DUE_PENDING_VERIFICATION,
      dueDate: daysFromNow(14),
    },
  });

  // Milestone 4: IN_PROGRESS with REJECTED evidence
  const p1m4 = await prisma.milestone.create({
    data: {
      projectId: project1.id,
      title: 'External Glazing - South Facade',
      description: 'Installation of external glazing on south-facing walls',
      paymentModel: PaymentModel.PROGRESS_BASED,
      plannedEnd: daysFromNow(30),
      actualStart: daysAgo(10),
      state: MilestoneState.IN_PROGRESS,
      value: 100000,
      advancePercent: 20,
    },
  });

  await prisma.milestoneBOQLink.create({ data: { milestoneId: p1m4.id, boqItemId: boq1Items[3].id, plannedQty: 500 } });
  await prisma.milestoneStateTransition.createMany({
    data: [
      { milestoneId: p1m4.id, fromState: null, toState: MilestoneState.DRAFT, actorId: pmc.id, role: Role.PMC, createdAt: daysAgo(15) },
      { milestoneId: p1m4.id, fromState: MilestoneState.DRAFT, toState: MilestoneState.IN_PROGRESS, actorId: vendor.id, role: Role.VENDOR, createdAt: daysAgo(10) },
    ],
  });
  // Rejected evidence
  await prisma.evidence.create({
    data: { milestoneId: p1m4.id, submittedById: vendor.id, qtyOrPercent: 30, remarks: 'Initial glazing progress - 30%', frozen: true, status: EvidenceStatus.REJECTED, submittedAt: daysAgo(5), reviewedAt: daysAgo(4), reviewNote: 'Photos unclear, measurements not provided' },
  });
  await prisma.paymentEligibility.create({
    data: {
      milestoneId: p1m4.id,
      boqValueCompleted: 0,
      deductions: 0,
      eligibleAmount: 0,
      advanceAmount: 20000,
      remainingAmount: 80000,
      blockedAmount: 0,
      state: EligibilityState.NOT_DUE,
      dueDate: daysFromNow(30),
    },
  });

  // Milestone 5: DRAFT
  const p1m5 = await prisma.milestone.create({
    data: {
      projectId: project1.id,
      title: 'MEP Rough-In',
      description: 'Mechanical, Electrical, and Plumbing rough-in work',
      paymentModel: PaymentModel.ADVANCE,
      plannedEnd: daysFromNow(45),
      state: MilestoneState.DRAFT,
      value: 300000,
      advancePercent: 25,
    },
  });

  await prisma.milestoneBOQLink.create({ data: { milestoneId: p1m5.id, boqItemId: boq1Items[4].id, plannedQty: 1 } });
  await prisma.milestoneStateTransition.create({
    data: { milestoneId: p1m5.id, fromState: null, toState: MilestoneState.DRAFT, actorId: pmc.id, role: Role.PMC, createdAt: daysAgo(5) },
  });
  await prisma.paymentEligibility.create({
    data: {
      milestoneId: p1m5.id,
      boqValueCompleted: 0,
      deductions: 0,
      eligibleAmount: 0,
      advanceAmount: 75000,
      remainingAmount: 225000,
      blockedAmount: 0,
      state: EligibilityState.NOT_DUE,
      dueDate: daysFromNow(45),
    },
  });

  // Milestone 6: VERIFIED but BLOCKED
  const p1m6 = await prisma.milestone.create({
    data: {
      projectId: project1.id,
      title: 'Structural Framework - Phase 2',
      description: 'Steel framework for floors 6-10',
      paymentModel: PaymentModel.MILESTONE_COMPLETE,
      plannedEnd: daysFromNow(3),
      actualStart: daysAgo(28),
      actualSubmission: daysAgo(10),
      actualVerification: daysAgo(5),
      state: MilestoneState.VERIFIED,
      value: 250000,
      advancePercent: 10,
    },
  });

  await prisma.milestoneBOQLink.create({ data: { milestoneId: p1m6.id, boqItemId: boq1Items[1].id, plannedQty: 100 } });
  await prisma.milestoneStateTransition.createMany({
    data: [
      { milestoneId: p1m6.id, fromState: null, toState: MilestoneState.DRAFT, actorId: pmc.id, role: Role.PMC, createdAt: daysAgo(35) },
      { milestoneId: p1m6.id, fromState: MilestoneState.DRAFT, toState: MilestoneState.IN_PROGRESS, actorId: vendor.id, role: Role.VENDOR, createdAt: daysAgo(28) },
      { milestoneId: p1m6.id, fromState: MilestoneState.IN_PROGRESS, toState: MilestoneState.SUBMITTED, actorId: vendor.id, role: Role.VENDOR, createdAt: daysAgo(10) },
      { milestoneId: p1m6.id, fromState: MilestoneState.SUBMITTED, toState: MilestoneState.VERIFIED, actorId: pmc.id, role: Role.PMC, createdAt: daysAgo(5) },
    ],
  });
  await prisma.evidence.create({
    data: { milestoneId: p1m6.id, submittedById: vendor.id, qtyOrPercent: 100, remarks: 'Upper floors framework complete', frozen: true, status: EvidenceStatus.APPROVED, reviewedAt: daysAgo(7) },
  });
  await prisma.verification.create({
    data: { milestoneId: p1m6.id, verifiedById: pmc.id, qtyVerified: 100, valueEligibleComputed: 250000 },
  });
  const p1m6Eligibility = await prisma.paymentEligibility.create({
    data: {
      milestoneId: p1m6.id,
      boqValueCompleted: 250000,
      deductions: 0,
      eligibleAmount: 250000,
      advanceAmount: 25000,
      remainingAmount: 225000,
      blockedAmount: 250000,
      state: EligibilityState.BLOCKED,
      dueDate: daysFromNow(3),
      blockReasonCode: 'DOCUMENTATION_INCOMPLETE',
      blockExplanation: 'Missing welding certifications for upper floor joints',
      blockedAt: daysAgo(3),
      blockedByActorId: pmc.id,
    },
  });
  await prisma.eligibilityEvent.create({
    data: {
      paymentEligibilityId: p1m6Eligibility.id,
      eventType: EligibilityEventType.BLOCKED_BY_PMC,
      fromState: EligibilityState.FULLY_ELIGIBLE,
      toState: EligibilityState.BLOCKED,
      actorId: pmc.id,
      actorRole: Role.PMC,
      eligibleAmountBefore: 250000,
      eligibleAmountAfter: 250000,
      reasonCode: 'DOCUMENTATION_INCOMPLETE',
      explanation: 'Missing welding certifications for upper floor joints',
      createdAt: daysAgo(3),
    },
  });

  // Milestone 7: EXTRA (Outside BOQ) - Approved
  const p1m7 = await prisma.milestone.create({
    data: {
      projectId: project1.id,
      title: 'Emergency Generator Installation',
      description: 'Additional backup generator requested by client (outside original BOQ)',
      paymentModel: PaymentModel.MILESTONE_COMPLETE,
      plannedEnd: daysFromNow(20),
      actualStart: daysAgo(5),
      state: MilestoneState.IN_PROGRESS,
      value: 85000,
      advancePercent: 30,
      isExtra: true,
      extraApprovedAt: daysAgo(7),
      extraApprovedById: owner.id,
    },
  });

  await prisma.milestoneStateTransition.createMany({
    data: [
      { milestoneId: p1m7.id, fromState: null, toState: MilestoneState.DRAFT, actorId: pmc.id, role: Role.PMC, createdAt: daysAgo(10) },
      { milestoneId: p1m7.id, fromState: MilestoneState.DRAFT, toState: MilestoneState.IN_PROGRESS, actorId: vendor.id, role: Role.VENDOR, createdAt: daysAgo(5) },
    ],
  });

  await prisma.paymentEligibility.create({
    data: {
      milestoneId: p1m7.id,
      boqValueCompleted: 0,
      deductions: 0,
      eligibleAmount: 0,
      advanceAmount: 25500,
      remainingAmount: 59500,
      blockedAmount: 0,
      state: EligibilityState.NOT_DUE,
      dueDate: daysFromNow(20),
    },
  });

  // Project 1 Follow-ups
  await prisma.followUp.createMany({
    data: [
      { projectId: project1.id, type: 'PENDING_VERIFICATION', targetEntity: 'Milestone', targetEntityId: p1m3.id, description: 'Milestone "Floor Slab - Levels 1-3" has submitted evidence pending verification', status: 'OPEN' },
      { projectId: project1.id, type: 'PAYMENT_BLOCKED_TOO_LONG', targetEntity: 'PaymentEligibility', targetEntityId: p1m6Eligibility.id, description: 'Payment for "Structural Framework - Phase 2" blocked for 5 days', status: 'OPEN' },
      { projectId: project1.id, type: 'PAYMENT_DUE_SOON', targetEntity: 'PaymentEligibility', targetEntityId: p1m2Eligibility.id, description: 'Payment for "Structural Framework - Phase 1" due in 3 days ($250,000)', status: 'OPEN' },
    ],
  });

  // Project 1 Audit logs
  await prisma.auditLog.createMany({
    data: [
      { projectId: project1.id, actorId: owner.id, role: Role.OWNER, actionType: 'PROJECT_CREATE', entityType: 'Project', entityId: project1.id, afterJson: { name: project1.name }, createdAt: daysAgo(40) },
      { projectId: project1.id, actorId: owner.id, role: Role.OWNER, actionType: 'BOQ_APPROVE', entityType: 'BOQ', entityId: boq1.id, beforeJson: { status: 'DRAFT' }, afterJson: { status: 'APPROVED' }, createdAt: daysAgo(38) },
      { projectId: project1.id, actorId: pmc.id, role: Role.PMC, actionType: 'MILESTONE_CREATE', entityType: 'Milestone', entityId: p1m1.id, afterJson: { title: 'Foundation Work' }, createdAt: daysAgo(35) },
      { projectId: project1.id, actorId: pmc.id, role: Role.PMC, actionType: 'EVIDENCE_REJECT', entityType: 'Evidence', entityId: p1m4.id, reason: 'Photos unclear, measurements not provided', createdAt: daysAgo(4) },
      { projectId: project1.id, actorId: pmc.id, role: Role.PMC, actionType: 'ELIGIBILITY_BLOCKED', entityType: 'PaymentEligibility', entityId: p1m6Eligibility.id, reason: 'Missing welding certifications', createdAt: daysAgo(3) },
    ],
  });

  console.log('Created Project 1: Downtown Office Building');

  // ============================================
  // PROJECT 2: Riverfront Residential Towers
  // High advances, low certified value, multiple blocked payments, high exposure, delay & risk signals
  // ============================================

  const project2 = await prisma.project.create({
    data: {
      name: 'Riverfront Residential Towers',
      description: 'Twin 25-story luxury residential towers with riverside amenities. Premium finishes and smart home integration.',
      isExampleProject: true,
    },
  });

  await prisma.projectRole.createMany({
    data: [
      { projectId: project2.id, userId: owner.id, role: Role.OWNER },
      { projectId: project2.id, userId: pmc.id, role: Role.PMC },
      { projectId: project2.id, userId: vendor.id, role: Role.VENDOR },
      { projectId: project2.id, userId: viewer.id, role: Role.VIEWER },
    ],
  });

  const boq2 = await prisma.bOQ.create({
    data: { projectId: project2.id, status: BOQStatus.APPROVED },
  });

  const boq2Items = await Promise.all([
    prisma.bOQItem.create({ data: { boqId: boq2.id, description: 'Piling and foundation', unit: 'LS', plannedQty: 1, rate: 2000000, plannedValue: 2000000 } }),
    prisma.bOQItem.create({ data: { boqId: boq2.id, description: 'Concrete superstructure', unit: 'cum', plannedQty: 15000, rate: 180, plannedValue: 2700000 } }),
    prisma.bOQItem.create({ data: { boqId: boq2.id, description: 'Facade cladding', unit: 'sqm', plannedQty: 30000, rate: 150, plannedValue: 4500000 } }),
    prisma.bOQItem.create({ data: { boqId: boq2.id, description: 'Interior fit-out', unit: 'sqm', plannedQty: 50000, rate: 200, plannedValue: 10000000 } }),
    prisma.bOQItem.create({ data: { boqId: boq2.id, description: 'MEP systems', unit: 'LS', plannedQty: 1, rate: 5000000, plannedValue: 5000000 } }),
    prisma.bOQItem.create({ data: { boqId: boq2.id, description: 'Landscaping and amenities', unit: 'LS', plannedQty: 1, rate: 1500000, plannedValue: 1500000 } }),
  ]);

  // High advance payment - PAID
  const p2m1 = await prisma.milestone.create({
    data: {
      projectId: project2.id,
      title: 'Advance Payment - Mobilization',
      description: '20% advance for contractor mobilization',
      paymentModel: PaymentModel.ADVANCE,
      plannedEnd: daysAgo(60),
      state: MilestoneState.CLOSED,
      value: 5000000,
      advancePercent: 100,
    },
  });
  await prisma.milestoneBOQLink.create({ data: { milestoneId: p2m1.id, boqItemId: boq2Items[0].id, plannedQty: 0.2 } });
  await prisma.milestoneStateTransition.createMany({
    data: [
      { milestoneId: p2m1.id, fromState: null, toState: MilestoneState.DRAFT, actorId: pmc.id, role: Role.PMC, createdAt: daysAgo(65) },
      { milestoneId: p2m1.id, fromState: MilestoneState.DRAFT, toState: MilestoneState.VERIFIED, actorId: pmc.id, role: Role.PMC, createdAt: daysAgo(62) },
      { milestoneId: p2m1.id, fromState: MilestoneState.VERIFIED, toState: MilestoneState.CLOSED, actorId: owner.id, role: Role.OWNER, createdAt: daysAgo(60) },
    ],
  });
  await prisma.paymentEligibility.create({
    data: {
      milestoneId: p2m1.id,
      boqValueCompleted: 5000000,
      deductions: 0,
      eligibleAmount: 5000000,
      advanceAmount: 5000000,
      remainingAmount: 0,
      blockedAmount: 0,
      state: EligibilityState.MARKED_PAID,
      markedPaidAt: daysAgo(58),
      markedPaidByActorId: owner.id,
      paidExplanation: 'Mobilization advance per contract',
    },
  });

  // Another high advance - PAID
  const p2m2 = await prisma.milestone.create({
    data: {
      projectId: project2.id,
      title: 'Material Advance - Steel & Cement',
      description: 'Advance for bulk material procurement',
      paymentModel: PaymentModel.ADVANCE,
      plannedEnd: daysAgo(45),
      state: MilestoneState.CLOSED,
      value: 3000000,
      advancePercent: 100,
    },
  });
  await prisma.milestoneBOQLink.create({ data: { milestoneId: p2m2.id, boqItemId: boq2Items[1].id, plannedQty: 0.3 } });
  await prisma.milestoneStateTransition.createMany({
    data: [
      { milestoneId: p2m2.id, fromState: null, toState: MilestoneState.DRAFT, actorId: pmc.id, role: Role.PMC, createdAt: daysAgo(50) },
      { milestoneId: p2m2.id, fromState: MilestoneState.DRAFT, toState: MilestoneState.VERIFIED, actorId: pmc.id, role: Role.PMC, createdAt: daysAgo(47) },
      { milestoneId: p2m2.id, fromState: MilestoneState.VERIFIED, toState: MilestoneState.CLOSED, actorId: owner.id, role: Role.OWNER, createdAt: daysAgo(45) },
    ],
  });
  await prisma.paymentEligibility.create({
    data: {
      milestoneId: p2m2.id,
      boqValueCompleted: 3000000,
      deductions: 0,
      eligibleAmount: 3000000,
      advanceAmount: 3000000,
      remainingAmount: 0,
      blockedAmount: 0,
      state: EligibilityState.MARKED_PAID,
      markedPaidAt: daysAgo(43),
      markedPaidByActorId: owner.id,
      paidExplanation: 'Material advance approved',
    },
  });

  // Piling work - VERIFIED but BLOCKED (dispute)
  const p2m3 = await prisma.milestone.create({
    data: {
      projectId: project2.id,
      title: 'Piling Work - Tower A',
      description: 'Complete piling for Tower A foundation',
      paymentModel: PaymentModel.MILESTONE_COMPLETE,
      plannedEnd: daysAgo(20),
      actualStart: daysAgo(55),
      actualSubmission: daysAgo(25),
      actualVerification: daysAgo(20),
      state: MilestoneState.VERIFIED,
      value: 800000,
      advancePercent: 15,
    },
  });
  await prisma.milestoneBOQLink.create({ data: { milestoneId: p2m3.id, boqItemId: boq2Items[0].id, plannedQty: 0.4 } });
  await prisma.milestoneStateTransition.createMany({
    data: [
      { milestoneId: p2m3.id, fromState: null, toState: MilestoneState.DRAFT, actorId: pmc.id, role: Role.PMC, createdAt: daysAgo(58) },
      { milestoneId: p2m3.id, fromState: MilestoneState.DRAFT, toState: MilestoneState.IN_PROGRESS, actorId: vendor.id, role: Role.VENDOR, createdAt: daysAgo(55) },
      { milestoneId: p2m3.id, fromState: MilestoneState.IN_PROGRESS, toState: MilestoneState.SUBMITTED, actorId: vendor.id, role: Role.VENDOR, createdAt: daysAgo(25) },
      { milestoneId: p2m3.id, fromState: MilestoneState.SUBMITTED, toState: MilestoneState.VERIFIED, actorId: pmc.id, role: Role.PMC, createdAt: daysAgo(20) },
    ],
  });
  await prisma.evidence.create({
    data: { milestoneId: p2m3.id, submittedById: vendor.id, qtyOrPercent: 100, remarks: 'All piles driven and tested', frozen: true, status: EvidenceStatus.APPROVED, reviewedAt: daysAgo(22) },
  });
  await prisma.verification.create({
    data: { milestoneId: p2m3.id, verifiedById: pmc.id, qtyVerified: 0.4, valueEligibleComputed: 800000 },
  });
  const p2m3Eligibility = await prisma.paymentEligibility.create({
    data: {
      milestoneId: p2m3.id,
      boqValueCompleted: 800000,
      deductions: 0,
      eligibleAmount: 800000,
      advanceAmount: 120000,
      remainingAmount: 680000,
      blockedAmount: 800000,
      state: EligibilityState.BLOCKED,
      dueDate: daysAgo(10),
      blockReasonCode: 'DISPUTE_PENDING',
      blockExplanation: 'Quantity dispute - client claims 35% complete vs contractor 40%',
      blockedAt: daysAgo(18),
      blockedByActorId: owner.id,
    },
  });

  // Piling work Tower B - VERIFIED but BLOCKED (quality)
  const p2m4 = await prisma.milestone.create({
    data: {
      projectId: project2.id,
      title: 'Piling Work - Tower B',
      description: 'Complete piling for Tower B foundation',
      paymentModel: PaymentModel.MILESTONE_COMPLETE,
      plannedEnd: daysAgo(10),
      actualStart: daysAgo(40),
      actualSubmission: daysAgo(15),
      actualVerification: daysAgo(10),
      state: MilestoneState.VERIFIED,
      value: 800000,
      advancePercent: 15,
    },
  });
  await prisma.milestoneBOQLink.create({ data: { milestoneId: p2m4.id, boqItemId: boq2Items[0].id, plannedQty: 0.4 } });
  await prisma.milestoneStateTransition.createMany({
    data: [
      { milestoneId: p2m4.id, fromState: null, toState: MilestoneState.DRAFT, actorId: pmc.id, role: Role.PMC, createdAt: daysAgo(45) },
      { milestoneId: p2m4.id, fromState: MilestoneState.DRAFT, toState: MilestoneState.IN_PROGRESS, actorId: vendor.id, role: Role.VENDOR, createdAt: daysAgo(40) },
      { milestoneId: p2m4.id, fromState: MilestoneState.IN_PROGRESS, toState: MilestoneState.SUBMITTED, actorId: vendor.id, role: Role.VENDOR, createdAt: daysAgo(15) },
      { milestoneId: p2m4.id, fromState: MilestoneState.SUBMITTED, toState: MilestoneState.VERIFIED, actorId: pmc.id, role: Role.PMC, createdAt: daysAgo(10) },
    ],
  });
  await prisma.evidence.create({
    data: { milestoneId: p2m4.id, submittedById: vendor.id, qtyOrPercent: 100, remarks: 'Tower B piling complete', frozen: true, status: EvidenceStatus.APPROVED, reviewedAt: daysAgo(12) },
  });
  await prisma.verification.create({
    data: { milestoneId: p2m4.id, verifiedById: pmc.id, qtyVerified: 0.4, valueEligibleComputed: 800000 },
  });
  const p2m4Eligibility = await prisma.paymentEligibility.create({
    data: {
      milestoneId: p2m4.id,
      boqValueCompleted: 800000,
      deductions: 0,
      eligibleAmount: 800000,
      advanceAmount: 120000,
      remainingAmount: 680000,
      blockedAmount: 800000,
      state: EligibilityState.BLOCKED,
      dueDate: daysAgo(5),
      blockReasonCode: 'QUALITY_ISSUE',
      blockExplanation: 'Pile integrity test results pending for 3 piles',
      blockedAt: daysAgo(8),
      blockedByActorId: pmc.id,
    },
  });

  // Concrete work - IN_PROGRESS, delayed
  const p2m5 = await prisma.milestone.create({
    data: {
      projectId: project2.id,
      title: 'Concrete Structure - Basement',
      description: 'Basement slab and retaining walls',
      paymentModel: PaymentModel.PROGRESS_BASED,
      plannedEnd: daysAgo(5), // Overdue!
      actualStart: daysAgo(25),
      state: MilestoneState.IN_PROGRESS,
      value: 360000,
      advancePercent: 20,
    },
  });
  await prisma.milestoneBOQLink.create({ data: { milestoneId: p2m5.id, boqItemId: boq2Items[1].id, plannedQty: 2000 } });
  await prisma.milestoneStateTransition.createMany({
    data: [
      { milestoneId: p2m5.id, fromState: null, toState: MilestoneState.DRAFT, actorId: pmc.id, role: Role.PMC, createdAt: daysAgo(30) },
      { milestoneId: p2m5.id, fromState: MilestoneState.DRAFT, toState: MilestoneState.IN_PROGRESS, actorId: vendor.id, role: Role.VENDOR, createdAt: daysAgo(25) },
    ],
  });
  await prisma.paymentEligibility.create({
    data: {
      milestoneId: p2m5.id,
      boqValueCompleted: 0,
      deductions: 0,
      eligibleAmount: 0,
      advanceAmount: 72000,
      remainingAmount: 288000,
      blockedAmount: 0,
      state: EligibilityState.NOT_DUE,
      dueDate: daysAgo(5),
    },
  });

  // Facade - SUBMITTED, long verification time
  const p2m6 = await prisma.milestone.create({
    data: {
      projectId: project2.id,
      title: 'Facade Mockup Approval',
      description: 'Facade sample panel installation and approval',
      paymentModel: PaymentModel.MILESTONE_COMPLETE,
      plannedEnd: daysFromNow(7),
      actualStart: daysAgo(20),
      actualSubmission: daysAgo(12), // Submitted 12 days ago, still not verified!
      state: MilestoneState.SUBMITTED,
      value: 15000,
      advancePercent: 0,
    },
  });
  await prisma.milestoneBOQLink.create({ data: { milestoneId: p2m6.id, boqItemId: boq2Items[2].id, plannedQty: 100 } });
  await prisma.milestoneStateTransition.createMany({
    data: [
      { milestoneId: p2m6.id, fromState: null, toState: MilestoneState.DRAFT, actorId: pmc.id, role: Role.PMC, createdAt: daysAgo(25) },
      { milestoneId: p2m6.id, fromState: MilestoneState.DRAFT, toState: MilestoneState.IN_PROGRESS, actorId: vendor.id, role: Role.VENDOR, createdAt: daysAgo(20) },
      { milestoneId: p2m6.id, fromState: MilestoneState.IN_PROGRESS, toState: MilestoneState.SUBMITTED, actorId: vendor.id, role: Role.VENDOR, createdAt: daysAgo(12) },
    ],
  });
  await prisma.evidence.create({
    data: { milestoneId: p2m6.id, submittedById: vendor.id, qtyOrPercent: 100, remarks: 'Mockup panel installed, awaiting architect sign-off', frozen: true, status: EvidenceStatus.SUBMITTED, submittedAt: daysAgo(12) },
  });
  await prisma.paymentEligibility.create({
    data: {
      milestoneId: p2m6.id,
      boqValueCompleted: 0,
      deductions: 0,
      eligibleAmount: 0,
      advanceAmount: 0,
      remainingAmount: 15000,
      blockedAmount: 0,
      state: EligibilityState.DUE_PENDING_VERIFICATION,
      dueDate: daysFromNow(7),
    },
  });

  // Project 2 Follow-ups
  await prisma.followUp.createMany({
    data: [
      { projectId: project2.id, type: 'PAYMENT_BLOCKED_TOO_LONG', targetEntity: 'PaymentEligibility', targetEntityId: p2m3Eligibility.id, description: 'Payment for Tower A Piling blocked for 20 days - quantity dispute', status: 'OPEN' },
      { projectId: project2.id, type: 'PAYMENT_BLOCKED_TOO_LONG', targetEntity: 'PaymentEligibility', targetEntityId: p2m4Eligibility.id, description: 'Payment for Tower B Piling blocked for 10 days - quality issue', status: 'OPEN' },
      { projectId: project2.id, type: 'PENDING_VERIFICATION', targetEntity: 'Milestone', targetEntityId: p2m6.id, description: 'Facade mockup evidence pending verification for 12 days', status: 'OPEN' },
      { projectId: project2.id, type: 'HIGH_VENDOR_EXPOSURE', targetEntity: 'Project', targetEntityId: project2.id, description: 'High exposure: $8M paid in advances, only $0 certified work complete', status: 'OPEN' },
    ],
  });

  // Project 2 Audit logs
  await prisma.auditLog.createMany({
    data: [
      { projectId: project2.id, actorId: owner.id, role: Role.OWNER, actionType: 'PROJECT_CREATE', entityType: 'Project', entityId: project2.id, afterJson: { name: project2.name }, createdAt: daysAgo(70) },
      { projectId: project2.id, actorId: owner.id, role: Role.OWNER, actionType: 'ELIGIBILITY_BLOCKED', entityType: 'PaymentEligibility', entityId: p2m3Eligibility.id, reason: 'Quantity dispute', createdAt: daysAgo(18) },
      { projectId: project2.id, actorId: pmc.id, role: Role.PMC, actionType: 'ELIGIBILITY_BLOCKED', entityType: 'PaymentEligibility', entityId: p2m4Eligibility.id, reason: 'Quality issue - pile tests pending', createdAt: daysAgo(8) },
    ],
  });

  console.log('Created Project 2: Riverfront Residential Towers');

  // ============================================
  // PROJECT 3: Industrial Warehouse Fit-Out
  // Many milestones, evidence rejections, long verification times, strong audit trail
  // ============================================

  const project3 = await prisma.project.create({
    data: {
      name: 'Industrial Warehouse Fit-Out',
      description: 'Conversion of 50,000 sqft warehouse into modern logistics facility with cold storage, automated racking, and office space.',
      isExampleProject: true,
    },
  });

  await prisma.projectRole.createMany({
    data: [
      { projectId: project3.id, userId: owner.id, role: Role.OWNER },
      { projectId: project3.id, userId: pmc.id, role: Role.PMC },
      { projectId: project3.id, userId: vendor.id, role: Role.VENDOR },
      { projectId: project3.id, userId: viewer.id, role: Role.VIEWER },
    ],
  });

  const boq3 = await prisma.bOQ.create({
    data: { projectId: project3.id, status: BOQStatus.APPROVED },
  });

  const boq3Items = await Promise.all([
    prisma.bOQItem.create({ data: { boqId: boq3.id, description: 'Demolition and site prep', unit: 'LS', plannedQty: 1, rate: 50000, plannedValue: 50000 } }),
    prisma.bOQItem.create({ data: { boqId: boq3.id, description: 'Structural modifications', unit: 'LS', plannedQty: 1, rate: 150000, plannedValue: 150000 } }),
    prisma.bOQItem.create({ data: { boqId: boq3.id, description: 'Cold storage rooms', unit: 'sqm', plannedQty: 5000, rate: 100, plannedValue: 500000 } }),
    prisma.bOQItem.create({ data: { boqId: boq3.id, description: 'Automated racking system', unit: 'LS', plannedQty: 1, rate: 800000, plannedValue: 800000 } }),
    prisma.bOQItem.create({ data: { boqId: boq3.id, description: 'Electrical upgrade', unit: 'LS', plannedQty: 1, rate: 200000, plannedValue: 200000 } }),
    prisma.bOQItem.create({ data: { boqId: boq3.id, description: 'Fire suppression system', unit: 'LS', plannedQty: 1, rate: 120000, plannedValue: 120000 } }),
    prisma.bOQItem.create({ data: { boqId: boq3.id, description: 'Office build-out', unit: 'sqm', plannedQty: 500, rate: 300, plannedValue: 150000 } }),
    prisma.bOQItem.create({ data: { boqId: boq3.id, description: 'Loading dock upgrades', unit: 'LS', plannedQty: 1, rate: 80000, plannedValue: 80000 } }),
  ]);

  // Helper function to create milestone with eligibility
  type MilestoneConfig = {
    title: string;
    desc: string;
    model: PaymentModel;
    state: MilestoneState;
    boqIdx: number;
    qty: number;
    value: number;
    advancePercent: number;
    evidenceStatus?: EvidenceStatus;
    eligibilityState: EligibilityState;
    daysOffset: number;
  };

  const p3Milestones: MilestoneConfig[] = [
    { title: 'Demolition Complete', desc: 'Remove existing fixtures', model: PaymentModel.MILESTONE_COMPLETE, state: MilestoneState.CLOSED, boqIdx: 0, qty: 1, value: 50000, advancePercent: 0, evidenceStatus: EvidenceStatus.APPROVED, eligibilityState: EligibilityState.MARKED_PAID, daysOffset: -45 },
    { title: 'Structural Steel Install', desc: 'Mezzanine reinforcement', model: PaymentModel.PROGRESS_BASED, state: MilestoneState.CLOSED, boqIdx: 1, qty: 0.5, value: 75000, advancePercent: 20, evidenceStatus: EvidenceStatus.APPROVED, eligibilityState: EligibilityState.MARKED_PAID, daysOffset: -35 },
    { title: 'Structural Completion', desc: 'Remaining structural work', model: PaymentModel.MILESTONE_COMPLETE, state: MilestoneState.VERIFIED, boqIdx: 1, qty: 0.5, value: 75000, advancePercent: 10, evidenceStatus: EvidenceStatus.APPROVED, eligibilityState: EligibilityState.FULLY_ELIGIBLE, daysOffset: -20 },
    { title: 'Cold Storage - Insulation', desc: 'Install insulated panels', model: PaymentModel.PROGRESS_BASED, state: MilestoneState.VERIFIED, boqIdx: 2, qty: 2500, value: 250000, advancePercent: 15, evidenceStatus: EvidenceStatus.APPROVED, eligibilityState: EligibilityState.FULLY_ELIGIBLE, daysOffset: -15 },
    { title: 'Cold Storage - Refrigeration', desc: 'Install cooling units', model: PaymentModel.PROGRESS_BASED, state: MilestoneState.SUBMITTED, boqIdx: 2, qty: 2500, value: 250000, advancePercent: 10, evidenceStatus: EvidenceStatus.SUBMITTED, eligibilityState: EligibilityState.DUE_PENDING_VERIFICATION, daysOffset: -8 },
    { title: 'Racking - Base Installation', desc: 'Floor rails and base frames', model: PaymentModel.PROGRESS_BASED, state: MilestoneState.SUBMITTED, boqIdx: 3, qty: 0.3, value: 240000, advancePercent: 25, evidenceStatus: EvidenceStatus.SUBMITTED, eligibilityState: EligibilityState.DUE_PENDING_VERIFICATION, daysOffset: -5 },
    { title: 'Electrical - Main Panel', desc: 'Upgrade main distribution', model: PaymentModel.MILESTONE_COMPLETE, state: MilestoneState.IN_PROGRESS, boqIdx: 4, qty: 0.5, value: 100000, advancePercent: 30, eligibilityState: EligibilityState.NOT_DUE, daysOffset: 10 },
    { title: 'Electrical - Branch Circuits', desc: 'Install branch circuits', model: PaymentModel.PROGRESS_BASED, state: MilestoneState.IN_PROGRESS, boqIdx: 4, qty: 0.5, value: 100000, advancePercent: 20, eligibilityState: EligibilityState.NOT_DUE, daysOffset: 15 },
    { title: 'Fire Suppression', desc: 'Complete fire suppression', model: PaymentModel.MILESTONE_COMPLETE, state: MilestoneState.DRAFT, boqIdx: 5, qty: 1, value: 120000, advancePercent: 10, eligibilityState: EligibilityState.NOT_DUE, daysOffset: 25 },
    { title: 'Office Framing', desc: 'Metal stud framing', model: PaymentModel.PROGRESS_BASED, state: MilestoneState.DRAFT, boqIdx: 6, qty: 250, value: 75000, advancePercent: 15, eligibilityState: EligibilityState.NOT_DUE, daysOffset: 30 },
    { title: 'Office Finishes', desc: 'Drywall, paint, flooring', model: PaymentModel.MILESTONE_COMPLETE, state: MilestoneState.DRAFT, boqIdx: 6, qty: 250, value: 75000, advancePercent: 0, eligibilityState: EligibilityState.NOT_DUE, daysOffset: 40 },
    { title: 'Loading Dock', desc: 'Dock levelers and doors', model: PaymentModel.MILESTONE_COMPLETE, state: MilestoneState.DRAFT, boqIdx: 7, qty: 1, value: 80000, advancePercent: 20, eligibilityState: EligibilityState.NOT_DUE, daysOffset: 35 },
  ];

  const p3MilestoneRecords: Array<MilestoneConfig & { id: string }> = [];
  for (const m of p3Milestones) {
    const milestone = await prisma.milestone.create({
      data: {
        projectId: project3.id,
        title: m.title,
        description: m.desc,
        paymentModel: m.model,
        plannedEnd: m.daysOffset < 0 ? daysAgo(-m.daysOffset) : daysFromNow(m.daysOffset),
        actualStart: m.state !== MilestoneState.DRAFT ? daysAgo(-m.daysOffset + 15) : undefined,
        actualSubmission: ([MilestoneState.SUBMITTED, MilestoneState.VERIFIED, MilestoneState.CLOSED] as MilestoneState[]).includes(m.state) ? daysAgo(-m.daysOffset + 5) : undefined,
        actualVerification: ([MilestoneState.VERIFIED, MilestoneState.CLOSED] as MilestoneState[]).includes(m.state) ? daysAgo(-m.daysOffset + 2) : undefined,
        state: m.state,
        value: m.value,
        advancePercent: m.advancePercent,
      },
    });
    p3MilestoneRecords.push({ ...m, id: milestone.id });

    await prisma.milestoneBOQLink.create({ data: { milestoneId: milestone.id, boqItemId: boq3Items[m.boqIdx].id, plannedQty: m.qty } });

    // Transitions based on state
    const transitions: Array<{ milestoneId: string; fromState: MilestoneState | null; toState: MilestoneState; actorId: string; role: Role; createdAt: Date }> = [
      { milestoneId: milestone.id, fromState: null, toState: MilestoneState.DRAFT, actorId: pmc.id, role: Role.PMC, createdAt: daysAgo(-m.daysOffset + 20) },
    ];
    if (m.state !== MilestoneState.DRAFT) {
      transitions.push({ milestoneId: milestone.id, fromState: MilestoneState.DRAFT, toState: MilestoneState.IN_PROGRESS, actorId: vendor.id, role: Role.VENDOR, createdAt: daysAgo(-m.daysOffset + 15) });
    }
    if (([MilestoneState.SUBMITTED, MilestoneState.VERIFIED, MilestoneState.CLOSED] as MilestoneState[]).includes(m.state)) {
      transitions.push({ milestoneId: milestone.id, fromState: MilestoneState.IN_PROGRESS, toState: MilestoneState.SUBMITTED, actorId: vendor.id, role: Role.VENDOR, createdAt: daysAgo(-m.daysOffset + 5) });
    }
    if (([MilestoneState.VERIFIED, MilestoneState.CLOSED] as MilestoneState[]).includes(m.state)) {
      transitions.push({ milestoneId: milestone.id, fromState: MilestoneState.SUBMITTED, toState: MilestoneState.VERIFIED, actorId: pmc.id, role: Role.PMC, createdAt: daysAgo(-m.daysOffset + 2) });
    }
    if (m.state === MilestoneState.CLOSED) {
      transitions.push({ milestoneId: milestone.id, fromState: MilestoneState.VERIFIED, toState: MilestoneState.CLOSED, actorId: owner.id, role: Role.OWNER, createdAt: daysAgo(-m.daysOffset) });
    }
    await prisma.milestoneStateTransition.createMany({ data: transitions });

    // Evidence
    if (m.evidenceStatus) {
      await prisma.evidence.create({
        data: {
          milestoneId: milestone.id,
          submittedById: vendor.id,
          qtyOrPercent: 100,
          remarks: `${m.title} - work completed`,
          frozen: m.evidenceStatus !== EvidenceStatus.SUBMITTED,
          status: m.evidenceStatus,
          submittedAt: daysAgo(-m.daysOffset + 5),
          reviewedAt: m.evidenceStatus !== EvidenceStatus.SUBMITTED ? daysAgo(-m.daysOffset + 3) : undefined,
        },
      });
    }

    // Verification
    if (([MilestoneState.VERIFIED, MilestoneState.CLOSED] as MilestoneState[]).includes(m.state)) {
      await prisma.verification.create({
        data: { milestoneId: milestone.id, verifiedById: pmc.id, qtyVerified: m.qty, valueEligibleComputed: m.value },
      });
    }

    // Payment eligibility
    const isPaid = m.eligibilityState === EligibilityState.MARKED_PAID;
    const isEligible = ([EligibilityState.FULLY_ELIGIBLE, EligibilityState.PARTIALLY_ELIGIBLE] as EligibilityState[]).includes(m.eligibilityState);
    const advanceAmount = m.value * (m.advancePercent / 100);
    const remainingAmount = m.value - advanceAmount;
    await prisma.paymentEligibility.create({
      data: {
        milestoneId: milestone.id,
        boqValueCompleted: isEligible || isPaid ? m.value : 0,
        deductions: 0,
        eligibleAmount: isEligible || isPaid ? m.value : 0,
        advanceAmount: advanceAmount,
        remainingAmount: remainingAmount,
        blockedAmount: 0,
        state: m.eligibilityState,
        dueDate: m.daysOffset < 0 ? daysAgo(-m.daysOffset - 5) : daysFromNow(m.daysOffset + 5),
        markedPaidAt: isPaid ? daysAgo(-m.daysOffset - 2) : undefined,
        markedPaidByActorId: isPaid ? owner.id : undefined,
        paidExplanation: isPaid ? 'Payment processed per contract' : undefined,
      },
    });
  }

  // Add some REJECTED evidence to show rejection pattern
  const coldStorageRefrig = p3MilestoneRecords.find(m => m.title === 'Cold Storage - Refrigeration');
  if (coldStorageRefrig) {
    await prisma.evidence.create({
      data: {
        milestoneId: coldStorageRefrig.id,
        submittedById: vendor.id,
        qtyOrPercent: 100,
        remarks: 'Initial refrigeration install - first submission',
        frozen: true,
        status: EvidenceStatus.REJECTED,
        submittedAt: daysAgo(15),
        reviewedAt: daysAgo(13),
        reviewNote: 'Temperature readings not within spec. Re-calibration required.',
      },
    });
  }

  const rackingBase = p3MilestoneRecords.find(m => m.title === 'Racking - Base Installation');
  if (rackingBase) {
    await prisma.evidence.create({
      data: {
        milestoneId: rackingBase.id,
        submittedById: vendor.id,
        qtyOrPercent: 100,
        remarks: 'Racking base - first attempt',
        frozen: true,
        status: EvidenceStatus.REJECTED,
        submittedAt: daysAgo(10),
        reviewedAt: daysAgo(8),
        reviewNote: 'Anchor bolts not properly torqued per manufacturer spec',
      },
    });
    await prisma.evidence.create({
      data: {
        milestoneId: rackingBase.id,
        submittedById: vendor.id,
        qtyOrPercent: 100,
        remarks: 'Racking base - second attempt',
        frozen: true,
        status: EvidenceStatus.REJECTED,
        submittedAt: daysAgo(7),
        reviewedAt: daysAgo(6),
        reviewNote: 'Missing levelness survey documentation',
      },
    });
  }

  // Project 3 Follow-ups
  await prisma.followUp.createMany({
    data: [
      { projectId: project3.id, type: 'PENDING_VERIFICATION', targetEntity: 'Milestone', targetEntityId: coldStorageRefrig?.id || '', description: 'Cold Storage Refrigeration awaiting verification for 8 days', status: 'OPEN' },
      { projectId: project3.id, type: 'PENDING_EVIDENCE_REVIEW', targetEntity: 'Milestone', targetEntityId: rackingBase?.id || '', description: 'Racking Base Installation - third evidence submission pending review', status: 'OPEN' },
    ],
  });

  // Strong audit trail for Project 3
  const auditEntries: Array<{
    projectId: string;
    actorId: string;
    role: Role;
    actionType: string;
    entityType: string;
    entityId: string;
    beforeJson?: object;
    afterJson?: object;
    reason?: string;
    createdAt: Date;
  }> = [];
  auditEntries.push({ projectId: project3.id, actorId: owner.id, role: Role.OWNER, actionType: 'PROJECT_CREATE', entityType: 'Project', entityId: project3.id, afterJson: { name: project3.name }, createdAt: daysAgo(60) });
  auditEntries.push({ projectId: project3.id, actorId: owner.id, role: Role.OWNER, actionType: 'BOQ_APPROVE', entityType: 'BOQ', entityId: boq3.id, beforeJson: { status: 'DRAFT' }, afterJson: { status: 'APPROVED' }, createdAt: daysAgo(58) });

  for (const m of p3MilestoneRecords) {
    auditEntries.push({ projectId: project3.id, actorId: pmc.id, role: Role.PMC, actionType: 'MILESTONE_CREATE', entityType: 'Milestone', entityId: m.id, afterJson: { title: m.title }, createdAt: daysAgo(-m.daysOffset + 20) });
  }

  // Evidence rejections in audit
  if (coldStorageRefrig) {
    auditEntries.push({ projectId: project3.id, actorId: pmc.id, role: Role.PMC, actionType: 'EVIDENCE_REJECT', entityType: 'Evidence', entityId: coldStorageRefrig.id, reason: 'Temperature readings not within spec', createdAt: daysAgo(13) });
  }
  if (rackingBase) {
    auditEntries.push({ projectId: project3.id, actorId: pmc.id, role: Role.PMC, actionType: 'EVIDENCE_REJECT', entityType: 'Evidence', entityId: rackingBase.id, reason: 'Anchor bolts not properly torqued', createdAt: daysAgo(8) });
    auditEntries.push({ projectId: project3.id, actorId: pmc.id, role: Role.PMC, actionType: 'EVIDENCE_REJECT', entityType: 'Evidence', entityId: rackingBase.id, reason: 'Missing levelness survey documentation', createdAt: daysAgo(6) });
  }

  await prisma.auditLog.createMany({ data: auditEntries });

  console.log('Created Project 3: Industrial Warehouse Fit-Out');

  console.log('\n========================================');
  console.log('Database seeded successfully!');
  console.log('========================================');
  console.log('\n3 Example Projects Created:');
  console.log('  1. Downtown Office Building - Balanced, healthy project');
  console.log('  2. Riverfront Residential Towers - High risk, blocked payments');
  console.log('  3. Industrial Warehouse Fit-Out - Many milestones, rejections');
  console.log('\nDemo accounts:');
  console.log('  Owner: owner@example.com / password123');
  console.log('  PMC: pmc@example.com / password123');
  console.log('  Vendor: vendor@example.com / password123');
  console.log('  Viewer: viewer@example.com / password123');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
