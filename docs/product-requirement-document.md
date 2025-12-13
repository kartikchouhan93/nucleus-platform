# Product Requirement Document (PRD) - Nucleus Platform

## 1. Introduction
Nucleus Platform is an enterprise-grade extension of the existing Cost Optimization Scheduler. It is designed to provide a centralized platform for managing and scheduling cost-saving operations across multiple AWS accounts. The platform allows users to integrate AWS accounts, define operational schedules, and audit resources and user actions.

## 2. Goals & Objectives
*   **Enterprise Grade**: Build a robust, scalable platform suitable for enterprise environments.
*   **Centralized Control**: Manage resources (ECS, EC2, RDS) across N AWS accounts from a single pane of glass.
*   **Auditability**: maintain complete transparency of user actions and automated execution logs.
*   **Automation**: Automate start/stop actions based on user-defined cron schedules.

## 3. Modules

### 3.1. Account Integration
This module handles the onboarding and management of external AWS accounts.

*   **Functionality**:
    *   Support onboarding of N number of AWS accounts.
    *   **CloudFormation Generation**: The UI must generate a CloudFormation template for the user.
        *   Template includes creation of the necessary Cross-Account IAM Role.
        *   "Copy" feature for easy execution in the target account.
    *   **Persistence**: Store account details (Account ID, Role ARN, Name) in DynamoDB.
    *   **Status Monitoring**:
        *   Display account status (Active/Inactive).
        *   **Test Run Simulation**: Perform a "simulation" to verify successful integration (i.e., assume role check) and update status.

### 3.2. Schedule Module
This module allows users to define when resources should be running or stopped.

*   **Functionality**:
    *   Create N number of schedules.
    *   **Inputs**: Start Time, End Time (Cron/Time based).
    *   **Resource Scanning**:
        *   Scan integrated accounts to list available resources.
        *   Supported Resource Types: **ECS**, **EC2**, **RDS**.
    *   **Resource Selection**:
        *   Multi-select interface for users to choose which resources apply to a schedule.
    *   **Persistence**: Store schedule configuration and mapped resources in DynamoDB.

### 3.3. Execution Engine (Scheduler)
The backend logic that enforces the schedules.

*   **Functionality**:
    *   Lambda function triggers based on schedule logic.
    *   Reads Account and Schedule information from DynamoDB.
    *   Performs Start/Stop actions on mapped resources via Cross-Account Role.
    *   **Logging**: Records all execution metadata (Resource updated, Time, Action) into the Audit Table.

### 3.4. Auditing & Reporting
A comprehensive audit trail for compliance and tracking.

*   **Audit Table**:
    *   **User Actions**: Log all mutations to the database (Create/Update Scheduler, Create/Update Account, etc.).
    *   **System Actions**: Log execution results (Start/Stop of resources).
    *   **Retention**: 30-day TTL (Time to Live) for all audit records.
*   **UI Representation**:
    *   View Audit Logs in the web interface.
    *   View status of schedules and resources currently being managed.

## 4. Data Architecture
*   **Primary Database**: DynamoDB using **Single Table Design**.
    *   Stores Accounts, Schedules, and Resource Mappings.
*   **Audit Database**: DynamoDB Table.
    *   Stores User Activity Logs and Execution Logs.
    *   Enabled with TTL.

## 5. non-Functional Requirements
*   **Scalability**: Must handle high volume of accounts and resources.
*   **Security**: Use secure Cross-Account IAM Roles (sts:AssumeRole).
*   **Performance**: Efficient querying using Single Table Design best practices.
*   **Standards**: Schema and Indexing must follow industry standards for DynamoDB.
