"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryVNextPlanRepository = void 0;
exports.createPrismaVNextPlanRepository = createPrismaVNextPlanRepository;
const client_1 = require("@prisma/client");
const db_1 = require("../../db");
function toJsonValue(value) {
    return value;
}
function toGoalRecord(goal) {
    return {
        distance: goal.distance,
        goalType: goal.goalType,
        weeks: goal.weeks,
        startDate: new Date(goal.startDate),
        endDate: goal.endDate ? new Date(goal.endDate) : null,
        targetTime: goal.targetTime,
        targetPaceSecPerKm: goal.targetPaceSecPerKm,
        availableTrainingDays: goal.availableTrainingDays ?? [],
        preferredLongRunDay: goal.preferredLongRunDay,
        ambition: undefined,
        reminderHour: 7,
        reminderMin: 0,
    };
}
function toProfileRecord(runnerProfile) {
    return {
        firstName: runnerProfile.firstName,
        heightCm: runnerProfile.heightCm,
        weightKg: runnerProfile.weightKg,
        age: runnerProfile.age,
        activityLevel: runnerProfile.activityLevel,
        runningExperience: runnerProfile.runningExperience,
        currentRunningAbility: runnerProfile.currentRunningAbility,
        gender: runnerProfile.gender,
        userTrainingContext: runnerProfile.userTrainingContext,
        currentWeeklyVolumeKm: runnerProfile.currentWeeklyVolumeKm,
        currentRunsPerWeek: runnerProfile.currentRunsPerWeek,
        longestCurrentRunMin: runnerProfile.longestCurrentRunMin,
        recentRaceTimesJson: runnerProfile.recentRaceTimes ? toJsonValue(runnerProfile.recentRaceTimes) : client_1.Prisma.JsonNull,
        injuryHistory: runnerProfile.injuryHistory,
        weakPoints: runnerProfile.weakPoints,
        realisticTrainingDaysPerWeek: runnerProfile.realisticTrainingDaysPerWeek,
        typicalWorkoutMinutes: runnerProfile.typicalWorkoutMinutes,
        otherTraining: runnerProfile.otherTraining,
        preferredGuidance: runnerProfile.preferredGuidance,
    };
}
function buildPlanSummary(record) {
    return {
        persistedPlanId: record.id,
        profileId: record.profileId,
        goalId: record.goalId ?? undefined,
        currentVersionNumber: record.currentVersionNumber,
        latestHistoryEntryId: record.latestHistoryEntryId ?? undefined,
    };
}
function historySummaryFromEntries(entries) {
    return entries
        .slice()
        .sort((left, right) => right.resultingVersionNumber - left.resultingVersionNumber)
        .slice(0, 5)
        .map((entry) => ({
        entryId: entry.entryId,
        resultingVersionNumber: entry.resultingVersionNumber,
        mutationType: entry.mutation.mutationType,
        applied: entry.applied,
        fallback: entry.fallback,
    }));
}
async function resolveProfile(params) {
    const profileData = toProfileRecord(params.runnerProfile);
    if (params.profileId) {
        return db_1.prisma.runnerProfile.upsert({
            where: { id: params.profileId },
            update: profileData,
            create: {
                id: params.profileId,
                ...profileData,
                ...(params.userId ? { userId: params.userId } : {}),
            },
            select: { id: true },
        });
    }
    if (params.userId) {
        return db_1.prisma.runnerProfile.upsert({
            where: { userId: params.userId },
            update: profileData,
            create: {
                ...profileData,
                userId: params.userId,
            },
            select: { id: true },
        });
    }
    return db_1.prisma.runnerProfile.create({
        data: profileData,
        select: { id: true },
    });
}
function createPrismaVNextPlanRepository() {
    const prismaClient = db_1.prisma;
    return {
        async saveGeneratedPlan(params) {
            const profile = await resolveProfile(params);
            const goal = await db_1.prisma.goal.create({
                data: {
                    ...toGoalRecord(params.goal),
                    profileId: profile.id,
                },
                select: { id: true },
            });
            const logicalPlanId = params.plan.versionMetadata?.planId ?? "stridepilot_plan";
            const versionNumber = params.plan.versionMetadata?.versionNumber ?? 1;
            const planState = await prismaClient.vNextPlanState.upsert({
                where: {
                    profileId_logicalPlanId: {
                        profileId: profile.id,
                        logicalPlanId,
                    },
                },
                update: {
                    goalId: goal.id,
                    currentVersionNumber: versionNumber,
                    engineVersion: "vnext",
                    latestHistoryEntryId: null,
                    versions: {
                        deleteMany: {},
                        create: {
                            versionNumber,
                            derivedFromVersionNumber: params.plan.versionMetadata?.derivedFromVersionNumber,
                            isCurrent: true,
                            snapshotJson: toJsonValue(params.plan),
                            validationJson: toJsonValue(params.plan.vNextValidation ?? {}),
                            versionMetadataJson: toJsonValue(params.plan.versionMetadata ?? {}),
                            mutationHistoryJson: toJsonValue(params.plan.mutationHistory ?? []),
                        },
                    },
                    history: {
                        deleteMany: {},
                    },
                },
                create: {
                    logicalPlanId,
                    engineVersion: "vnext",
                    currentVersionNumber: versionNumber,
                    profileId: profile.id,
                    goalId: goal.id,
                    versions: {
                        create: {
                            versionNumber,
                            derivedFromVersionNumber: params.plan.versionMetadata?.derivedFromVersionNumber,
                            isCurrent: true,
                            snapshotJson: toJsonValue(params.plan),
                            validationJson: toJsonValue(params.plan.vNextValidation ?? {}),
                            versionMetadataJson: toJsonValue(params.plan.versionMetadata ?? {}),
                            mutationHistoryJson: toJsonValue(params.plan.mutationHistory ?? []),
                        },
                    },
                },
                select: {
                    id: true,
                    profileId: true,
                    goalId: true,
                    currentVersionNumber: true,
                    latestHistoryEntryId: true,
                },
            });
            return buildPlanSummary(planState);
        },
        async saveAdaptivePass(params) {
            const existing = await prismaClient.vNextPlanState.findFirst({
                where: {
                    id: params.persistedPlanId,
                    profile: {
                        userId: params.ownerUserId,
                    },
                },
                select: {
                    id: true,
                    profileId: true,
                    goalId: true,
                    currentVersionNumber: true,
                },
            });
            if (!existing) {
                throw new Error("Persisted vNext plan not found");
            }
            const historyEntry = params.result.historyEntry;
            await db_1.prisma.$transaction(async (tx) => {
                const transactionClient = tx;
                await transactionClient.vNextPlanHistory.create({
                    data: {
                        entryId: historyEntry.entryId,
                        planStateId: existing.id,
                        sourceVersionNumber: historyEntry.sourceVersionNumber,
                        resultingVersionNumber: historyEntry.resultingVersionNumber,
                        feedbackJson: toJsonValue(historyEntry.feedback),
                        decisionJson: toJsonValue(historyEntry.decision),
                        mutationJson: toJsonValue(historyEntry.mutation),
                        validationJson: toJsonValue(historyEntry.validation),
                        applied: historyEntry.applied,
                        fallback: historyEntry.fallback,
                    },
                });
                if (params.result.applied) {
                    await transactionClient.vNextPlanVersion.updateMany({
                        where: {
                            planStateId: existing.id,
                            isCurrent: true,
                        },
                        data: {
                            isCurrent: false,
                        },
                    });
                    await transactionClient.vNextPlanVersion.create({
                        data: {
                            planStateId: existing.id,
                            versionNumber: params.result.finalPlan.versionMetadata?.versionNumber ?? historyEntry.resultingVersionNumber,
                            derivedFromVersionNumber: params.result.finalPlan.versionMetadata?.derivedFromVersionNumber,
                            isCurrent: true,
                            snapshotJson: toJsonValue(params.result.finalPlan),
                            validationJson: toJsonValue(params.result.finalPlan.vNextValidation ?? {}),
                            versionMetadataJson: toJsonValue(params.result.finalPlan.versionMetadata ?? {}),
                            mutationHistoryJson: toJsonValue(params.result.finalPlan.mutationHistory ?? []),
                        },
                    });
                }
                await transactionClient.vNextPlanState.update({
                    where: { id: existing.id },
                    data: {
                        currentVersionNumber: params.result.applied
                            ? (params.result.finalPlan.versionMetadata?.versionNumber ?? historyEntry.resultingVersionNumber)
                            : existing.currentVersionNumber,
                        latestHistoryEntryId: historyEntry.entryId,
                    },
                });
            });
            const updated = await prismaClient.vNextPlanState.findUnique({
                where: { id: existing.id },
                select: {
                    id: true,
                    profileId: true,
                    goalId: true,
                    currentVersionNumber: true,
                    latestHistoryEntryId: true,
                },
            });
            if (!updated) {
                throw new Error("Persisted vNext plan disappeared after adaptive save");
            }
            return buildPlanSummary(updated);
        },
        async getPlanState(planId) {
            const planState = await prismaClient.vNextPlanState.findUnique({
                where: { id: planId },
                select: {
                    id: true,
                    profileId: true,
                    goalId: true,
                    currentVersionNumber: true,
                    latestHistoryEntryId: true,
                },
            });
            return planState ? buildPlanSummary(planState) : null;
        },
        async getCurrentPlan(planId, ownerUserId) {
            const planState = await prismaClient.vNextPlanState.findFirst({
                where: {
                    id: planId,
                    profile: {
                        userId: ownerUserId,
                    },
                },
                include: {
                    versions: {
                        where: { isCurrent: true },
                        take: 1,
                        orderBy: { versionNumber: "desc" },
                    },
                    history: {
                        orderBy: { createdAt: "desc" },
                        take: 5,
                    },
                },
            });
            const currentVersion = planState?.versions[0];
            if (!planState || !currentVersion) {
                return null;
            }
            const historyEntries = planState.history.map((item) => ({
                entryId: item.entryId,
                sourceVersionNumber: item.sourceVersionNumber,
                resultingVersionNumber: item.resultingVersionNumber,
                feedback: (item.feedbackJson ?? {}),
                decision: (item.decisionJson ?? {}),
                mutation: (item.mutationJson ?? {}),
                validation: (item.validationJson ?? {}),
                applied: item.applied,
                fallback: item.fallback,
            }));
            return {
                persistedPlanId: planState.id,
                profileId: planState.profileId,
                goalId: planState.goalId ?? undefined,
                plan: currentVersion.snapshotJson,
                versionMetadata: (currentVersion.versionMetadataJson ?? undefined),
                currentVersionNumber: planState.currentVersionNumber,
                historySummary: historySummaryFromEntries(historyEntries),
            };
        },
        async getLatestCurrentPlanForUser(ownerUserId) {
            const latestState = await prismaClient.vNextPlanState.findFirst({
                where: {
                    engineVersion: "vnext",
                    profile: {
                        userId: ownerUserId,
                    },
                },
                orderBy: [
                    { updatedAt: "desc" },
                    { createdAt: "desc" },
                ],
                select: {
                    id: true,
                },
            });
            if (!latestState) {
                return null;
            }
            return this.getCurrentPlan(latestState.id, ownerUserId);
        },
    };
}
class InMemoryVNextPlanRepository {
    constructor() {
        this.planCounter = 1;
        this.profileCounter = 1;
        this.goalCounter = 1;
        this.states = new Map();
        this.statesByLogicalKey = new Map();
        this.histories = new Map();
        this.plans = new Map();
        this.owners = new Map();
        this.ownedPlanIds = new Map();
    }
    async saveGeneratedPlan(params) {
        const persistedPlanId = `vnext_plan_${this.planCounter++}`;
        const profileId = params.profileId ?? `profile_${this.profileCounter++}`;
        const goalId = `goal_${this.goalCounter++}`;
        const summary = {
            persistedPlanId,
            profileId,
            goalId,
            currentVersionNumber: params.plan.versionMetadata?.versionNumber ?? 1,
        };
        const logicalKey = `${profileId}:${params.plan.versionMetadata?.planId ?? persistedPlanId}`;
        this.states.set(persistedPlanId, summary);
        this.statesByLogicalKey.set(logicalKey, persistedPlanId);
        this.histories.set(persistedPlanId, []);
        this.plans.set(persistedPlanId, params.plan);
        if (params.userId) {
            this.owners.set(persistedPlanId, params.userId);
            const existingIds = this.ownedPlanIds.get(params.userId) ?? [];
            this.ownedPlanIds.set(params.userId, [...existingIds, persistedPlanId]);
        }
        return summary;
    }
    async saveAdaptivePass(params) {
        const current = this.states.get(params.persistedPlanId);
        const ownerUserId = this.owners.get(params.persistedPlanId);
        if (!current || ownerUserId !== params.ownerUserId) {
            throw new Error("Persisted vNext plan not found");
        }
        const next = {
            ...current,
            currentVersionNumber: params.result.applied
                ? (params.result.finalPlan.versionMetadata?.versionNumber ?? current.currentVersionNumber + 1)
                : current.currentVersionNumber,
            latestHistoryEntryId: params.result.historyEntry.entryId,
        };
        this.states.set(params.persistedPlanId, next);
        this.histories.set(params.persistedPlanId, [...(this.histories.get(params.persistedPlanId) ?? []), params.result.historyEntry]);
        this.plans.set(params.persistedPlanId, params.result.finalPlan);
        return next;
    }
    async getPlanState(planId) {
        return this.states.get(planId) ?? null;
    }
    async getCurrentPlan(planId, ownerUserId) {
        const state = this.states.get(planId);
        const plan = this.plans.get(planId);
        const storedOwnerUserId = this.owners.get(planId);
        if (!state || !plan || storedOwnerUserId !== ownerUserId) {
            return null;
        }
        return {
            persistedPlanId: state.persistedPlanId,
            profileId: state.profileId,
            goalId: state.goalId,
            plan,
            versionMetadata: plan.versionMetadata,
            currentVersionNumber: state.currentVersionNumber,
            historySummary: historySummaryFromEntries(this.histories.get(planId) ?? []),
        };
    }
    async getLatestCurrentPlanForUser(ownerUserId) {
        const planIds = this.ownedPlanIds.get(ownerUserId) ?? [];
        const latestPlanId = planIds.at(-1);
        if (!latestPlanId) {
            return null;
        }
        return this.getCurrentPlan(latestPlanId, ownerUserId);
    }
}
exports.InMemoryVNextPlanRepository = InMemoryVNextPlanRepository;
