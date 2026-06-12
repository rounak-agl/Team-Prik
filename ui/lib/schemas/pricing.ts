import { z } from "zod";

export const PricingRoomSchema = z.object({
  id: z.string(),
  routeId: z.string(),
  routeDirection: z.string(),
  source: z.string().nullable(),
  destination: z.string().nullable(),
  journeyDate: z.string(),
  title: z.string(),
  dayType: z.string().nullable(),
  demandScore: z.number().nullable(),
  festivalFlag: z.boolean(),
  status: z.string(),
  createdBy: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PricingRoom = z.infer<typeof PricingRoomSchema>;

export const OpenRoomRequestSchema = z.object({
  routeId: z.string().min(1),
  routeDirection: z.string().min(1),
  source: z.string().optional(),
  destination: z.string().optional(),
  journeyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
});
export type OpenRoomRequest = z.infer<typeof OpenRoomRequestSchema>;

export const MessageTypeEnum = z.enum([
  "text", "instruction", "recommendation", "decision", "alert",
  "approval_request", "approval_response", "change_summary",
  "change_failure", "change_table_preview",
]);
export const SenderTypeEnum = z.enum(["ba", "agent", "system", "manager"]);

export const PricingChatMessageSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  senderType: SenderTypeEnum,
  senderId: z.string().nullable(),
  messageText: z.string(),
  messageType: MessageTypeEnum,
  metadata: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string(),
});
export type PricingChatMessage = z.infer<typeof PricingChatMessageSchema>;

export const SendMessageRequestSchema = z.object({
  messageText: z.string().min(1, "Message cannot be empty"),
  messageType: MessageTypeEnum.default("instruction"),
  scope: z.string().optional(),
  serviceId: z.string().optional(),
  timeBand: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type SendMessageRequest = z.infer<typeof SendMessageRequestSchema>;

export const InstructionScopeEnum = z.enum([
  "route_date",
  "service",
  "route_date_all_services",
  "time_band",
  "route_future_weekdays",
  "until_departure",
  "permanent",
]);

export const InstructionStatusEnum = z.enum([
  "draft", "active", "used_by_agent", "expired", "disabled", "rejected", "superseded"
]);

export const InstructionTypeEnum = z.enum([
  "demand_override", "pricing_guardrail", "occupancy_target", "epk_target",
  "asp_target", "service_strategy", "time_strategy", "festival_context",
  "offline_sales_context", "competitor_context", "manual_freeze", "escalation_rule",
]);

export const PricingInstructionSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  scope: InstructionScopeEnum,
  routeId: z.string().nullable(),
  routeDirection: z.string().nullable(),
  journeyDate: z.string().nullable(),
  serviceId: z.string().nullable(),
  serviceNumber: z.string().nullable(),
  timeBand: z.string().nullable(),
  instructionText: z.string(),
  instructionJson: z.record(z.string(), z.unknown()),
  instructionType: InstructionTypeEnum,
  priority: z.number(),
  status: InstructionStatusEnum,
  requiresApproval: z.boolean(),
  approvedBy: z.string().nullable(),
  approvedAt: z.string().nullable(),
  effectiveFrom: z.string(),
  expiresAt: z.string().nullable(),
  createdBy: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PricingInstruction = z.infer<typeof PricingInstructionSchema>;

export const ParsedInstructionSchema = z.object({
  instructionId: z.string().optional(),
  scope: z.string(),
  route: z.string().optional(),
  journeyDate: z.string().optional(),
  timeBand: z.string().optional(),
  instructionType: InstructionTypeEnum,
  demandOverride: z.string().optional(),
  maxClassification: z.string().optional(),
  minClassification: z.string().optional(),
  epkFloor: z.number().optional(),
  aspFloor: z.number().optional(),
  occupancyTarget: z.number().optional(),
  checkpointRules: z.array(z.record(z.string(), z.unknown())).optional(),
  busAdjStepSize: z.number().optional(),
  createdBy: z.string().optional(),
  status: z.string().optional(),
  expiresAt: z.string().optional(),
});
export type ParsedInstruction = z.infer<typeof ParsedInstructionSchema>;

export const PricingRecommendationSchema = z.object({
  id: z.string(),
  tripId: z.union([z.string(), z.number()]),
  serviceNumber: z.string().nullable(),
  serviceName: z.string().nullable(),
  departureTime: z.string().nullable(),
  currentClassification: z.string(),
  currentBusAdjPct: z.number(),
  recommendedAction: z.string(),
  newClassification: z.string().nullable(),
  newBusAdjPct: z.number().nullable(),
  reason: z.string(),
  riskLevel: z.string(),
  confidence: z.number(),
  status: z.enum(["pending", "approved", "rejected", "held", "applied"]),
  instructionUsed: z.string().nullable(),
  createdAt: z.string(),
});
export type PricingRecommendation = z.infer<typeof PricingRecommendationSchema>;

export const ChangeBatchStatusEnum = z.enum([
  "recommended", "approved", "applied", "partially_applied", "failed", "rejected", "blocked"
]);

export const ChangeBatchSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  cycleId: z.string().nullable(),
  routeId: z.string().nullable(),
  routeDirection: z.string().nullable(),
  journeyDate: z.string().nullable(),
  changeCount: z.number(),
  increaseCount: z.number(),
  decreaseCount: z.number(),
  classificationChangeCount: z.number(),
  blockedCount: z.number(),
  failedCount: z.number(),
  status: ChangeBatchStatusEnum,
  summaryText: z.string().nullable(),
  createdBy: z.string().nullable(),
  createdAt: z.string(),
});
export type ChangeBatch = z.infer<typeof ChangeBatchSchema>;

export const ChangeItemSchema = z.object({
  id: z.string(),
  batchId: z.string(),
  serviceId: z.string(),
  serviceNumber: z.string().nullable(),
  serviceName: z.string().nullable(),
  departureTime: z.string().nullable(),
  beforeClassification: z.string().nullable(),
  afterClassification: z.string().nullable(),
  beforeBusAdjPct: z.number().nullable(),
  afterBusAdjPct: z.number().nullable(),
  beforeEffectiveFare: z.number().nullable(),
  afterEffectiveFare: z.number().nullable(),
  beforeOccupancy: z.number().nullable(),
  afterOccupancy: z.number().nullable(),
  reasonToChange: z.string(),
  instructionUsed: z.string().nullable(),
  instructionId: z.string().nullable(),
  agentConfidence: z.number().nullable(),
  riskLevel: z.string().nullable(),
  guardrailStatus: z.string().nullable(),
  writerStatus: z.string().nullable(),
  writerResponse: z.record(z.string(), z.unknown()).default({}),
  changedBy: z.string().nullable(),
  appliedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type ChangeItem = z.infer<typeof ChangeItemSchema>;

export const UpdateClassificationRequestSchema = z.object({
  tripId: z.union([z.string(), z.number()]),
  fareClassification: z.string().min(1),
  pricingModel: z.string().default("Automation_v4"),
});
export type UpdateClassificationRequest = z.infer<typeof UpdateClassificationRequestSchema>;

export const ApplyFareAdjustmentRequestSchema = z.object({
  tripIds: z.array(z.number()),
  fareValue: z.number().int().min(-20).max(20),
  reasonId: z.number().int().positive(),
  seatType: z.array(z.enum(["seater", "singleSleeper", "sharedSleeper"])).default(["seater", "singleSleeper", "sharedSleeper"]),
});
export type ApplyFareAdjustmentRequest = z.infer<typeof ApplyFareAdjustmentRequestSchema>;

export const FareAdjustmentReasonSchema = z.object({
  id: z.number(),
  reason: z.string(),
  type: z.string().optional(),
});
export type FareAdjustmentReason = z.infer<typeof FareAdjustmentReasonSchema>;
