"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import { EditScheduleForm } from "./edit-schedule-form";
import { ClientScheduleService } from "@/lib/client-schedule-service";
import { Schedule, UISchedule } from "@/lib/types";

interface EditSchedulePageProps {
  params: Promise<{
    name: string;
  }>;
}

export default function EditSchedulePage({ params }: EditSchedulePageProps) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [schedule, setSchedule] = useState<UISchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const scheduleName = decodeURIComponent(resolvedParams.name);

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        setLoading(true);
        setError(null);
        const scheduleData = await ClientScheduleService.getSchedule(scheduleName);
        if (!scheduleData) {
          setError("Schedule not found");
          return;
        }
        setSchedule(scheduleData);
      } catch (err) {
        console.error("Failed to fetch schedule:", err);
        setError("Failed to load schedule data");
      } finally {
        setLoading(false);
      }
    };

    fetchSchedule();
  }, [scheduleName]);

  if (loading) {
    return (
      <div className="w-full py-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading schedule...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !schedule) {
    return (
      <div className="w-full py-6">
        <div className="flex items-center justify-between mb-6">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
        <Card>
          <CardContent className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">
                {error || "Schedule not found"}
              </h3>
              <p className="text-muted-foreground mb-4">
                The schedule "{scheduleName}" could not be loaded.
              </p>
              <Button onClick={() => router.push("/schedules")}>
                Return to Schedules
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full py-6 overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Edit Schedule</h1>
            <p className="text-muted-foreground">
              Modify the schedule "{schedule.name}"
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Schedule Configuration</CardTitle>
          <CardDescription>
            Update the schedule settings and time configurations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EditScheduleForm schedule={schedule} />
        </CardContent>
      </Card>
    </div>
  );
}
