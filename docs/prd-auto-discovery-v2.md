# Product Requirements Document (PRD)
# AWS Auto-Discovery Module

**Version**: 2.1  
**Date**: January 31, 2026  
**Status**: Draft - Pending Review

---

## 1. Executive Summary

Managing AWS resources across multiple accounts is operationally tedious and error-prone. The **Auto-Discovery Module** provides a single-pane-of-glass view of all AWS resources across connected accounts by automatically discovering, cataloging, and tracking resources daily using **AWS Auto Inventory** scripts.

### Key Value Propositions
- **Eliminate Manual Overhead**: No more logging into each account to inventory resources
- **Comprehensive Coverage**: Scan 50+ AWS resource types automatically
- **Historical Data**: S3 Iceberg tables enable analytics and trend analysis
- **Export Capabilities**: Excel export for compliance and reporting

---

## 2. Problem Statement

| Pain Point | Impact |
|------------|--------|
| **Multi-Account Complexity** | DevOps teams spend hours manually checking resources across 10+ accounts |
| **No Central Inventory** | Resources only visible when attached to schedules; no full visibility |
| **Stale Data** | Real-time API scanning is slow, times out, and lacks historical context |
| **Compliance Gaps** | No easy way to export resource inventories for audits |

---

## 3. Goals & Success Metrics

### Goals
1. **Automated Daily Discovery**: Scan all connected AWS accounts once per day
2. **Persistent Inventory**: Store resource metadata for instant search/filter
3. **Rich UI Experience**: Grid with pagination, filters, and export
4. **Historical Analytics**: S3 Iceberg tables for trend analysis

### Success Metrics
| Metric | Target |
|--------|--------|
| Discovery Coverage | 50+ AWS resource types |
| UI Load Time | < 2 seconds for 10,000 resources |
| Daily Scan Success Rate | > 99% |
| User Adoption | 80% of users access inventory weekly |

---

## 4. User Stories

### Discovery & Sync
| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-1 | As a user, I want resources to be discovered automatically so I don't have to scan manually | Daily EventBridge trigger runs discovery |
| US-2 | As a user, I want to see when each account was last synced | "Last Synced" timestamp visible per account |
| US-3 | As a user, I want to trigger a manual sync if I just created resources | "Sync Now" button invokes Lambda async |

### Inventory UI
| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-4 | As a user, I want to see all resources in a grid with pagination | Grid displays 25/50/100 per page |
| US-5 | As a user, I want to filter by resource type (EC2, RDS, S3, etc.) | Dropdown filter works correctly |
| US-6 | As a user, I want to filter by account and region | Multi-select filters available |
| US-7 | As a user, I want to search resources by name or ID | Search input with debounce |
| US-8 | As a user, I want to export filtered results to Excel | Download XLSX with applied filters |

### Analytics (Future)
| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-9 | As a user, I want to see resource count trends over time | Charts showing growth/reduction |
| US-10 | As an admin, I want to query historical data via Athena | S3 Iceberg tables queryable |

---

## 5. Functional Requirements

### 5.1 Discovery Engine

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-1 | Use AWS Auto Inventory Python scripts for scanning | P0 |
| FR-2 | Support organization-wide scanning via role assumption | P0 |
| FR-3 | Run on daily schedule (configurable time, default 2:00 AM UTC) | P0 |
| FR-4 | Support manual "Sync Now" per account | P0 |
| FR-5 | Scan all active accounts from DynamoDB | P0 |
| FR-6 | Respect AWS API rate limits with exponential backoff | P0 |
| FR-7 | Use **ECS Fargate** for long-running scans (30+ minutes) | P0 |

### 5.2 Resource Types (Initial Scope)

| Category | Resource Types |
|----------|----------------|
| **Compute** | EC2, Lambda, ECS Services/Tasks, EKS Clusters |
| **Database** | RDS Instances/Clusters, DynamoDB Tables, DocumentDB |
| **Storage** | S3 Buckets, EBS Volumes, EFS Filesystems |
| **Networking** | VPCs, Subnets, Load Balancers, NAT Gateways |
| **Security** | IAM Roles/Policies, Security Groups, KMS Keys |
| **Other** | Auto Scaling Groups, CloudFront Distributions, SNS Topics |

### 5.3 Data Storage

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-7 | Store latest inventory in DynamoDB for fast UI queries | P0 |
| FR-8 | Store historical data in **AWS S3 Tables** (managed Iceberg) | P0 |
| FR-9 | Store raw JSON data in S3 for archival/backup | P1 |
| FR-10 | TTL for old DynamoDB records (configurable, default 30 days) | P1 |

### 5.4 API Endpoints

| Endpoint | Method | Description | Priority |
|----------|--------|-------------|----------|
| `/api/inventory/resources` | GET | List with pagination, filters | P0 |
| `/api/inventory/resources/export` | POST | Generate Excel download | P0 |
| `/api/inventory/sync` | POST | Trigger manual scan | P0 |
| `/api/inventory/status` | GET | Get sync status per account | P0 |
| `/api/inventory/stats` | GET | Get resource count summary | P1 |

### 5.5 User Interface

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-11 | Data grid with sortable columns | P0 |
| FR-12 | Pagination (25/50/100 per page) | P0 |
| FR-13 | Filter by: Resource Type, Account, Region, Status | P0 |
| FR-14 | Search by name/ID with debounce | P0 |
| FR-15 | Export to Excel with current filters applied | P0 |
| FR-16 | Show "Last Synced" per account | P0 |
| FR-17 | "Sync Now" button with loading indicator | P0 |
| FR-18 | Resource detail drawer with metadata & tags | P1 |

---

## 6. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| **Performance** | Grid loads < 2s with 10,000 resources |
| **Scalability** | Support 100+ accounts, 1M+ total resources |
| **Reliability** | 99.9% uptime for discovery function |
| **Security** | Use STS AssumeRole; no long-lived credentials |
| **Data Retention** | DynamoDB: 30 days (configurable); S3: Indefinite |
| **Compliance** | Excel exports include timestamps for audit trails |
| **Analytics** | AWS S3 Tables queryable via Athena/Redshift |

---

## 7. Out of Scope (v1.0)

- Real-time resource change notifications (EventBridge-based)
- Cost data association with resources
- Resource tagging management from UI
- Cross-account resource relationships visualization
- Athena query interface in UI

---

## 8. Dependencies

| Dependency | Description |
|------------|-------------|
| AWS Auto Inventory | Open-source Python library from AWS Samples |
| Python 3.11+ | Required runtime for AWS Auto Inventory |
| ECS Fargate | For long-running discovery tasks |
| AWS S3 Tables | Managed Iceberg tables (re:Invent 2024 feature) |
| Cross-Account Roles | Existing `NucleusAccess-*` roles must have read permissions |

---

## 9. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Large scan duration | Medium | Medium | ECS Fargate supports 30+ minute tasks |
| API throttling during scan | Low | Medium | Exponential backoff with jitter |
| Large data volumes | Medium | Medium | Pagination, filtered queries, S3 for bulk |
| Cross-account permission gaps | Low | Medium | Validate permissions during account onboarding |
| S3 Tables regional availability | Low | Low | Initially US regions only; expand as available |

---

## 10. Timeline (Estimated)

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Phase 1: Infrastructure | 1 week | Lambda, S3, DynamoDB schema, CDK |
| Phase 2: Discovery Lambda | 1 week | AWS Auto Inventory integration |
| Phase 3: API Layer | 1 week | REST endpoints, pagination |
| Phase 4: UI | 2 weeks | Grid, filters, export |
| Phase 5: Testing & Polish | 1 week | E2E tests, performance tuning |

**Total**: ~6 weeks

---

## 11. Appendix

### A. AWS Auto Inventory Features
- Multi-format output (JSON + Excel)
- Multi-region concurrent scanning
- Organization scanning with role assumption
- Flexible filtering by tags/attributes
- Built-in retry logic for API throttling

### B. Related Documents
- [Technical Requirements Document](./trd-auto-discovery-v2.md)
- [Architecture Guide](./ARCHITECTURE.md)
- [Schema Design](./schema-design.md)
