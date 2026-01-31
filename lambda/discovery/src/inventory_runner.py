"""
Inventory Runner - Executes AWS SDK calls to discover resources.
This is a simplified implementation that doesn't require aws-auto-inventory package.
"""
import boto3
from botocore.config import Config
from typing import Dict, Any, List, Optional
import time


def get_assumed_role_session(role_arn: str, session_name: str = 'NucleusDiscovery') -> boto3.Session:
    """Assume a cross-account role and return a session."""
    sts = boto3.client('sts')
    
    response = sts.assume_role(
        RoleArn=role_arn,
        RoleSessionName=session_name,
        DurationSeconds=3600  # 1 hour
    )
    
    credentials = response['Credentials']
    
    return boto3.Session(
        aws_access_key_id=credentials['AccessKeyId'],
        aws_secret_access_key=credentials['SecretAccessKey'],
        aws_session_token=credentials['SessionToken']
    )


def run_inventory_scan(config: Dict[str, Any], role_arn: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Run inventory scan for resources based on config.
    
    Args:
        config: Configuration dictionary from config_generator
        role_arn: Optional role ARN for cross-account access
        
    Returns:
        List of discovered resources
    """
    all_resources = []
    
    # Get session (default or assumed role)
    if role_arn:
        print(f"Assuming role: {role_arn}")
        session = get_assumed_role_session(role_arn)
    else:
        session = boto3.Session()
    
    # Get inventory configuration
    inventories = config.get('inventories', [])
    if not inventories:
        return all_resources
    
    inventory = inventories[0]
    regions = inventory.get('aws', {}).get('region', ['us-east-1'])
    sheets = inventory.get('sheets', [])
    
    # Boto3 config for retries
    boto_config = Config(
        retries={'max_attempts': 3, 'mode': 'adaptive'},
        connect_timeout=10,
        read_timeout=30,
    )
    
    for region in regions:
        print(f"  Scanning region: {region}")
        
        for sheet in sheets:
            service_name = sheet.get('service')
            function_name = sheet.get('function')
            result_key = sheet.get('result_key')
            resource_type = sheet.get('name', service_name)
            
            try:
                # Get the service client
                client = session.client(service_name, region_name=region, config=boto_config)
                
                # Call the describe/list function
                method = getattr(client, function_name, None)
                if not method:
                    print(f"    WARN: Method {function_name} not found on {service_name}")
                    continue
                
                # Handle pagination if available
                resources = []
                try:
                    paginator = client.get_paginator(function_name)
                    for page in paginator.paginate():
                        items = page.get(result_key, [])
                        resources.extend(items if isinstance(items, list) else [items])
                except Exception:
                    # Fallback to single call if pagination not available
                    response = method()
                    items = response.get(result_key, [])
                    resources.extend(items if isinstance(items, list) else [items])
                
                # Process each resource
                for resource in resources:
                    resource_data = {
                        'resourceType': resource_type.lower().replace(' ', '_'),
                        'region': region,
                        'service': service_name,
                        'rawData': resource,
                    }
                    
                    # Extract common identifiers
                    resource_data.update(extract_resource_identifiers(resource, resource_type, region))
                    
                    all_resources.append(resource_data)
                
                print(f"    {resource_type}: {len(resources)} found")
                
                # Rate limiting - small delay between API calls
                time.sleep(0.1)
                
            except Exception as e:
                print(f"    ERROR scanning {resource_type} in {region}: {str(e)}")
                continue
    
    return all_resources


def extract_resource_identifiers(resource: Any, resource_type: str, region: str) -> Dict[str, Any]:
    """Extract common identifiers from a resource based on its type."""
    identifiers = {
        'resourceId': '',
        'resourceArn': '',
        'name': '',
        'state': 'unknown',
        'tags': {},
    }
    
    if isinstance(resource, str):
        # Some APIs return just ARNs or IDs as strings
        if resource.startswith('arn:'):
            identifiers['resourceArn'] = resource
            identifiers['resourceId'] = resource.split('/')[-1] if '/' in resource else resource.split(':')[-1]
        else:
            identifiers['resourceId'] = resource
        identifiers['name'] = identifiers['resourceId']
        return identifiers
    
    if not isinstance(resource, dict):
        return identifiers
    
    # Extract ID (various naming conventions)
    for id_key in ['InstanceId', 'DBInstanceIdentifier', 'ClusterIdentifier', 'FunctionName', 
                   'BucketName', 'VolumeId', 'VpcId', 'SubnetId', 'GroupId', 'KeyId',
                   'AutoScalingGroupName', 'LoadBalancerArn', 'TopicArn', 'QueueUrl',
                   'FileSystemId', 'NatGatewayId', 'DistributionId']:
        if id_key in resource:
            identifiers['resourceId'] = resource[id_key]
            break
    
    # Extract ARN
    for arn_key in ['Arn', 'ARN', 'FunctionArn', 'DBInstanceArn', 'LoadBalancerArn', 
                    'TopicArn', 'QueueUrl', 'FileSystemArn', 'KeyArn']:
        if arn_key in resource:
            identifiers['resourceArn'] = resource[arn_key]
            break
    
    # Extract Name
    for name_key in ['Name', 'DBInstanceIdentifier', 'FunctionName', 'BucketName',
                     'AutoScalingGroupName', 'LoadBalancerName', 'FileSystemId']:
        if name_key in resource:
            identifiers['name'] = resource[name_key]
            break
    
    # Try to get name from tags
    if not identifiers['name']:
        tags = resource.get('Tags', resource.get('TagList', []))
        if isinstance(tags, list):
            for tag in tags:
                if tag.get('Key') == 'Name':
                    identifiers['name'] = tag.get('Value', '')
                    break
    
    # Extract state
    state = resource.get('State', resource.get('DBInstanceStatus', resource.get('Status', {})))
    if isinstance(state, dict):
        identifiers['state'] = state.get('Name', state.get('Code', 'unknown'))
    elif isinstance(state, str):
        identifiers['state'] = state
    
    # Extract tags
    tags = resource.get('Tags', resource.get('TagList', []))
    if isinstance(tags, list):
        identifiers['tags'] = {tag.get('Key', ''): tag.get('Value', '') for tag in tags if isinstance(tag, dict)}
    elif isinstance(tags, dict):
        identifiers['tags'] = tags
    
    # Default name to ID if not found
    if not identifiers['name']:
        identifiers['name'] = identifiers['resourceId']
    
    return identifiers
