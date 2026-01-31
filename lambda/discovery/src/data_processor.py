"""
Data Processor - Stores discovered resources in DynamoDB and S3.
"""
import json
import hashlib
from datetime import datetime, timezone
from typing import Dict, Any, List


def generate_resource_arn(resource: Dict[str, Any], account_id: str) -> str:
    """Generate a resource ARN if not provided."""
    if resource.get('resourceArn'):
        return resource['resourceArn']
    
    # Construct a pseudo-ARN for resources without native ARN
    resource_type = resource.get('resourceType', 'unknown')
    resource_id = resource.get('resourceId', 'unknown')
    region = resource.get('region', 'unknown')
    service = resource.get('service', 'unknown')
    
    return f"arn:aws:{service}:{region}:{account_id}:{resource_type}/{resource_id}"


def process_and_store_resources(
    dynamodb_client,
    s3_client,
    table_name: str,
    bucket_name: str,
    account_id: str,
    resources: List[Dict[str, Any]]
) -> int:
    """
    Process resources and store in DynamoDB and S3.
    
    Args:
        dynamodb_client: Boto3 DynamoDB client
        s3_client: Boto3 S3 client
        table_name: DynamoDB table name
        bucket_name: S3 bucket name
        account_id: AWS account ID
        resources: List of discovered resources
        
    Returns:
        Number of resources processed
    """
    if not resources:
        return 0
    
    now = datetime.now(timezone.utc)
    timestamp = now.isoformat()
    date_prefix = now.strftime('%Y/%m/%d')
    
    # Store raw data to S3
    s3_key = f"raw/{date_prefix}/{account_id}/inventory.json"
    s3_client.put_object(
        Bucket=bucket_name,
        Key=s3_key,
        Body=json.dumps({
            'accountId': account_id,
            'timestamp': timestamp,
            'resourceCount': len(resources),
            'resources': resources
        }, default=str),
        ContentType='application/json'
    )
    print(f"  Stored raw data to s3://{bucket_name}/{s3_key}")
    
    # Prepare DynamoDB items
    items_to_write = []
    
    for resource in resources:
        resource_arn = generate_resource_arn(resource, account_id)
        resource_type = resource.get('resourceType', 'unknown')
        resource_id = resource.get('resourceId', 'unknown')
        name = resource.get('name', resource_id)
        region = resource.get('region', 'unknown')
        state = resource.get('state', 'unknown')
        tags = resource.get('tags', {})
        
        # Create DynamoDB item
        item = {
            'pk': {'S': f'ACCOUNT#{account_id}'},
            'sk': {'S': f'INVENTORY#{resource_type}#{resource_arn}'},
            'gsi1pk': {'S': 'TYPE#INVENTORY'},
            'gsi1sk': {'S': f'{resource_type}#{region}#{name}'},
            'gsi2pk': {'S': f'REGION#{region}'},
            'gsi2sk': {'S': f'{resource_type}#{timestamp}'},
            'gsi3pk': {'S': f'RESOURCE_TYPE#{resource_type}'},
            'gsi3sk': {'S': f'{account_id}#{resource_id}'},
            'resourceId': {'S': resource_id},
            'resourceArn': {'S': resource_arn},
            'resourceType': {'S': resource_type},
            'name': {'S': name},
            'region': {'S': region},
            'state': {'S': state},
            'accountId': {'S': account_id},
            'lastDiscoveredAt': {'S': timestamp},
            'discoveryStatus': {'S': 'active'},
        }
        
        # Add tags if present
        if tags:
            item['tags'] = {'M': {k: {'S': str(v)} for k, v in tags.items()}}
        
        # Add metadata (excluding rawData to save space)
        metadata = {k: v for k, v in resource.items() 
                   if k not in ['rawData', 'resourceType', 'resourceId', 'resourceArn', 
                               'name', 'region', 'state', 'tags', 'service']}
        if metadata:
            item['metadata'] = {'M': {k: {'S': str(v)} for k, v in metadata.items()}}
        
        items_to_write.append({'PutRequest': {'Item': item}})
    
    # Batch write to DynamoDB (max 25 items per batch)
    batch_size = 25
    for i in range(0, len(items_to_write), batch_size):
        batch = items_to_write[i:i + batch_size]
        
        try:
            response = dynamodb_client.batch_write_item(
                RequestItems={table_name: batch}
            )
            
            # Handle unprocessed items with retry
            unprocessed = response.get('UnprocessedItems', {})
            retry_count = 0
            while unprocessed and retry_count < 3:
                import time
                time.sleep(2 ** retry_count)  # Exponential backoff
                response = dynamodb_client.batch_write_item(RequestItems=unprocessed)
                unprocessed = response.get('UnprocessedItems', {})
                retry_count += 1
                
        except Exception as e:
            print(f"  ERROR writing batch to DynamoDB: {str(e)}")
    
    print(f"  Stored {len(resources)} resources to DynamoDB")
    
    return len(resources)


def mark_missing_resources(
    dynamodb_client,
    table_name: str,
    account_id: str,
    discovered_arns: set
) -> int:
    """
    Mark resources as 'missing' if they weren't in the latest scan.
    
    Args:
        dynamodb_client: Boto3 DynamoDB client
        table_name: DynamoDB table name
        account_id: AWS account ID
        discovered_arns: Set of ARNs found in current scan
        
    Returns:
        Number of resources marked as missing
    """
    # Query existing resources for this account
    existing_resources = []
    paginator = dynamodb_client.get_paginator('query')
    
    for page in paginator.paginate(
        TableName=table_name,
        KeyConditionExpression='pk = :pk AND begins_with(sk, :sk_prefix)',
        ExpressionAttributeValues={
            ':pk': {'S': f'ACCOUNT#{account_id}'},
            ':sk_prefix': {'S': 'INVENTORY#'}
        },
        ProjectionExpression='sk, resourceArn, discoveryStatus'
    ):
        for item in page.get('Items', []):
            arn = item.get('resourceArn', {}).get('S', '')
            status = item.get('discoveryStatus', {}).get('S', 'active')
            if arn and status == 'active':
                existing_resources.append(item)
    
    # Mark resources not in discovered_arns as missing
    missing_count = 0
    timestamp = datetime.now(timezone.utc).isoformat()
    
    for item in existing_resources:
        arn = item.get('resourceArn', {}).get('S', '')
        sk = item.get('sk', {}).get('S', '')
        
        if arn not in discovered_arns:
            dynamodb_client.update_item(
                TableName=table_name,
                Key={
                    'pk': {'S': f'ACCOUNT#{account_id}'},
                    'sk': {'S': sk}
                },
                UpdateExpression='SET discoveryStatus = :status, lastDiscoveredAt = :ts',
                ExpressionAttributeValues={
                    ':status': {'S': 'missing'},
                    ':ts': {'S': timestamp}
                }
            )
            missing_count += 1
    
    if missing_count > 0:
        print(f"  Marked {missing_count} resources as missing")
    
    return missing_count
