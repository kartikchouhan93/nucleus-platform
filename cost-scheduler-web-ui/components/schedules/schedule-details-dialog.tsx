"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Clock,
  Calendar,
  Users,
  TrendingUp,
  DollarSign,
  Tag,
  Activity,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { formatDate } from "@/lib/date-utils";

interface ScheduleDetailsDialogProps {
  schedule: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Mock execution history
const mockExecutionHistory = [
  {
    id: "exec-001",
    timestamp: "2024-01-15T22:00:00Z",
    status: "success",
    duration: 45,
    resourcesAffected: 12,
    savings: 85,
    details: "Successfully stopped 12 RDS instances across 2 accounts",
  },
  {
    id: "exec-002",
    timestamp: "2024-01-14T22:00:00Z",
    status: "success",
    duration: 38,
    resourcesAffected: 11,
    savings: 78,
    details: "Successfully stopped 11 RDS instances across 2 accounts",
  },
  {
    id: "exec-003",
    timestamp: "2024-01-13T22:00:00Z",
    status: "partial",
    duration: 52,
    resourcesAffected: 10,
    savings: 65,
    details:
      "Stopped 10 of 12 RDS instances. 2 instances had active connections.",
  },
  {
    id: "exec-004",
    timestamp: "2024-01-12T22:00:00Z",
    status: "success",
    duration: 41,
    resourcesAffected: 12,
    savings: 85,
    details: "Successfully stopped 12 RDS instances across 2 accounts",
  },
  {
    id: "exec-005",
    timestamp: "2024-01-11T22:00:00Z",
    status: "error",
    duration: 15,
    resourcesAffected: 0,
    savings: 0,
    details: "Failed to assume role in prod-account-2. Check IAM permissions.",
  },
];

export function ScheduleDetailsDialog({
  schedule,
  open,
  onOpenChange,
}: ScheduleDetailsDialogProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "error":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "partial":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return (
          <Badge
            variant="default"
            className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
          >
            Success
          </Badge>
        );
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      case "partial":
        return (
          <Badge
            variant="secondary"
            className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100"
          >
            Partial
          </Badge>
        );
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>{schedule?.name}</span>
          </DialogTitle>
          <DialogDescription>{schedule?.description}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="configuration">Configuration</TabsTrigger>
            <TabsTrigger value="history">Execution History</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Status</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <Badge
                    variant={schedule.active ? "default" : "secondary"}
                    className={
                      schedule.active
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                        : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                    }
                  >
                    {schedule.active ? "Active" : "Inactive"}
                  </Badge>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Success Rate
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {schedule.successRate}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {schedule.executionCount} executions
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Monthly Savings
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${schedule.estimatedSavings}
                  </div>
                  <p className="text-xs text-muted-foreground">estimated</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Next Execution
                  </CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {schedule.nextExecution ? (
                    <div>
                      <div className="text-sm font-medium">
                        {formatDate(schedule.nextExecution)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(schedule.nextExecution, {
                          includeTime: true,
                        })}
                      </p>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Not scheduled
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Schedule Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Time Window</h4>
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {schedule.startTime} - {schedule.endTime} (
                        {schedule.timezone})
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Days of Week</h4>
                    <div className="flex flex-wrap gap-1">
                      {schedule.daysOfWeek.map((day: string) => (
                        <Badge key={day} variant="outline">
                          {day}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Target Accounts</h4>
                    <div className="flex items-center space-x-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{schedule.accounts.length} AWS accounts</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {schedule.accounts.join(", ")}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Resource Types</h4>
                    <div className="flex flex-wrap gap-1">
                      {schedule.resourceTypes.map((type: string) => (
                        <Badge key={type} variant="secondary">
                          {type}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="configuration" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Schedule Configuration</CardTitle>
                <CardDescription>
                  Detailed configuration settings for this schedule
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium mb-2">
                        Basic Information
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Name:</span>
                          <span>{schedule.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Description:
                          </span>
                          <span className="text-right max-w-[200px]">
                            {schedule.description}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Status:</span>
                          <Badge
                            variant={schedule.active ? "default" : "secondary"}
                          >
                            {schedule.active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium mb-2">Timing</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Start Time:
                          </span>
                          <span>{schedule.startTime}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            End Time:
                          </span>
                          <span>{schedule.endTime}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Timezone:
                          </span>
                          <span>{schedule.timezone}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium mb-2">
                        Resource Filtering
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">
                            Include Tags:
                          </span>
                          <div className="mt-1">
                            {schedule.resourceTags ? (
                              <div className="flex flex-wrap gap-1">
                                {schedule.resourceTags
                                  .split(",")
                                  .map((tag: string, index: number) => (
                                    <Badge
                                      key={index}
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      <Tag className="h-3 w-3 mr-1" />
                                      {tag.trim()}
                                    </Badge>
                                  ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">
                                None
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Exclude Tags:
                          </span>
                          <div className="mt-1">
                            {schedule.excludeTags ? (
                              <div className="flex flex-wrap gap-1">
                                {schedule.excludeTags
                                  .split(",")
                                  .map((tag: string, index: number) => (
                                    <Badge
                                      key={index}
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      <Tag className="h-3 w-3 mr-1" />
                                      {tag.trim()}
                                    </Badge>
                                  ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">
                                None
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium mb-2">Metadata</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Created:
                          </span>
                          <span>{formatDate(schedule.createdAt)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Created By:
                          </span>
                          <span>{schedule.createdBy}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Last Updated:
                          </span>
                          <span>{formatDate(schedule.updatedAt)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Updated By:
                          </span>
                          <span>{schedule.updatedBy}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Execution History</CardTitle>
                <CardDescription>
                  Recent executions of this schedule
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockExecutionHistory.map((execution) => (
                    <div
                      key={execution.id}
                      className="flex items-start space-x-4 p-4 border rounded-lg"
                    >
                      <div className="flex-shrink-0 mt-1">
                        {getStatusIcon(execution.status)}
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            {getStatusBadge(execution.status)}
                            <span className="text-sm font-medium">
                              {formatDate(execution.timestamp, {
                                includeTime: true,
                              })}
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Duration: {execution.duration}s
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {execution.details}
                        </p>
                        <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                          <span>Resources: {execution.resourcesAffected}</span>
                          <span>Savings: ${execution.savings}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Executions
                  </CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {schedule.executionCount}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    since creation
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Success Rate
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {schedule.successRate}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {Math.round(
                      (schedule.successRate / 100) * schedule.executionCount
                    )}{" "}
                    successful
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Savings
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    ${(schedule.estimatedSavings * 3).toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">last 3 months</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>Detailed performance analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <h4 className="text-sm font-medium mb-2">
                        Execution Statistics
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Average Duration:
                          </span>
                          <span>42 seconds</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Fastest Execution:
                          </span>
                          <span>28 seconds</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Slowest Execution:
                          </span>
                          <span>65 seconds</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-2">
                        Resource Impact
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Avg Resources Affected:
                          </span>
                          <span>11.2 per execution</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Total Resources Managed:
                          </span>
                          <span>504</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Avg Savings per Run:
                          </span>
                          <span>$78</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
