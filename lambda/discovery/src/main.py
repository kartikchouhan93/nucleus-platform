"""
AWS Auto-Discovery ECS Fargate Task
Main entry point for discovering AWS resources across multi-account environments.
Uses AWS Auto Inventory for comprehensive resource scanning.
"""
import os
import sys
import json
import boto3
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

from config_generator import generate_inventory_config
from inventory_runner import run_inventory_scan
from data_processor import process_and_store_resources


def get_active_accounts(dynamodb_client, table_name: str) -> List[Dict[str, Any]]:
    """Fetch all active accounts from DynamoDB."""
    accounts = []
    paginator = dynamodb_client.get_paginator('query')
    
    for page in paginator.paginate(
        TableName=table_name,
        IndexName='GSI1',
        KeyConditionExpression='gsi1pk = :pk',
        ExpressionAttributeValues={':pk': {'S': 'TYPE#ACCOUNT'}},
        FilterExpression='#status = :active',
        ExpressionAttributeNames={'#status': 'status'},
    ):
        for item in page.get('Items', []):
            accounts.append({
                'accountId': item.get('account_id', {}).get('S', ''),
                'accountName': item.get('account_name', {}).get('S', ''),
                'roleArn': item.get('role_arn', {}).get('S', ''),
                'regions': item.get('regions', {}).get('L', [{'S': 'us-east-1'}]),
            })
    
    return accounts


def update_account_sync_status(
    dynamodb_client,
    table_name: str,
    account_id: str,
    status: str,
    resource_count: int,
    duration_ms: int
) -> None:
    """Update the sync status for an account."""
    dynamodb_client.update_item(
        TableName=table_name,
        Key={
            'pk': {'S': f'ACCOUNT#{account_id}'},
            'sk': {'S': 'METADATA'}
        },
        UpdateExpression='SET lastSyncedAt = :ts, lastSyncStatus = :status, lastSyncResourceCount = :count, lastSyncDurationMs = :duration',
        ExpressionAttributeValues={
            ':ts': {'S': datetime.now(timezone.utc).isoformat()},
            ':status': {'S': status},
            ':count': {'N': str(resource_count)},
            ':duration': {'N': str(duration_ms)}
        }
    )


def main():
    """Main entry point for the discovery task."""
    print("=" * 60)
    print("AWS Auto-Discovery Task Starting")
    print(f"Time: {datetime.now(timezone.utc).isoformat()}")
    print("=" * 60)
    
    # Environment variables
    app_table_name = os.environ.get('APP_TABLE_NAME')
    inventory_table_name = os.environ.get('INVENTORY_TABLE_NAME')
    inventory_bucket = os.environ.get('INVENTORY_BUCKET')
    specific_account_id = os.environ.get('ACCOUNT_ID')  # Optional: scan specific account
    
    if not app_table_name:
        print("ERROR: APP_TABLE_NAME environment variable is required")
        sys.exit(1)
    
    if not inventory_table_name:
        print("ERROR: INVENTORY_TABLE_NAME environment variable is required")
        sys.exit(1)
    
    if not inventory_bucket:
        print("ERROR: INVENTORY_BUCKET environment variable is required")
        sys.exit(1)
    
    # Initialize AWS clients
    dynamodb = boto3.client('dynamodb')
    s3 = boto3.client('s3')
    
    # Get accounts to scan
    if specific_account_id:
        print(f"Scanning specific account: {specific_account_id}")
        # TODO: Fetch single account details
        accounts = [{'accountId': specific_account_id}]
    else:
        print("Fetching all active accounts...")
        accounts = get_active_accounts(dynamodb, app_table_name)
    
    print(f"Found {len(accounts)} account(s) to scan")
    
    if not accounts:
        print("No accounts to scan. Exiting.")
        return
    
    total_resources = 0
    successful_accounts = 0
    failed_accounts = 0
    
    for account in accounts:
        account_id = account.get('accountId')
        account_name = account.get('accountName', account_id)
        role_arn = account.get('roleArn')
        
        print(f"\n--- Scanning Account: {account_name} ({account_id}) ---")
        start_time = datetime.now(timezone.utc)
        
        try:
            # Generate config for this account
            config = generate_inventory_config(account)
            
            # Run the inventory scan
            resources = run_inventory_scan(config, role_arn)
            
            # Process and store results in inventory table
            resource_count = process_and_store_resources(
                dynamodb_client=dynamodb,
                s3_client=s3,
                table_name=inventory_table_name,
                bucket_name=inventory_bucket,
                account_id=account_id,
                resources=resources
            )
            
            # Calculate duration
            end_time = datetime.now(timezone.utc)
            duration_ms = int((end_time - start_time).total_seconds() * 1000)
            
            # Update sync status
            update_account_sync_status(
                dynamodb, app_table_name, account_id,
                'success', resource_count, duration_ms
            )
            
            total_resources += resource_count
            successful_accounts += 1
            print(f"SUCCESS: Discovered {resource_count} resources in {duration_ms}ms")
            
        except Exception as e:
            print(f"ERROR scanning account {account_id}: {str(e)}")
            failed_accounts += 1
            
            # Update sync status as failed
            end_time = datetime.now(timezone.utc)
            duration_ms = int((end_time - start_time).total_seconds() * 1000)
            update_account_sync_status(
                dynamodb, app_table_name, account_id,
                'failed', 0, duration_ms
            )
    
    print("\n" + "=" * 60)
    print("AWS Auto-Discovery Task Complete")
    print(f"Total Accounts: {len(accounts)}")
    print(f"Successful: {successful_accounts}")
    print(f"Failed: {failed_accounts}")
    print(f"Total Resources: {total_resources}")
    print("=" * 60)


if __name__ == '__main__':
    main()
