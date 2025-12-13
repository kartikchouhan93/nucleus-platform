Cost Optimization Scheduler Web UI - Complete CRUD Solution
Based on your cost optimization project, I'll create a comprehensive task for building a modern web UI using Next.js 14 with Shadcn UI components for full CRUD operations on DynamoDB, featuring AWS Cognito SSO authentication.

Project Overview
Your AWS Cost Optimization Scheduler is a sophisticated system that:

Manages AWS resources (EC2, RDS, ECS, ElastiCache) across multiple accounts
Uses DynamoDB to store schedule metadata and account metadata
Executes via Lambda functions that assume cross-account roles
Supports time-based scheduling with timezone awareness
Current State Analysis
I can see you already have: ✅ CDK Infrastructure - DynamoDB tables, Lambda functions, IAM roles ✅ Backend Logic - Complete scheduler Lambda with cross-account support ✅ Basic Next.js Setup - Initial web UI structure started ✅ Data Models - Schedule and AccountMetadata TypeScript interfaces

Task: Complete Cost Scheduler Web UI Implementation
Core Features to Implement

1. Authentication & Authorization
   AWS Cognito Integration for SSO login to DevOps platform
   Role-based access control (Admin, Operator, Viewer)
   Session management with automatic token refresh
   Secure API calls with Cognito JWT tokens
2. Schedule Management (CRUD)
   Create/Edit Schedules with form validation
   Schedule name and description
   Start/End times with timezone selection
   Days of week selector (checkboxes)
   Active/Inactive toggle
   Schedule List View with sorting, filtering, search
   Schedule Details View with usage statistics
   Bulk Operations (enable/disable multiple schedules)
3. Account Metadata Management (CRUD)
   Add/Edit AWS Accounts
   Account ID, Name, Role ARN
   Multi-region selection
   Active status toggle
   Account List with connection status indicators
   Account Validation - Test cross-account role access
   Bulk Account Operations

4. Advanced Features
   Audit Logs - Track all user actions
