import { Prisma } from "@prisma/client";
import type { Goal, RunnerProfile } from "../../types";
import { prisma } from "../../db";
import type {
  EnginePlan,
  PlanMutationHistoryEntry,
  VNextAdaptivePassResult,
} from "../../engine-v2/models";

export interface PersistedVNextPlanSummary {
  persistedPlanId: string;
  profileId: string;
  goalId?: string;
  currentVersionNumber: number;
  latestHistoryEntryId?: string;
}

export interface PersistedVNextHistorySummaryItem {
  entryId: string;
  resultingVersionNumber: number;
  mutationType: PlanMutationHistoryEntry["mutation"]["mutationType"];
  applied: boolean;
  fallback: boolean;
}

export interface PersistedVNextCurrentPlan {
  persistedPlanId: string;
  profileId: string;
  goalId?: string;
  plan: EnginePlan;
  versionMetadata?: EnginePlan["versionMetadata"];
  currentVersionNumber: number;
  historySummary: PersistedVNextHistorySummaryItem[];
}

export interface SaveGeneratedVNextPlanParams {
  userId?: string | null;
  profileId?: string;
  runnerProfile: RunnerProfile;
  goal: Goal;
  plan: EnginePlan;
}

export interface SaveAdaptiveVNextPassParams {
  persistedPlanId: string;
  ownerUserId: string;
  result: VNextAdaptivePassResult;
}

export interface VNextPlanRepository {
  saveGeneratedPlan(params: SaveGeneratedVNextPlanParams): Promise<PersistedVNextPlanSummary>;
  saveAdaptivePass(params: SaveAdaptiveVNextPassParams): Promise<PersistedVNextPlanSummary>;
  getPlanState(planId: string): Promise<PersistedVNextPlanSummary | null>;
  getCurrentPlan(planId: string, ownerUserId: string): Promise<PersistedVNextCurrentPlan | null>;
  getLatestCurrentPlanForUser(ownerUserId: string): Promise<PersistedVNextCurrentPlan | null>;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function toGoalRecord(goal: Goal) {
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

function toProfileRecord(runnerProfile: RunnerProfile) {
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
    recentRaceTimesJson: runnerProfile.recentRaceTimes ? toJsonValue(runnerProfile.recentRaceTimes) : Prisma.JsonNull,
    injuryHistory: runnerProfile.injuryHistory,
    weakPoints: runnerProfile.weakPoints,
    realisticTrainingDaysPerWeek: runnerProfile.realisticTrainingDaysPerWeek,
    typicalWorkoutMinutes: runnerProfile.typicalWorkoutMinutes,
    otherTraining: runnerProfile.otherTraining,
    preferredGuidance: runnerProfile.preferredGuidance,
  };
}

function buildPlanSummary(record: {
  id: string;
  profileId: string;
  goalId: string | null;
  currentVersionNumber: number;
  latestHistoryEntryId: string | null;
}): PersistedVNextPlanSummary {
  return {
    persistedPlanId: record.id,
    profileId: record.profileId,
    goalId: record.goalId ?? undefined,
    currentVersionNumber: record.currentVersionNumber,
    latestHistoryEntryId: record.latestHistoryEntryId ?? undefined,
  };
}

function historySummaryFromEntries(entries: PlanMutationHistoryEntry[]): PersistedVNextHistorySummaryItem[] {
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

async function resolveProfile(params: SaveGeneratedVNextPlanParams): Promise<{ id: string }> {
  const profileData = toProfileRecord(params.runnerProfile);

  if (params.profileId) {
    return prisma.runnerProfile.upsert({
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
    return prisma.runnerProfile.upsert({
      where: { userId: params.userId },
      update: profileData,
      create: {
        ...profileData,
        userId: params.userId,
      },
      select: { id: true },
    });
  }

  return prisma.runnerProfile.create({
    data: profileData,
    select: { id: true },
  });
}

export function createPrismaVNextPlanRepository(): VNextPlanRepository {
  const prismaClient = prisma as any;
  return {
    async saveGeneratedPlan(params) {
      const profile = await resolveProfile(params);
      const goal = await prisma.goal.create({
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

      const historyEntry: PlanMutationHistoryEntry = params.result.historyEntry;

      await prisma.$transaction(async (tx) => {
        const transactionClient = tx as any;
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

      const historyEntries = planState.history.map((item: any) => ({
        entryId: item.entryId,
        sourceVersionNumber: item.sourceVersionNumber,
        resultingVersionNumber: item.resultingVersionNumber,
        feedback: (item.feedbackJson ?? {}) as PlanMutationHistoryEntry["feedback"],
        decision: (item.decisionJson ?? {}) as PlanMutationHistoryEntry["decision"],
        mutation: (item.mutationJson ?? {}) as PlanMutationHistoryEntry["mutation"],
        validation: (item.validationJson ?? {}) as PlanMutationHistoryEntry["validation"],
        applied: item.applied,
        fallback: item.fallback,
      })) as PlanMutationHistoryEntry[];

      return {
        persistedPlanId: planState.id,
        profileId: planState.profileId,
        goalId: planState.goalId ?? undefined,
        plan: currentVersion.snapshotJson as EnginePlan,
        versionMetadata: (currentVersion.versionMetadataJson ?? undefined) as EnginePlan["versionMetadata"],
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

export class InMemoryVNextPlanRepository implements VNextPlanRepository {
  private planCounter = 1;
  private profileCounter = 1;
  private goalCounter = 1;
  private states = new Map<string, PersistedVNextPlanSummary>();
  private statesByLogicalKey = new Map<string, string>();
  private histories = new Map<string, PlanMutationHistoryEntry[]>();
  private plans = new Map<string, EnginePlan>();
  private owners = new Map<string, string>();
  private ownedPlanIds = new Map<string, string[]>();

  async saveGeneratedPlan(params: SaveGeneratedVNextPlanParams): Promise<PersistedVNextPlanSummary> {
    const persistedPlanId = `vnext_plan_${this.planCounter++}`;
    const profileId = params.profileId ?? `profile_${this.profileCounter++}`;
    const goalId = `goal_${this.goalCounter++}`;
    const summary: PersistedVNextPlanSummary = {
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

  async saveAdaptivePass(params: SaveAdaptiveVNextPassParams): Promise<PersistedVNextPlanSummary> {
    const current = this.states.get(params.persistedPlanId);
    const ownerUserId = this.owners.get(params.persistedPlanId);
    if (!current || ownerUserId !== params.ownerUserId) {
      throw new Error("Persisted vNext plan not found");
    }

    const next: PersistedVNextPlanSummary = {
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

  async getPlanState(planId: string): Promise<PersistedVNextPlanSummary | null> {
    return this.states.get(planId) ?? null;
  }

  async getCurrentPlan(planId: string, ownerUserId: string): Promise<PersistedVNextCurrentPlan | null> {
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

  async getLatestCurrentPlanForUser(ownerUserId: string): Promise<PersistedVNextCurrentPlan | null> {
    const planIds = this.ownedPlanIds.get(ownerUserId) ?? [];
    const latestPlanId = planIds.at(-1);
    if (!latestPlanId) {
      return null;
    }
    return this.getCurrentPlan(latestPlanId, ownerUserId);
  }
}
