"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Save, Loader2, AlertCircle } from "lucide-react";
import { ClientAccountService } from "@/lib/client-account-service";

const createAccountSchema = z.object({
  accountId: z
    .string()
    .min(12, "Account ID must be 12 digits")
    .max(12, "Account ID must be 12 digits")
    .regex(/^\d+$/, "Account ID must contain only numbers"),
  name: z
    .string()
    .min(1, "Account name is required")
    .max(100, "Account name must be less than 100 characters"),
  roleArn: z
    .string()
    .min(1, "Role ARN is required")
    .regex(/^arn:aws:iam::\d{12}:role\/.*/, "Invalid Role ARN format"),
  description: z.string().optional(),
  regions: z.array(z.string()).min(1, "At least one region must be selected"),
  active: z.boolean(),
});

type CreateAccountFormValues = z.infer<typeof createAccountSchema>;

const AWS_REGIONS = [
  { id: "us-east-1", name: "US East (N. Virginia)" },
  { id: "us-east-2", name: "US East (Ohio)" },
  { id: "us-west-1", name: "US West (N. California)" },
  { id: "us-west-2", name: "US West (Oregon)" },
  { id: "ap-south-1", name: "Asia Pacific (Mumbai)" },
  { id: "ap-southeast-1", name: "Asia Pacific (Singapore)" },
  { id: "ap-southeast-2", name: "Asia Pacific (Sydney)" },
  { id: "ap-northeast-1", name: "Asia Pacific (Tokyo)" },
  { id: "eu-west-1", name: "Europe (Ireland)" },
  { id: "eu-central-1", name: "Europe (Frankfurt)" },
];

export function CreateAccountForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const form = useForm<CreateAccountFormValues>({
    resolver: zodResolver(createAccountSchema),
    defaultValues: {
      accountId: "",
      name: "",
      roleArn: "",
      description: "",
      regions: ["us-east-1"],
      active: true,
    },
  });

  const onSubmit = async (data: CreateAccountFormValues) => {
    try {
      setLoading(true);

      await ClientAccountService.createAccount({
        accountId: data.accountId,
        name: data.name,
        roleArn: data.roleArn,
        regions: data.regions,
        active: true, // Default to active
        description: data.description || "",
        createdBy: "user", // TODO: Get from auth context
        updatedBy: "user",
      });

      // Redirect to accounts list
      router.push("/accounts");
    } catch (error) {
      console.error("Failed to create account:", error);
      // TODO: Show error toast
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5" />
              <span>Basic Information</span>
            </CardTitle>
            <CardDescription>
              Configure the basic AWS account details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="accountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>AWS Account ID</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="123456789012"
                        maxLength={12}
                      />
                    </FormControl>
                    <FormDescription>
                      12-digit AWS account identifier
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Production Account" />
                    </FormControl>
                    <FormDescription>
                      Friendly name for this account
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="roleArn"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cross-Account Role ARN</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="arn:aws:iam::123456789012:role/CrossAccountRoleForCostOptimizationScheduler"
                    />
                  </FormControl>
                  <FormDescription>
                    The ARN of the IAM role that allows cross-account access for
                    cost optimization
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Description of this AWS account..."
                      rows={3}
                    />
                  </FormControl>
                  <FormDescription>
                    Additional details about this account
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active Account</FormLabel>
                    <FormDescription>
                      Enable cost optimization scheduling for this account
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Regions */}
        <Card>
          <CardHeader>
            <CardTitle>AWS Regions</CardTitle>
            <CardDescription>
              Select the AWS regions where cost optimization should be applied
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="regions"
              render={() => (
                <FormItem>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {AWS_REGIONS.map((region) => (
                      <FormField
                        key={region.id}
                        control={form.control}
                        name="regions"
                        render={({ field }) => {
                          return (
                            <FormItem
                              key={region.id}
                              className="flex flex-row items-start space-x-3 space-y-0"
                            >
                              <FormControl>
                                <Checkbox
                                  // checked={field.value?.includes(region.id)}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([
                                        ...field.value,
                                        region.id,
                                      ])
                                      : field.onChange(
                                        field.value?.filter(
                                          (value) => value !== region.id
                                        )
                                      );
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="text-sm font-normal">
                                <div>{region.id}</div>
                                <div className="text-xs text-muted-foreground">
                                  {region.name}
                                </div>
                              </FormLabel>
                            </FormItem>
                          );
                        }}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            Create Account
          </Button>
        </div>
      </form>
    </Form>
  );
}
