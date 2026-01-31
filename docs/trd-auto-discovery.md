# Technical Requirements Document (TRD) - Auto Discovery

## 1. Architecture Overview
The Auto Discovery feature introduces an asynchronous, event-driven architecture to resource management. Instead of the frontend directly querying AWS APIs (synchronous), a serverless backend process syncs data to DynamoDB, and the frontend queries DynamoDB (fast, pagination-ready).

### High-Level Diagram
```mermaid
graph TD
    Trigger[EventBridge Logic] -->|Cron Rate(1 hour)| DiscoveryLambda[Discovery Lambda]
    UI[Web UI] -->|Trigger Sync| API[Next.js API]
    API -->|Invoke| DiscoveryLambda
    
    DiscoveryLambda -->|Scan| DDB_Account[Get Active Accounts]
    DiscoveryLambda -->|AssumeRole| TargetAWS[Target AWS Account]
    TargetAWS -->|Return Resources| DiscoveryLambda
    
    DiscoveryLambda -->|BatchWrite| DDB_Resource[DynamoDB Resource Table]
```

## 2. Data Model Changes (DynamoDB)

We need to elevate `RESOURCE` to be a top-level entity associated with an ACCOUNT, not just a SCHEDULE.

### New Entity: Resource Inventory
*   **PK**: `TENANT#{tenantId}`
*   **SK**: `RESOURCE#{resourceArn}` (Using ARN ensures global uniqueness and prevents collisions)
*   **GSI1PK**: `ACCOUNT#{accountId}` (Enable querying all resources for an account)
*   **GSI1SK**: `RESOURCE#{resourceType}#{resourceId}` (Enable sorting/filtering by type)
*   **Attributes**:
    *   `resourceId`: string (Instance ID, Service Name, etc.)
    *   `resourceType`: enum ('ec2', 'rds', 'ecs', 'asg')
    *   `name`: string (Tag:Name or identifier)
    *   `region`: string
    *   `state`: string (running, stopped, etc.)
    *   `tags`: map (key-value pairs)
    *   `lastSeenAt`: ISO Timestamp
    *   `discoveryStatus`: 'active' | 'missing'

## 3. Component Design

### 3.1. Discovery Lambda (`lambda/discovery`)
A new Lambda function dedicated to inventory syncing.
*   **Input**: `{ accountId?: string, force?: boolean }`
    *   If `accountId` provided: Sync single account (Manual Trigger/Onboarding).
    *   If no input: Sync ALL active accounts (Cron Trigger).
*   **Logic**:
    1.  If "All": Query `GSI1 (TYPE#ACCOUNT)` to get all active accounts.
    2.  Check `lastSyncedAt`. If < Threshold (e.g., 5 mins) and not forced, skip.
    3.  Loop through accounts:
        *   Get Credentials (AssumeRole matches `AccountService` logic).
        *   Call `AccountService.scanResources` (Refactor this to be shared logic accessible by Lambda).
        *   Compare with existing DB Records (fetch all active resources for account from DB).
        *   **Diffing**:
            *   **Create**: In Scan, not in DB. -> `PutItem`
            *   **Update**: In Scan, in DB. -> `UpdateItem` (update tags, state, lastSeenAt).
            *   **Delete**: In DB, not in Scan. -> `UpdateItem` (set `discoveryStatus` = 'missing').
    4.  Update Account `lastSyncedAt` timestamp.

### 3.2. Shared Logic Refactoring
*   Move `AccountService.scanResources` from `web-ui/lib/account-service.ts` to a shared Lambda Layer or a shared directory that can be bundled into the Lambda.
*   *Alternative*: Duplicate logic for now if "Shared Layer" infrastructure is too complex for this iteration, but ideally creating a `lib/aws-utils` shared package is better.
*   *Recommended Approach*: Since this is a CDK repo, we can create a local local module or just copy the scanning logic to the Lambda code to keep it isolated and serverless-native.

### 3.3. API Updates
*   **GET /api/accounts/[id]/resources**
    *   **Old**: Calls `AccountService.scanResources` (Live AWS calls).
    *   **New**: Queries DynamoDB GSI1 (`ACCOUNT#{id}`).
        *   Pros: Fast, supports pagination, filtering.
        *   Cons: Data might be up to 1 hour stale (mitigated by "Sync Now").
*   **POST /api/accounts/[id]/sync**
    *   Invokes `DiscoveryLambda` with payload `{ accountId: "..." }`.
    *   Returns 202 Accepted.

## 4. Infrastructure (CDK)
*   **New Stack**: `DiscoveryStack` (or add to `ComputeStack` / `WebUIStack`?).
*   **Resources**:
    *   Lambda Function: `NodejsFunction` (Node 20/22).
    *   EventBridge Rule: `Rule` with `Schedule.rate(Duration.hours(1))`.
    *   IAM Permissions:
        *   `sts:AssumeRole` on `*` (constrained by Trust Policies in target accounts).
        *   DynamoDB `Read/Write` access.

## 5. Security
*   **Least Privilege**: The Lambda only needs `sts:AssumeRole`. It does not need direct EC2/RDS permissions on the management account (unless management account is also a target).
*   **Isolation**: The discovery process creates a valid "cache" but does not perform mutation (Start/Stop) on resources.

## 6. Implementation Plan
1.  **Refactor**: Extract `scanResources` logic to be reusable.
2.  **Infrastructure**: Add `DiscoveryLambda` and EventBridge rule in CDK.
3.  **Backend**: Implement the Lambda handler (Scan -> Diff -> Write).
4.  **API**: Update API routes to read from DB and trigger Lambda.
5.  **UI**: Update Resource List component to use new DB-backed API and show Sync status.
