/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { api } from '@/lib/api'

import type {
  HomeLandingResponse,
  HomePageContentResponse,
  LandingStatsResponse,
} from './types'

// ============================================================================
// Home Page APIs
// ============================================================================

/**
 * Get custom home page content
 * Returns Markdown/HTML content or iframe URL
 */
export async function getHomePageContent(): Promise<HomePageContentResponse> {
  // See getNotice in @/lib/api: the global `Cache-Control: no-store` is dropped
  // so the browser can hold an ETag and revalidate, letting the server answer
  // 304. Server-side `no-cache` keeps admin edits immediate.
  const res = await api.get('/api/home_page_content', {
    headers: { 'Cache-Control': null },
  })
  return res.data
}

/**
 * Get the landing page decoration config.
 *
 * Fields left empty by the administrator fall back to the built-in localized
 * defaults, so the landing page always renders without admin configuration.
 */
export async function getHomeLandingConfig(): Promise<HomeLandingResponse> {
  const res = await api.get('/api/home_landing', {
    headers: { 'Cache-Control': null },
    skipErrorHandler: true,
  })
  return res.data
}

/**
 * Get the aggregated landing page statistics.
 *
 * The server keeps this snapshot in memory and refreshes it in the background,
 * so polling it never touches the log table on the request path.
 */
export async function getLandingStats(): Promise<LandingStatsResponse> {
  const res = await api.get('/api/landing_stats', {
    skipErrorHandler: true,
  })
  return res.data
}

/** Report one landing page visit; the server batches these before persisting. */
export async function recordLandingVisit(): Promise<void> {
  await api.post('/api/landing_visit', undefined, {
    skipErrorHandler: true,
  })
}
