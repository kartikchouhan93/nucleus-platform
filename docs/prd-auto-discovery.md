# Product Requirement Document (PRD) - Auto Discovery of AWS Resources

## 1. Introduction
The "Auto Discovery" feature is a core enhancement to Nucleus Ops that enables the platform to automatically discover, catalog, and track AWS resources (EC2, RDS, ECS, ASG) across all integrated accounts without manual intervention. This moves the platform from an "on-demand scan" model to a "persistent inventory" model.

## 2. Problem Statement
*   **Performance**: listing resources in real-time via API (current `scanResources` implementation) is slow and prone to timeouts for large accounts.
*   **User Experience**: Users have to wait for scans to complete before creating schedules.
*   **Stale Data**: Without automatic background syncing, users may not see new resources unless they manually trigger a scan.
*   **Lack of Inventory**: There is no central view or "inventory" of all managed resources across accounts; resources are currently only visible when attached to a schedule.

## 3. Goals & Objectives
*   **Automated Sync**: Automatically sync resources from all active accounts on a configurable schedule (default: every 60 minutes).
*   **Persistent Inventory**: Maintain a local copy of resource metadata in DynamoDB for instant searching and filtering.
*   **Drift Detection**: Automatically detect when resources are created, deleted, or modified in the target AWS accounts.
*   **Scalability**: Support syncing hundreds of resources across multiple accounts without impacting UI performance.

## 4. User Stories
*   **As a User**, I want my AWS resources to appear in the dashboard automatically after I create them in the AWS Console, so I can schedule them without manual steps.
*   **As a User**, I want to search and filter resources instantly when creating a schedule, without waiting for a live AWS API call.
*   **As a User**, I want to see a "Last Synced" timestamp for each account to know how fresh the data is.
*   **As a User**, I want to manually trigger a "Sync Now" for an account if I know I just added resources.

## 5. Functional Requirements

### 5.1. Resource Discovery Engine
*   **Background process** (Lambda) must run periodically (Cron).
*   **Scope**: Must iterate through all accounts with `active` status.
*   **Resource Types**: Support EC2 Instances, RDS Instances/Clusters, ECS Services, and Auto Scaling Groups.
*   **Metadata**: Capture Name, ID, ARN, Type, Status (Running/Stopped), Region, and Tags.

### 5.2. Inventory Management
*   **Persistence**: Store discovered resources in the `APP_TABLE` with a link to their parent Account.
*   **Lifecycle**:
    *   **New**: Add new records for resources found in AWS but not in DB.
    *   **Update**: Update metadata (tags, state) for existing resources.
    *   **Delete/Mark Inactive**: If a resource is no longer found in AWS, mark it as `inactive` or `deleted` in the DB.

### 5.3. API & UI Updates
*   **List Resources API**: Update `GET /api/accounts/{id}/resources` to query DynamoDB instead of calling AWS SDK directly.
*   **Sync API**: New endpoint `POST /api/accounts/{id}/sync` to trigger an immediate async discovery for a specific account.
*   **UI**:
    *   Show "Last Synced: <Timestamp>" on Account cards.
    *   Show a "Syncing..." spinner when manual sync is triggered.

## 6. Non-Functional Requirements
*   **Consistency**: Inventory should be eventually consistent (max 1 hour delay by default).
*   **Error Handling**: Failures in one account sync should not break the entire batch.
*   **Rate Limiting**: Discovery process must respect AWS API rate limits (exponential backoff).
