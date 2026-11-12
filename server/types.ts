/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Platform = 'instagram' | 'tiktok' | 'facebook';

export interface RecentPost {
  caption?: string;
  likes?: number | string;
  comments?: number | string;
  views?: number | string;
  url?: string;
}

export type CompletenessLevel = 'full' | 'partial' | 'none';

export type AdviceCategory = 'bio' | 'content' | 'community' | 'trust' | 'growth' | 'engagement';
export type AdvicePriority = 'high' | 'medium' | 'low';

export interface AdviceItem {
  id: string;
  category: AdviceCategory;
  title: string;
  description: string;
  priority: AdvicePriority;
  actionableStep: string;
}

export interface ProfileAdvice {
  overallScore?: number;
  summary: string;
  tips: AdviceItem[];
  aiGenerated?: boolean;
}

export interface ProfileData {
  platform: Platform;
  handle: string;
  url: string;
  displayName?: string;
  bio?: string;
  externalLink?: string;
  followers?: number | string;
  following?: number | string;
  postsCount?: number | string;
  totalLikes?: number | string;
  verified?: boolean;
  avatarUrl?: string;
  recentPosts: RecentPost[];
  completeness: CompletenessLevel;
  missingFields: string[];
  warnings: string[];
  advice?: ProfileAdvice;
}

export interface ParsedProfileUrl {
  platform: Platform;
  handle: string;
  normalizedUrl: string;
  originalUrl: string;
}
