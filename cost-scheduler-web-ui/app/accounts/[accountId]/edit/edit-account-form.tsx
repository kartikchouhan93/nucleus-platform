"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Save,
  Server,
  Globe,
  CheckCircle,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { AccountService } from "@/lib/account-service";
import { UIAccount } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { ClientAccountService } from "@/lib/client-account-service";

const awsRegions = [
  { id: "us-east-1", name: "US East (N. Virginia)" },
  { id: "us-east-2", name: "US East (Ohio)" },
  { id: "us-west-1", name: "US West (N. California)" },
  { id: "us-west-2", name: "US West (Oregon)" },
  { id: "eu-west-1", name: "Europe (Ireland)" },
  { id: "eu-west-2", name: "Europe (London)" },
  { id: "eu-central-1", name: "Europe (Frankfurt)" },
  { id: "ap-south-1", name: "Asia Pacific (Mumbai)" },
  { id: "ap-southeast-1", name: "Asia Pacific (Singapore)" },
  { id: "ap-southeast-2", name: "Asia Pacific (Sydney)" },
  { id: "ap-northeast-1", name: "Asia Pacific (Tokyo)" },
];

interface EditAccountFormProps {
  account: UIAccount;
}

export function EditAccountForm({ account }: EditAccountFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    accountId: "",
    roleArn: "",
    description: "",
    regions: [] as string[],
    active: true,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Update form data when account changes
  useEffect(() => {
    if (account) {
      console.log("Updating form data with account:", account);
      setFormData({
        name: account.name || "",
        accountId: account.accountId || "",
        roleArn: account.roleArn || "",
        description: account.description || "",
        regions: account.regions || [],
        active: account.active ?? true,
      });
    }
  }, [account]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);

      // Update the account (excluding name as it cannot be changed)
      await ClientAccountService.updateAccount(account.accountId, {
        roleArn: formData.roleArn,
        description: formData.description,
        regions: formData.regions,
        active: formData.active,
      });

      toast({
        variant: "success",
        title: "Account Updated",
        description: "Account configuration updated successfully.",
      });

      // Navigate back to account view
      router.push(`/accounts`);
    } catch (error: any) {
      console.error("Error updating account:", error);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message || "Failed to update account.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegionToggle = (regionId: string) => {
    setFormData((prev) => ({
      ...prev,
      regions: prev.regions.includes(regionId)
        ? prev.regions.filter((r) => r !== regionId)
        : [...prev.regions, regionId],
    }));
  };

  const validateConnection = async () => {
    if (!formData.accountId || !formData.roleArn) {
      setValidationResult({
        success: false,
        message: "Please provide both Account ID and Role ARN",
      });
      return;
    }

    setIsValidating(true);
    setValidationResult(null);

    try {
      await AccountService.validateAccount(formData.accountId);
      setValidationResult({
        success: true,
        message: "Connection validated successfully",
      });
      toast({
        variant: "success",
        title: "Connection Validated",
        description: "Account connection validated successfully.",
      });
    } catch (error: any) {
      setValidationResult({
        success: false,
        message: error.message || "Connection validation failed",
      });
      toast({
        variant: "destructive",
        title: "Validation Failed",
        description: error.message || "Connection validation failed.",
      });
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="container mx-auto">

      <form
        id="edit-account-form"
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Server className="h-4 w-4" />
              <span>Account Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Account Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g., Production Account"
                  required
                  disabled // Account name cannot be changed as it's used as the primary identifier
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Account name cannot be changed as it's used as the primary
                  identifier
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountId">AWS Account ID *</Label>
                <Input
                  id="accountId"
                  value={formData.accountId}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      accountId: e.target.value,
                    }))
                  }
                  placeholder="123456789012"
                  pattern="[0-9]{12}"
                  maxLength={12}
                  required
                  disabled // Account ID should not be editable
                  className="bg-muted"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="roleArn">IAM Role ARN *</Label>
              <Input
                id="roleArn"
                value={formData.roleArn}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, roleArn: e.target.value }))
                }
                placeholder="arn:aws:iam::123456789012:role/CostOptimizationRole"
                required
              />
              <p className="text-xs text-muted-foreground">
                The IAM role that allows cross-account access for cost
                optimization
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Optional description for this account..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="active">Status</Label>
              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, active: checked }))
                  }
                />
                <Label htmlFor="active">
                  {formData.active ? "Active" : "Inactive"}
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Globe className="h-4 w-4" />
              <span>AWS Regions</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Select regions to manage *</Label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {awsRegions.map((region) => (
                  <div key={region.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={region.id}
                      checked={formData.regions.includes(region.id)}
                      onCheckedChange={() => handleRegionToggle(region.id)}
                    />
                    <Label htmlFor={region.id} className="text-sm">
                      <div className="font-medium">{region.id}</div>
                      <div className="text-xs text-muted-foreground">
                        {region.name}
                      </div>
                    </Label>
                  </div>
                ))}
              </div>
              {formData.regions.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm text-muted-foreground mb-2">
                    Selected regions:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {formData.regions.map((regionId) => (
                      <Badge
                        key={regionId}
                        variant="secondary"
                        className="text-xs"
                      >
                        {regionId}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Connection Validation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={validateConnection}
                disabled={
                  isValidating || !formData.accountId || !formData.roleArn
                }
              >
                {isValidating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Validating...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Test Connection
                  </>
                )}
              </Button>
              <p className="text-sm text-muted-foreground">
                Verify that the role can be assumed and has required permissions
              </p>
            </div>

            {validationResult && (
              <div
                className={`p-3 rounded-lg border ${
                  validationResult.success
                    ? "bg-green-50 border-green-200 text-green-800"
                    : "bg-red-50 border-red-200 text-red-800"
                }`}
              >
                <div className="flex items-center space-x-2">
                  {validationResult.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  )}
                  <span className="text-sm font-medium">
                    {validationResult.message}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Separator />

        <div className="flex justify-end space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              router.push(`/accounts/${encodeURIComponent(account.accountId)}`)
            }
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || formData.regions.length === 0}
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
