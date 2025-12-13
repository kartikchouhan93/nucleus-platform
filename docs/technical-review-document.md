# Technical Review Document (TRD) - Nucleus Platform

## 1. Executive Summary
This document outlines the technical architecture for the Nucleus Platform, a cost optimization and resource scheduling system. The system uses a serverless architecture on AWS, leveraging Lambda, DynamoDB (Single Table Design), and Next.js for the UI.

## 2. Architecture Overview

### 2.1. High-Level Diagram Description
*   **Frontend**: Next.js application hosted on AWS (Amplify or CloudFront + S3 or Lambda).
*   **Backend**: AWS Lambda functions exposed via API Gateway or Function URL.
*   **Database**: AWS DynamoDB (Two tables: Main App Table, Audit Table).
*   **Orchestration**: EventBridge for scheduling Cron jobs.
*   **Cross-Account Access**: IAM Roles with `sts:AssumeRole` trust relationships.

### 2.2. Component Interaction
1.  **User** interacts with **Next.js UI**.
2.  **UI** calls **Backend API (Lambda)** to create accounts/schedules.
3.  **Backend** persists data to **DynamoDB (App Table)**.
4.  **Audit Logs** are written to **DynamoDB (Audit Table)** asynchronously or synchronously.
5.  **Scheduler Lambda** runs on a schedule (EventBridge).
6.  **Scheduler** queries **App Table** for active schedules.
7.  **Scheduler** assumes **Cross-Account Role** in Target Account.
8.  **Scheduler** executes Start/Stop API calls on Target Resources (ECS, EC2, RDS).
9.  **Scheduler** writes execution results to **Audit Table**.

## 3. Technology Stack
*   **Frontend**: Next.js, React, Tailwind CSS.
*   **Backend**: Node.js (Lambda), AWS SDK v3.
*   **Infrastructure as Code**: AWS CDK (TypeScript).
*   **Database**: Amazon DynamoDB.
*   **Authentication**: Cognito (suggested for Enterprise grade, though not explicitly detained in user prompt, it is standard).

## 4. Database Design (Single Table)
We will use a Single Table Design for the main application data to optimize for read patterns.

### 4.1. Core Entities
*   **Account**: Represents an AWS account.
*   **Schedule**: Represents a time-based rule.
*   **Resource**: Mapped to a Schedule.

### 4.2. Access Patterns
*   Get all Accounts.
*   Get Account by ID.
*   Get all Schedules.
*   Get Schedules for a specific Account? (Or global schedules).
*   Get Resources for a Schedule.

(Detailed Schema in separate `schema-design.md`)

## 5. Security Architecture
*   **Cross-Account Roles**:
    *   Target Account must have a CloudFormation stack deployed creating a Role.
    *   Role trusts the "Nucleus Platform" Account ID.
    *   Permissions: `ecs:UpdateService`, `ec2:StartInstances`, `ec2:StopInstances`, `rds:StartDBInstance`, `rds:StopDBInstance`.
*   **Data Security**:
    *   DynamoDB Encryption at Rest (KMS).
    *   IAM Roles for Lambda with least privilege.

## 6. Audit & Compliance
*   **Audit Table**:
    *   Separate table to isolate high-volume write logs.
    *   TTL permitted (30 days).
    *   Stream-based processing (optional) or direct write from Lambda.

## 7. Scalability & Performance
*   **DynamoDB**: On-Demand capacity or Provisioned with Auto-Scaling.
*   **Lambda**: Concurrency limits to prevent throttling target APIs.
*   **Batching**: Scheduler should process accounts/resources in batches to avoid timeouts.
