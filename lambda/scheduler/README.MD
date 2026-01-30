# AWS Lambda Scheduler - Node.js Runtime

AWS resource scheduler for cost optimization using **Node.js** runtime. Automatically starts and stops EC2, RDS, ECS, ASG, and DocumentDB resources based on configured schedules.

## 📋 Prerequisites

### For Local Development
- [Node.js](https://nodejs.org/) >= 20.0.0
- AWS credentials configured (via AWS CLI or environment variables)
- Access to DynamoDB tables for schedule configuration

### For AWS Lambda Deployment
- AWS CLI configured
- CDK / SAM / Serverless framework (whichever is being used)
- Lambda execution role with appropriate permissions

## 🛠️ Local Development Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Required environment variables:
```env
AWS_REGION=us-east-1
AWS_PROFILE=your-aws-profile
APP_TABLE_NAME=cost-optimization-scheduler-app-table
AUDIT_TABLE_NAME=cost-optimization-scheduler-audit-table
```

### 3. Run Locally

#### Full Scan Mode (process all schedules)
```bash
npm run dev
# or
npm run dev:full
```

#### Partial Scan Mode (process specific schedule)
```bash
npm run dev:partial -- --scheduleId=your-schedule-id
# or by name
AWS_SDK_LOAD_CONFIG=1 tsx src/local-runner.ts --mode=partial --scheduleName=your-schedule-name
```

### 4. Type Checking

```bash
npm run typecheck
```

### 5. Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch
```

## 🏗️ Architecture

```
scheduler/
├── src/
│   ├── index.ts              # Lambda handler entry point
│   ├── local-runner.ts       # Local development runner
│   ├── services/             # Business logic services
│   │   ├── scheduler-service.ts
│   │   ├── dynamodb-service.ts
│   │   ├── sts-service.ts
│   │   └── execution-history-service.ts
│   ├── resource-schedulers/  # Resource-specific schedulers
│   │   ├── ec2-scheduler.ts
│   │   ├── rds-scheduler.ts
│   │   ├── ecs-scheduler.ts
│   │   ├── asg-scheduler.ts
│   │   └── docdb-scheduler.ts
│   ├── types/                # TypeScript type definitions
│   └── utils/                # Utility functions
├── package.json              # Dependencies
├── tsconfig.json            # TypeScript configuration
└── .dockerignore           # Docker build exclusions
```

## 🔐 IAM Permissions Required

The Lambda execution role needs:
- `dynamodb:Query`, `dynamodb:GetItem`, `dynamodb:PutItem`, `dynamodb:UpdateItem`
- `sts:AssumeRole` for cross-account access
- `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents`
- `ec2:*`, `rds:*`, `ecs:*`, `autoscaling:*` (via assumed roles in target accounts)

## 📄 License

ISC
