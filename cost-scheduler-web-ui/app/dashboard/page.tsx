"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity,
  Download,
  RefreshCw,
  Filter,
  Search,
  AlertTriangle,
  CheckCircle,
  XCircle,
  User,
  Server,
} from "lucide-react";
import { AuditLogsTable } from "@/components/audit/audit-logs-table";
import { AuditLogsChart } from "@/components/audit/audit-logs-chart";
import { ExportAuditDialog } from "@/components/audit/export-audit-dialog";
import { AuditFilters } from "@/components/audit/audit-filters";
import { addDays } from "date-fns";
import { AuditLog } from "@/lib/types";
import { ClientAuditService, AuditLogFilters } from "@/lib/client-audit-service";
import type { DateRange } from "react-day-picker";
import { useRouter } from "next/navigation";

interface AuditStats {
  totalLogs: number;
  errorCount: number;
  warningCount: number;
  successCount: number;
}

export default function AuditPage() {
  const router = useRouter();
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats>({
    totalLogs: 0,
    errorCount: 0,
    warningCount: 0,
    successCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEventType, setSelectedEventType] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: addDays(new Date(), -7),
    to: new Date(),
  });
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Fetch audit logs and stats
  const fetchAuditData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build filters
      const filters: AuditLogFilters = {};
      if (selectedEventType !== "all") filters.eventType = selectedEventType;
      if (selectedStatus !== "all") filters.status = selectedStatus;
      if (selectedUser !== "all") filters.user = selectedUser;
      if (dateRange?.from) filters.startDate = dateRange.from.toISOString();
      if (dateRange?.to) filters.endDate = dateRange.to.toISOString();

      // Fetch logs and stats in parallel
      const [logsResponse, statsResponse] = await Promise.all([
        ClientAuditService.getAuditLogs(filters),
        ClientAuditService.getAuditLogStats(filters),
      ]);

      setAuditLogs(logsResponse);

      // Map stats response to expected interface
      const mappedStats: AuditStats = {
        totalLogs: statsResponse.totalLogs || 0,
        errorCount: statsResponse.errorCount || 0,
        warningCount: statsResponse.warningCount || 0,
        successCount: statsResponse.successCount || 0,
      };

      setStats(mappedStats);
    } catch (err) {
      console.error("Error fetching audit data:", err);
      setError("Failed to load audit data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchAuditData();
  }, []);

  // Filter logs based on search term and other filters
  useEffect(() => {
    let filtered = auditLogs;

    if (searchTerm) {
      const lowercaseSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (log) =>
          log.action.toLowerCase().includes(lowercaseSearch) ||
          log.user.toLowerCase().includes(lowercaseSearch) ||
          log.resource.toLowerCase().includes(lowercaseSearch) ||
          log.details.toLowerCase().includes(lowercaseSearch)
      );
    }

    setFilteredLogs(filtered);
  }, [auditLogs, searchTerm]);

  // Refresh data when filters change
  useEffect(() => {
    fetchAuditData();
  }, [selectedEventType, selectedStatus, selectedUser, dateRange]);

  const handleRefresh = () => {
    fetchAuditData();
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedEventType("all");
    setSelectedStatus("all");
    setSelectedUser("all");
    setDateRange({
      from: addDays(new Date(), -7),
      to: new Date(),
    });
  };

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range);
  };

  // Get unique values for filter dropdowns with proper formatting
  const uniqueEventTypes = Array.from(
    new Set(auditLogs.map((log) => log.eventType))
  ).map((eventType) => ({
    value: eventType,
    label: eventType
      .split(".")
      .map((part) => part.replace(/_/g, " "))
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" → "),
  }));

  const uniqueUsers = Array.from(new Set(auditLogs.map((log) => log.user)));

  // Helper function to get the display label for selected event type
  const getEventTypeLabel = (value: string) => {
    if (value === "all") return "All Events";
    const eventType = uniqueEventTypes.find((type) => type.value === value);
    return eventType ? eventType.label : value;
  };

  // Helper function to get the display label for selected status
  const getStatusLabel = (value: string) => {
    if (value === "all") return "All Statuses";
    return value.charAt(0).toUpperCase() + value.slice(1);
  };

  // Helper function to get the display label for selected user
  const getUserLabel = (value: string) => {
    if (value === "all") return "All Users";
    return value;
  };

  const handleCreateAccount = () => {
    router.push("/accounts/create");
  };

  const handleCreateSchedule = () => {
    router.push("/schedules/create");
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
            <p className="text-muted-foreground">
              Monitor and track all system activities and events
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading audit data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
            <p className="text-muted-foreground">
              Monitor and track all system activities and events
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 font-medium">{error}</p>
            <Button onClick={handleRefresh} className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground">
            Monitor and track all system activities and events
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={handleRefresh} disabled={loading}>
            <RefreshCw
              className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button onClick={() => setExportDialogOpen(true)}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalLogs}</div>
            <p className="text-xs text-muted-foreground">audit log entries</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Successful Events
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {stats.successCount}
            </div>
            <p className="text-xs text-muted-foreground">
              completed successfully
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Warning Events
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {stats.warningCount}
            </div>
            <p className="text-xs text-muted-foreground">
              completed with warnings
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Events</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {stats.errorCount}
            </div>
            <p className="text-xs text-muted-foreground">
              failed or encountered errors
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={handleCreateAccount}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Create Account
            </CardTitle>
            <Plus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Add a new AWS account for cost optimization
            </p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={handleCreateSchedule}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Create Schedule
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Define new operating hours schedule
            </p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => router.push("/accounts")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Manage Accounts
            </CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              View and configure AWS accounts
            </p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => router.push("/audit")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              View Audit Logs
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Monitor system activities and events
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Filters & Search</CardTitle>
              <CardDescription>
                Filter and search through audit log entries
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              >
                <Filter className="mr-2 h-4 w-4" />
                {showAdvancedFilters ? "Hide" : "Show"} Advanced
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Basic Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs by user, action, resource, or details..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <DatePickerWithRange
              date={dateRange}
              onDateChange={handleDateRangeChange}
              className="w-[300px]"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap gap-2">
            <Select
              value={selectedEventType}
              onValueChange={(value) => {
                console.log("Event type selected:", value);
                setSelectedEventType(value);
              }}
            >
              <SelectTrigger className="w-[280px]">
                <SelectValue>
                  {getEventTypeLabel(selectedEventType)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-w-[400px]">
                <SelectItem value="all">All Events</SelectItem>
                {uniqueEventTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center space-x-2 max-w-[350px]">
                      <Activity className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{type.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedStatus}
              onValueChange={(value) => {
                console.log("Status selected:", value);
                setSelectedStatus(value);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue>{getStatusLabel(selectedStatus)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="success">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Success</span>
                  </div>
                </SelectItem>
                <SelectItem value="error">
                  <div className="flex items-center space-x-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span>Error</span>
                  </div>
                </SelectItem>
                <SelectItem value="warning">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <span>Warning</span>
                  </div>
                </SelectItem>
                <SelectItem value="info">
                  <div className="flex items-center space-x-2">
                    <Activity className="h-4 w-4 text-blue-500" />
                    <span>Info</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={selectedUser}
              onValueChange={(value) => {
                console.log("User selected:", value);
                setSelectedUser(value);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue>{getUserLabel(selectedUser)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {uniqueUsers.map((user) => (
                  <SelectItem key={user} value={user}>
                    <div className="flex items-center space-x-2">
                      {user === "system" ? (
                        <Server className="h-4 w-4" />
                      ) : (
                        <User className="h-4 w-4" />
                      )}
                      <span>{user}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Advanced Filters */}
          {showAdvancedFilters && <AuditFilters />}
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs defaultValue="table" className="space-y-4">
        <TabsList>
          <TabsTrigger value="table">Table View</TabsTrigger>
          <TabsTrigger value="chart">Chart View</TabsTrigger>
        </TabsList>

        <TabsContent value="table" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Audit Log Entries</CardTitle>
              <CardDescription>
                {filteredLogs.length} of {auditLogs.length} total entries
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AuditLogsTable logs={filteredLogs} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chart" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Audit Log Analytics</CardTitle>
              <CardDescription>
                Visual representation of audit log trends and patterns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AuditLogsChart logs={filteredLogs} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Export Dialog */}
      <ExportAuditDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        logs={filteredLogs}
      />
    </div>
  );
}
