
import { ScheduleService } from "@/lib/schedule-service";
import { UISchedule, SearchParams } from "@/lib/types";
import { SchedulesPageClient } from "./schedules-page-client";

// Server-side data fetching with filters
async function getSchedulesData(filters?: {
  statusFilter?: string;
  resourceFilter?: string;
  searchTerm?: string;
}): Promise<{ schedules: UISchedule[], error?: string }> {
  try {
    const schedules = await ScheduleService.getSchedules(filters);
    return { schedules };
  } catch (error: any) {
    console.error('Server-side error fetching schedules:', error);
    return { 
      schedules: [], 
      error: error instanceof Error ? error.message : 'Failed to load schedules' 
    };
  }
}

export default async function SchedulesPage({ searchParams }: { searchParams: SearchParams }) {
  searchParams = await searchParams
  // Extract filters from URL parameters
  const statusFilter = typeof searchParams.status === 'string' ? searchParams.status : 'all';
  const resourceFilter = typeof searchParams.resource === 'string' ? searchParams.resource : 'all';
  const searchTerm = typeof searchParams.search === 'string' ? searchParams.search : '';
  
  // Fetch filtered schedules from the server side
  const { schedules, error } = await getSchedulesData({
    statusFilter: statusFilter !== 'all' ? statusFilter : undefined,
    resourceFilter: resourceFilter !== 'all' ? resourceFilter : undefined,
    searchTerm: searchTerm || undefined
  });

  // Calculate server-side summary statistics
  const stats = {
    total: schedules.length,
    active: schedules.filter((s) => s.active).length,
    inactive: schedules.filter((s) => !s.active).length,
    totalSavings: schedules.reduce(
      (sum, s) => sum + (s.estimatedSavings || 0),
      0
    ),
  };

  return (
    <SchedulesPageClient 
      initialSchedules={schedules} 
      initialError={error} 
      stats={stats}
      initialFilters={{
        statusFilter,
        resourceFilter,
        searchTerm
      }}
    />
  )
}
