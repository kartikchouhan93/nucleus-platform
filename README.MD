# AWS Scheduler Project Documentation

## Overview

The AWS Scheduler is a robust and efficient solution designed to automate the process of turning on and off AWS instances based on specific tags. This project leverages AWS Cloud Development Kit (CDK) for infrastructure as code (IaC) to provision and manage AWS resources. The Scheduler uses a combination of AWS Lambda, DynamoDB, IAM Roles, and CloudWatch Events to perform scheduled tasks, providing a cost-effective and time-efficient way to manage instance states.

### Key Components

- **AWS Lambda**: Executes the scheduling logic.
- **DynamoDB**: Stores the configuration and state of instances.
- **IAM Roles and Policies**: Secure access to AWS services.
- **CloudWatch Events**: Triggers Lambda functions based on specified schedules.

## Installation Steps

### Prerequisites

- AWS CLI installed and configured.
- Node.js and npm installed.
- AWS CDK toolkit installed using `npm install -g aws-cdk`.
- Access to an AWS account with necessary permissions.

### Environment Variables

Before deployment, set the following environment variables:

- `SCHEDULER_NAME`: Name of the Scheduler (default: 'AwsScheduler').
- `SCHEDULE_EXPRESSION`: Cron expression for schedule (default: 'cron(0 \* \* _ ? _)').
- `SCHEDULER_TAG`: Tag to identify resources managed by the Scheduler (default: 'schedule').

### Deployment Steps

1. Clone the repository to your local machine.
2. Navigate to the project directory.
3. Run `npm install` to install dependencies.
4. Customize the CDK stack in `lib/aws-scheduler-stack.ts` as needed.
5. Deploy the stack using `npx cdk deploy`.

## Technical Description

The AWS Scheduler is designed to be highly configurable and scalable. The `AwsSchedulerStack` class in the CDK stack file defines the infrastructure setup. Here's a breakdown of the main components:

- **DynamoDB Table**: Serves as the data store for the scheduler's configuration and state.
- **Lambda Function**: Contains the logic for starting and stopping instances. It's triggered as per the schedule defined in CloudWatch Events.
- \*\*IAM Role and

Policy\*\*: Securely grants the Lambda function the necessary permissions to interact with DynamoDB and other AWS services.

- **CloudWatch Event Rule**: Defines the triggering mechanism for the Lambda function based on the specified schedule.

The Lambda function is central to this setup. It queries DynamoDB to determine which instances need to be started or stopped based on their tags and the current time. The function then performs the required start or stop action on each instance.

### CloudFormation for Cross-Account Access

For scenarios where the Scheduler needs to manage resources across different AWS accounts, a cross-account role is necessary. This role allows the Scheduler's Lambda function in one AWS account to perform actions on resources in another AWS account.

The IAM role (`CrossAccountRoleForAwsScheduler`) should be created in the target AWS account with the necessary permissions to start and stop instances. The trust relationship of this role should allow the Lambda function's role in the Scheduler's AWS account to assume it.

Replace `<CrossAccountID>` with the AWS account ID where the Scheduler is deployed.

## Conclusion

The AWS Scheduler is a powerful tool for automating instance management in AWS, providing both cost savings and operational efficiency. By leveraging AWS CDK

, it offers a flexible and scalable solution that can be easily adapted to different environments and use cases. The integration of cross-account capabilities further extends its utility, making it suitable for complex AWS architectures.

For optimal results, it is important to thoroughly test the Scheduler in a controlled environment before deploying it in a production setting. Regular monitoring and updates are also recommended to ensure it continues to operate effectively and securely in line with AWS best practices and evolving service features.

This documentation provides a comprehensive guide to deploying and utilizing the AWS Scheduler. By following the steps and understanding the components involved, you can effectively manage your AWS instances and optimize resource usage and costs.
